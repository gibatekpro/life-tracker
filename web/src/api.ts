import type {
  Account, AccountAlias, AccountPayment, AvalanchePlan, CorrectTransaction, CreateTransaction,
  DebtsOverview, MonthlySummary, SaveAccount, Settings, Transaction, WhatIfComparison,
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
export const correctTransaction = (id: number, c: CorrectTransaction) =>
  request<Transaction>('PATCH', `/transactions/${id}`, c);

// Accounts
export const getAccounts = () => request<Account[]>('GET', '/accounts');
export const getAccount = (id: number) => request<Account>('GET', `/accounts/${id}`);
export const createAccount = (a: SaveAccount) => request<Account>('POST', '/accounts', a);
export const updateAccount = (id: number, a: SaveAccount) => request<void>('PUT', `/accounts/${id}`, a);
export const deleteAccount = (id: number) => request<void>('DELETE', `/accounts/${id}`);
export const addAlias = (id: number, alias: string) => request<AccountAlias>('POST', `/accounts/${id}/aliases`, { alias });
export const removeAlias = (id: number, aliasId: number) => request<void>('DELETE', `/accounts/${id}/aliases/${aliasId}`);
export const getAccountPayments = (id: number) => request<AccountPayment[]>('GET', `/accounts/${id}/payments`);

// Debts (read-only views over card and loan accounts)
export const getDebts = () => request<DebtsOverview>('GET', '/debts');
export const getAvalanchePlan = (extra = 0) => request<AvalanchePlan>('GET', `/debts/avalanche?extra=${extra}`);
export const getWhatIf = (id: number, monthlyPayment: number) =>
  request<WhatIfComparison>('GET', `/debts/${id}/what-if?monthlyPayment=${monthlyPayment}`);

// Summary: with no year/month it's the current month (in UK time).
export const getMonthlySummary = (year?: number, month?: number) =>
  request<MonthlySummary>('GET', year && month ? `/summary/monthly?year=${year}&month=${month}` : '/summary/monthly');

// Settings
export const getSettings = () => request<Settings>('GET', '/settings');
export const updateSettings = (s: { monthlyIncome: number; monthlyDebtBudget: number | null }) =>
  request<Settings>('PUT', '/settings', s);
export const setDefaultAccount = (accountId: number | null) =>
  request<Settings>('PUT', '/settings/default-account', { accountId });
