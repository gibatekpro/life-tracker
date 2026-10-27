import { Link } from 'react-router';
import { getBudgetMonth } from '../../api';
import { useData } from '../../data/useData';
import { linesToWatch, safeToSpendSummary, watchLabel } from '@lifetracker/core';
import Card from '../../components/ui/Card';
import { Badge, Skeleton } from '../../components/ui/Bits';

// "How much can I spend today?": what isn't spent or set aside for the rest of the budget month,
// per day, and the budget lines that are over or heading over.
export default function SafeToSpendCard() {
  const view = useData('budget-now', () => getBudgetMonth());
  const b = view.data?.budget;

  const watch = b ? linesToWatch(b) : [];
  const safe = b ? safeToSpendSummary(b) : undefined;

  return (
    <Card title="Safe to spend" action={<Link to="/budget" className="text-sm font-medium text-accent hover:underline">Budget</Link>}>
      {!safe ? <Skeleton className="h-24" /> : (
        <>
          <p className={`text-3xl font-semibold tracking-tight tabular-nums ${safe.negative ? 'text-negative' : 'text-positive'}`}>
            {safe.perDay}<span className="text-base font-medium text-muted"> /day</span>
          </p>
          <p className="mt-1 text-sm text-muted">{safe.note}</p>
          {watch.length > 0 && (
            <ul className="mt-4 grid gap-2 border-t border-line pt-4">
              {watch.map((w) => (
                <li key={w.line.categoryId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{w.line.name}</span>
                  <Badge tone={w.tone}>{watchLabel(w)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
