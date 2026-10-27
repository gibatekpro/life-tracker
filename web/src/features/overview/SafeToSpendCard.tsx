import { Link } from 'react-router';
import { getBudgetMonth } from '../../api';
import type { BudgetLine } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { formatMoney } from '../../lib/format';
import Card from '../../components/ui/Card';
import { Badge, Skeleton } from '../../components/ui/Bits';
import { lineTone } from '../budget/tone';

const flatten = (lines: BudgetLine[]): BudgetLine[] => lines.flatMap((l) => [l, ...flatten(l.children)]);

// "How much can I spend today?": what isn't spent or set aside for the rest of the budget month,
// per day, and the budget lines that are over or heading over.
export default function SafeToSpendCard() {
  const view = useData('budget-now', () => getBudgetMonth());
  const b = view.data?.budget;

  const watch = b
    ? flatten(b.lines)
      .map((l) => ({ l, tone: lineTone(l.planned, l.spent, l.projected, b.daysLeft) }))
      .filter((x) => x.tone !== 'accent' && x.l.children.length === 0)
      .sort((x, y) => (x.tone === 'negative' ? 0 : 1) - (y.tone === 'negative' ? 0 : 1))
      .slice(0, 3)
    : [];

  return (
    <Card title="Safe to spend" action={<Link to="/budget" className="text-sm font-medium text-accent hover:underline">Budget</Link>}>
      {!b ? <Skeleton className="h-24" /> : (
        <>
          <p className={`text-3xl font-semibold tracking-tight tabular-nums ${b.safeToSpend < 0 ? 'text-negative' : 'text-positive'}`}>
            {b.daysLeft > 0 ? formatMoney(b.safeToSpendPerDay) : '—'}<span className="text-base font-medium text-muted"> /day</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {b.safeToSpend < 0
              ? `${formatMoney(-b.safeToSpend)} more is planned or spent than came in`
              : `${formatMoney(b.safeToSpend)} not spent or set aside`}
            {' · '}{b.daysLeft} day{b.daysLeft === 1 ? '' : 's'} left
          </p>
          {watch.length > 0 && (
            <ul className="mt-4 grid gap-2 border-t border-line pt-4">
              {watch.map(({ l, tone }) => (
                <li key={l.categoryId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{l.name}</span>
                  <Badge tone={tone}>
                    {tone === 'negative' ? `${formatMoney(-l.remaining)} over` : `heading for ${formatMoney(l.projected)}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
