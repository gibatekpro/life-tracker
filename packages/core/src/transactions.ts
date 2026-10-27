import type { Transaction, TransactionType } from './types';

// One day of a transaction list. `data` is the name React Native's SectionList expects.
export interface DaySection {
  date: string;
  data: Transaction[];
}

// Transactions grouped by day, newest day first and newest first within a day (date, then id,
// both descending: the order the API sends them in, but not relied on).
export function groupByDay(transactions: Transaction[]): DaySection[] {
  const sorted = [...transactions].sort((a, b) =>
    a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1);
  const sections: DaySection[] = [];
  for (const t of sorted) {
    const last = sections.at(-1);
    if (last?.date === t.date) last.data.push(t);
    else sections.push({ date: t.date, data: [t] });
  }
  return sections;
}

// Whether a list row shows the transaction's £ value as well ("≈ £12.40"): when neither side is in
// pounds. It's the stored GbpAmount, the figure the summary counts, not today's conversion.
export const showsPoundsValue = (t: Transaction) => t.currency !== 'GBP' && t.toCurrency !== 'GBP';

// The transactions dated within a budget month's period (ISO dates compare correctly as strings).
export const inPeriod = (transactions: Transaction[], p: { periodStart: string; periodEnd: string }) =>
  transactions.filter((t) => t.date >= p.periodStart && t.date <= p.periodEnd);

export type TypeFilter = 'All' | TransactionType;

// The list's filters: an account (either side of a transfer), a type, and text found in the
// description or the category path, ignoring case.
export function filterTransactions(transactions: Transaction[], f: { accountId: number | null; type: TypeFilter; search: string }) {
  const q = f.search.trim().toLowerCase();
  return transactions.filter((t) =>
    (f.accountId === null || t.accountId === f.accountId || t.toAccountId === f.accountId) &&
    (f.type === 'All' || t.type === f.type) &&
    (q === '' || t.description.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q)));
}

// A month's headline figures, in pounds: spending, money in, and how many transfers (not spending).
export function transactionTotals(transactions: Transaction[]) {
  return {
    spent: transactions.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + t.gbpAmount, 0),
    received: transactions.filter((t) => t.type === 'Income').reduce((sum, t) => sum + t.gbpAmount, 0),
    transfers: transactions.filter((t) => t.type === 'Transfer').length,
  };
}
