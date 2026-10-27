// Builders for tests only (not exported from the package): each fills in every field with
// something plausible, so a test only spells out what it's about.
import type { Account, Category, ExchangeRate, Transaction } from './types';

export const category = (c: Partial<Category> & Pick<Category, 'id' | 'name'>): Category => ({
  kind: 'Expense', parentId: null, path: c.name, depth: 0, sortOrder: 0, isArchived: false,
  defaultMonthlyAmount: null, transactionCount: 0, childCount: 0, ...c,
});

export const account = (a: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  type: 'Current', currency: 'GBP', balance: 0, apr: 0, minimumPayment: 0, monthlyPayment: 0,
  creditLimit: null, availableCredit: null, createdAt: '2026-01-01T00:00:00Z', aliases: [], ...a,
});

export const transaction = (t: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction => ({
  amount: 10, currency: 'GBP', gbpAmount: 10, description: 'Tesco', categoryId: 1, category: 'Food',
  date: '2026-10-21', type: 'Expense', accountId: 1, accountName: 'Lloyds Current',
  toAccountId: null, toAccountName: null, toAmount: null, toCurrency: null,
  createdAt: '2026-10-21T12:00:00Z', ...t,
});

export const rate = (from: string, to: string, value: number | null): ExchangeRate => ({
  from, to, rate: value, source: value === null ? 'None' : 'Manual', updatedAt: null, transferDate: null, manualRate: value,
});
