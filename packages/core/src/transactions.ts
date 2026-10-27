import type { Transaction } from './types';

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
