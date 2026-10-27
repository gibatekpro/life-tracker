import { formatMoney } from './format';
import type { BudgetLine, BudgetMonth } from './types';

export type LineTone = 'accent' | 'warning' | 'negative';

// Green while on track, amber when today's pace would overspend by month-end, red once over.
// Pace only matters while there's money left: a bill paid exactly in full (a £18 subscription)
// isn't heading anywhere, even though "£18 in 27 days" projects past £18.
export function lineTone(planned: number, spent: number, projected: number, daysLeft: number): LineTone {
  if (planned > 0 && spent > planned) return 'negative';
  if (planned > 0 && spent < planned && daysLeft > 0 && projected > planned) return 'warning';
  return 'accent';
}

// Every line in the tree, parents before their children.
export const flattenLines = (lines: BudgetLine[]): BudgetLine[] => lines.flatMap((l) => [l, ...flattenLines(l.children)]);

// The budget lines to keep an eye on: up to three without subcategories that are over (first)
// or heading over.
export function linesToWatch(b: BudgetMonth) {
  return flattenLines(b.lines)
    .map((line) => ({ line, tone: lineTone(line.planned, line.spent, line.projected, b.daysLeft) }))
    .filter((x) => x.tone !== 'accent' && x.line.children.length === 0)
    .sort((x, y) => (x.tone === 'negative' ? 0 : 1) - (y.tone === 'negative' ? 0 : 1))
    .slice(0, 3);
}

export const watchLabel = ({ line, tone }: { line: BudgetLine; tone: LineTone }) =>
  tone === 'negative' ? `${formatMoney(-line.remaining)} over` : `heading for ${formatMoney(line.projected)}`;

// "How much can I spend today?": the per-day figure ("—" once the month has no days left) and
// the line under it.
export function safeToSpendSummary(b: BudgetMonth) {
  return {
    perDay: b.daysLeft > 0 ? formatMoney(b.safeToSpendPerDay) : '—',
    negative: b.safeToSpend < 0,
    note: `${b.safeToSpend < 0
      ? `${formatMoney(-b.safeToSpend)} more is planned or spent than came in`
      : `${formatMoney(b.safeToSpend)} not spent or set aside`} · ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left`,
  };
}
