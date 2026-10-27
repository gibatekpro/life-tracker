import type {
  Account, AccountAlias, AccountPayment, AvalanchePlan, BudgetLineKey, BudgetMonthView, Category, CreateTransaction,
  DebtsOverview, ExchangeRate, IncomeMode, Insight, MonthlySummary, SaveAccount, SaveCategory, Settings, Transaction,
  WhatIfComparison,
} from './types';

// An Error whose message is ready to show, plus the HTTP status when the API answered,
// so a screen can react to a status (e.g. 401 on the phone) without matching on the text.
export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiOptions {
  // Put in front of every path: '/api' on the web (Vite forwards it to the API), the Mac's
  // Tailscale address on the phone.
  baseUrl: string;
  // Extra headers for each request (the phone's X-Api-Key). Throwing stops the request with that error.
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  // Give up after this long; without it a request waits as long as the platform lets it.
  timeoutMs?: number;
  // This app's own wording for when the API can't be reached (or timed out), and for a 401.
  // Without them, network errors are thrown as they are and a 401 is treated like any error.
  messages?: { unreachable?: string; unauthorized?: string };
}

// Every endpoint, for one app. Each app makes one of these with its own address and headers
// (web/src/api.ts, mobile/src/api.ts).
export function createApi({ baseUrl, getHeaders, timeoutMs, messages = {} }: ApiOptions) {
  // Every call goes through here. When the API says no, its message ({ error } or a plain string)
  // becomes the error's message, so forms can show exactly what was wrong.
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...(await getHeaders?.()) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = timeoutMs === undefined ? undefined : new AbortController();
    const timer = controller && setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal,
      });
    } catch (e) {
      // Timed out (e.g. the Mac is asleep) or no route at all (API not running, no network).
      if (messages.unreachable) throw new ApiError(messages.unreachable);
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 && messages.unauthorized) throw new ApiError(messages.unauthorized, 401);

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      const message =
        typeof payload === 'string' ? payload
          : payload?.error ?? payload?.title
          ?? (res.status === 404 ? 'Not found.' : `Something went wrong (${res.status}).`);
      throw new ApiError(message, res.status);
    }

    return res.status === 204 ? (undefined as T) : res.json();
  }

  return {
    // Transactions
    getTransactions: () => request<Transaction[]>('GET', '/transactions'),
    getTransaction: (id: number) => request<Transaction>('GET', `/transactions/${id}`),
    createTransaction: (t: CreateTransaction) => request<Transaction>('POST', '/transactions', t),
    // An edit sends the whole transaction again; the API moves the balances to match.
    updateTransaction: (id: number, t: CreateTransaction) => request<Transaction>('PUT', `/transactions/${id}`, t),
    deleteTransaction: (id: number) => request<void>('DELETE', `/transactions/${id}`),

    // Accounts
    getAccounts: () => request<Account[]>('GET', '/accounts'),
    getAccount: (id: number) => request<Account>('GET', `/accounts/${id}`),
    createAccount: (a: SaveAccount) => request<Account>('POST', '/accounts', a),
    updateAccount: (id: number, a: SaveAccount) => request<void>('PUT', `/accounts/${id}`, a),
    deleteAccount: (id: number) => request<void>('DELETE', `/accounts/${id}`),
    addAlias: (id: number, alias: string) => request<AccountAlias>('POST', `/accounts/${id}/aliases`, { alias }),
    removeAlias: (id: number, aliasId: number) => request<void>('DELETE', `/accounts/${id}/aliases/${aliasId}`),
    getAccountPayments: (id: number) => request<AccountPayment[]>('GET', `/accounts/${id}/payments`),

    // Categories: the tree spending and income are filed under. Delete only works while nothing
    // uses a category; otherwise the API says to archive it.
    getCategories: () => request<Category[]>('GET', '/categories'),
    createCategory: (c: SaveCategory) => request<Category>('POST', '/categories', c),
    updateCategory: (id: number, c: SaveCategory) => request<Category>('PUT', `/categories/${id}`, c),
    archiveCategory: (id: number) => request<Category>('POST', `/categories/${id}/archive`),
    unarchiveCategory: (id: number) => request<Category>('POST', `/categories/${id}/unarchive`),
    deleteCategory: (id: number) => request<void>('DELETE', `/categories/${id}`),

    // Budgets: a month's lines (no year/month = the budget month I'm in now). A figure set for a month
    // overrides the default for that month only; resetting goes back to the default.
    getBudgetMonth: (year?: number, month?: number) =>
      request<BudgetMonthView>('GET', year && month ? `/budgets/month?year=${year}&month=${month}` : '/budgets/month'),
    setBudgetAmount: (year: number, month: number, key: BudgetLineKey, amount: number) =>
      request<void>('PUT', '/budgets/month/amount', { year, month, ...key, amount }),
    resetBudgetAmount: (year: number, month: number, key: BudgetLineKey) =>
      request<void>('DELETE', `/budgets/month/amount?year=${year}&month=${month}&${
        key.categoryId !== undefined ? `categoryId=${key.categoryId}` : `accountId=${key.accountId}`}`),
    copyPreviousBudget: (year: number, month: number) =>
      request<{ copied: number }>('POST', '/budgets/month/copy-previous', { year, month }),

    // Insights: the API asks OpenAI (the apps never do). Generating returns the month's existing
    // insight unless regenerate is set; with no key configured the API answers 503.
    getInsights: () => request<Insight[]>('GET', '/insights'),
    generateInsight: (year: number, month: number, regenerate = false) =>
      request<Insight>('POST', '/insights', { year, month, regenerate }),
    deleteInsight: (id: number) => request<void>('DELETE', `/insights/${id}`),

    // Debts (read-only views over card and loan accounts)
    getDebts: () => request<DebtsOverview>('GET', '/debts'),
    getAvalanchePlan: (extra = 0) => request<AvalanchePlan>('GET', `/debts/avalanche?extra=${extra}`),
    getWhatIf: (id: number, monthlyPayment: number) =>
      request<WhatIfComparison>('GET', `/debts/${id}/what-if?monthlyPayment=${monthlyPayment}`),

    // Summary: with no year/month it's the budget month I'm in now (UK time, following payday).
    getMonthlySummary: (year?: number, month?: number) =>
      request<MonthlySummary>('GET', year && month ? `/summary/monthly?year=${year}&month=${month}` : '/summary/monthly'),

    // Settings
    getSettings: () => request<Settings>('GET', '/settings'),
    // Fields after the debt budget can be left out to keep them as they are.
    updateSettings: (s: {
      monthlyIncome: number;
      monthlyDebtBudget: number | null;
      incomeMode?: IncomeMode;
      monthStartDay?: number;
      useTransferRates?: boolean;
      earlyIncomeDays?: number;
    }) => request<Settings>('PUT', '/settings', s),
    setDefaultAccount: (accountId: number | null) =>
      request<Settings>('PUT', '/settings/default-account', { accountId }),

    // Exchange rates: both directions for each currency in use, with where each comes from.
    getExchangeRates: () => request<ExchangeRate[]>('GET', '/exchange-rates'),
    setExchangeRate: (from: string, to: string, rate: number) =>
      request<void>('PUT', `/exchange-rates/${from}/${to}`, { rate }),
    clearExchangeRate: (from: string, to: string) => request<void>('DELETE', `/exchange-rates/${from}/${to}`),
  };
}

export type Api = ReturnType<typeof createApi>;
