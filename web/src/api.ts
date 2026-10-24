import type {
  Account, AccountAlias, AccountPayment, AvalanchePlan, BudgetLineKey, BudgetMonthView, Category, CreateTransaction,
  SaveCategory,
  DebtsOverview, IncomeMode, MonthlySummary, SaveAccount, Settings, Transaction, WhatIfComparison,
} from './types';

// Every call goes through here: the Vite dev server forwards /api to the API on port 5080.
// When the API says no, its message ({ error } or a plain string) becomes the Error's message,
// so forms can show exactly what was wrong.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      typeof payload === 'string' ? payload
        : payload?.error ?? payload?.title
        ?? (res.status === 404 ? 'Not found.' : `Something went wrong (${res.status}).`);
    throw new Error(message);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

// Transactions
export const getTransactions = () => request<Transaction[]>('GET', '/transactions');
export const createTransaction = (t: CreateTransaction) => request<Transaction>('POST', '/transactions', t);
// An edit sends the whole transaction again; the API moves the balances to match.
export const updateTransaction = (id: number, t: CreateTransaction) => request<Transaction>('PUT', `/transactions/${id}`, t);
export const deleteTransaction = (id: number) => request<void>('DELETE', `/transactions/${id}`);

// Accounts
export const getAccounts = () => request<Account[]>('GET', '/accounts');
export const getAccount = (id: number) => request<Account>('GET', `/accounts/${id}`);
export const createAccount = (a: SaveAccount) => request<Account>('POST', '/accounts', a);
export const updateAccount = (id: number, a: SaveAccount) => request<void>('PUT', `/accounts/${id}`, a);
export const deleteAccount = (id: number) => request<void>('DELETE', `/accounts/${id}`);
export const addAlias = (id: number, alias: string) => request<AccountAlias>('POST', `/accounts/${id}/aliases`, { alias });
export const removeAlias = (id: number, aliasId: number) => request<void>('DELETE', `/accounts/${id}/aliases/${aliasId}`);
export const getAccountPayments = (id: number) => request<AccountPayment[]>('GET', `/accounts/${id}/payments`);

// Categories: the tree spending and income are filed under. Delete only works while nothing
// uses a category; otherwise the API says to archive it.
export const getCategories = () => request<Category[]>('GET', '/categories');
export const createCategory = (c: SaveCategory) => request<Category>('POST', '/categories', c);
export const updateCategory = (id: number, c: SaveCategory) => request<Category>('PUT', `/categories/${id}`, c);
export const archiveCategory = (id: number) => request<Category>('POST', `/categories/${id}/archive`);
export const unarchiveCategory = (id: number) => request<Category>('POST', `/categories/${id}/unarchive`);
export const deleteCategory = (id: number) => request<void>('DELETE', `/categories/${id}`);

// Budgets: a month's lines (no year/month = the budget month I'm in now). A figure set for a month
// overrides the default for that month only; resetting goes back to the default.
export const getBudgetMonth = (year?: number, month?: number) =>
  request<BudgetMonthView>('GET', year && month ? `/budgets/month?year=${year}&month=${month}` : '/budgets/month');
export const setBudgetAmount = (year: number, month: number, key: BudgetLineKey, amount: number) =>
  request<void>('PUT', '/budgets/month/amount', { year, month, ...key, amount });
export const resetBudgetAmount = (year: number, month: number, key: BudgetLineKey) =>
  request<void>('DELETE', `/budgets/month/amount?year=${year}&month=${month}&${
    key.categoryId !== undefined ? `categoryId=${key.categoryId}` : `accountId=${key.accountId}`}`);
export const copyPreviousBudget = (year: number, month: number) =>
  request<{ copied: number }>('POST', '/budgets/month/copy-previous', { year, month });

// Debts (read-only views over card and loan accounts)
export const getDebts = () => request<DebtsOverview>('GET', '/debts');
export const getAvalanchePlan = (extra = 0) => request<AvalanchePlan>('GET', `/debts/avalanche?extra=${extra}`);
export const getWhatIf = (id: number, monthlyPayment: number) =>
  request<WhatIfComparison>('GET', `/debts/${id}/what-if?monthlyPayment=${monthlyPayment}`);

// Summary: with no year/month it's the budget month I'm in now (UK time, following payday).
export const getMonthlySummary = (year?: number, month?: number) =>
  request<MonthlySummary>('GET', year && month ? `/summary/monthly?year=${year}&month=${month}` : '/summary/monthly');

// Settings
export const getSettings = () => request<Settings>('GET', '/settings');
export const updateSettings = (s: {
  monthlyIncome: number;
  monthlyDebtBudget: number | null;
  incomeMode: IncomeMode;
  monthStartDay: number;
}) => request<Settings>('PUT', '/settings', s);
export const setDefaultAccount = (accountId: number | null) =>
  request<Settings>('PUT', '/settings/default-account', { accountId });
