import { formatMoney, formatMonthYear } from './format';
import { shiftMonth, toYm, parseYm } from './months';
import type { Account, DebtsOverview, MonthlySummary } from './types';

// The `count` budget months before year/month, oldest first: what the spending trend fetches
// besides the month I'm in now.
export const earlierMonths = (year: number, month: number, count: number) =>
  Array.from({ length: count }, (_, i) => parseYm(shiftMonth(toYm(year, month), i - count)));

// Money held in current accounts, added up per currency, pounds first: "£1,240.50" with
// "₦50,000.00" underneath (or how many current accounts, when it's all in pounds).
export function moneyHeld(accounts: Account[]) {
  const current = accounts.filter((a) => a.type === 'Current');
  const totals = new Map<string, number>();
  for (const a of current) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.balance);
  const held = [...totals].sort(([a], [b]) => (a === 'GBP' ? -1 : b === 'GBP' ? 1 : a.localeCompare(b)));
  return {
    value: held.length ? formatMoney(held[0][1], held[0][0]) : formatMoney(0),
    negative: held.length > 0 && held[0][1] < 0,
    sub: held.length > 1 ? held.slice(1).map(([c, v]) => formatMoney(v, c)).join(' · ') : `${current.length} current accounts`,
  };
}

// The share of this month's income already spent, and how worried to be about it.
export const spentShare = (s: MonthlySummary) => (s.monthlyIncome > 0 ? s.totalSpent / s.monthlyIncome : 0);
export const spentShareTone = (share: number) => (share > 0.9 ? 'negative' : share > 0.75 ? 'warning' : 'accent') as
  'negative' | 'warning' | 'accent';

export const spentNote = (s: MonthlySummary) =>
  `of ${formatMoney(s.monthlyIncome)} ${s.incomeMode === 'Fixed' ? 'take-home pay' : 'income received'}`;

export const leftNote = (s: MonthlySummary) =>
  s.incomeMode === 'Recorded' && s.monthlyIncome === 0 ? 'No income recorded yet'
    : s.remaining < 0 ? 'Over budget' : `${Math.round((1 - spentShare(s)) * 100)}% of income left`;

export const owedNote = (d: DebtsOverview) => (d.debts.length === 0 ? 'No debts' : `Debt-free ${formatMonthYear(d.debtFreeDate)}`);

// Spending by top-level category: each one's share of the month's spending, and its bar's length
// relative to the biggest (the API sends them biggest first).
export const categoryShares = (s: MonthlySummary) =>
  s.byCategory.map((c) => ({
    category: c.category,
    total: c.total,
    percent: Math.round((c.total / s.totalSpent) * 100),
    bar: c.total / s.byCategory[0].total,
  }));

// The spending trend chart: a bar per budget month ("Oct"), oldest first. With a fixed take-home pay,
// it's drawn as a line once spending gets near it (while spending is far below, the line would squash
// the bars flat), and otherwise mentioned underneath. With recorded income, each month's income is its
// own bar beside the spending, since it changes from month to month.
export function spendingTrend(months: MonthlySummary[]) {
  const recorded = months.at(-1)?.incomeMode === 'Recorded';
  const income = months.at(-1)?.monthlyIncome ?? 0;
  const bars = months.map((s) => ({
    label: new Date(s.year, s.month - 1).toLocaleDateString('en-GB', { month: 'short' }),
    spent: s.totalSpent,
    income: s.monthlyIncome,
  }));
  const highest = Math.max(0, ...bars.map((d) => d.spent));
  const showIncomeLine = !recorded && income > 0 && highest >= income * 0.5;
  return {
    bars, recorded, income, showIncomeLine,
    note: !recorded && !showIncomeLine && income > 0 ? `Take-home pay ${formatMoney(income)} a month; spending is well below it.` : null,
  };
}
