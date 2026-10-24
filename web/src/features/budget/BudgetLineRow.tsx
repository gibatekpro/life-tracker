import type { BudgetLine } from '../../types';
import { formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Badge, ProgressBar } from '../../components/ui/Bits';
import AmountEditor from './AmountEditor';
import { lineTone } from './tone';

// One category's line, then its subcategories indented beneath it.
export default function BudgetLineRow({ line, depth, daysLeft, onSave, onReset }: {
  line: BudgetLine;
  depth: number;
  daysLeft: number;
  onSave: (categoryId: number, amount: number) => Promise<void>;
  onReset: (categoryId: number) => Promise<void>;
}) {
  const tone = lineTone(line.planned, line.spent, line.projected, daysLeft);
  const childPlanned = line.planned - line.ownPlanned;

  return (
    <>
      <li className="py-3" style={{ paddingLeft: `${Math.min(depth, 4) * 1.25}rem` }}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className={cn('flex min-w-0 items-center gap-2 text-sm', depth === 0 ? 'font-semibold' : 'font-medium')}>
            {depth > 0 && <span aria-hidden className="text-subtle">└</span>}
            <span className="truncate">{line.name}</span>
            {line.isArchived && <Badge>Archived</Badge>}
            {line.monthAmount !== null && <Badge tone="accent">This month</Badge>}
          </p>
          <div className="flex items-baseline gap-1 text-sm">
            <span className="tabular-nums">{formatMoney(line.spent)}</span>
            <span className="text-muted">of</span>
            <AmountEditor label={line.name} shown={line.planned} current={line.ownPlanned}
              defaultAmount={line.defaultAmount} monthAmount={line.monthAmount}
              onSave={(amount) => onSave(line.categoryId, amount)} onReset={() => onReset(line.categoryId)} />
          </div>
        </div>

        {line.planned > 0 && (
          <div className="mt-2">
            <ProgressBar label={`${line.name} budget used`} value={line.spent / line.planned} tone={tone} />
          </div>
        )}

        <p className="mt-1.5 text-xs text-muted">
          {line.planned === 0 ? 'No budget this month'
            : line.remaining < 0 ? <span className="text-negative">{formatMoney(-line.remaining)} over</span>
            : line.remaining === 0 ? 'Fully used'
            : <>{formatMoney(line.remaining)} left{daysLeft > 0 && <> · {formatMoney(line.dailyAllowance)}/day</>}</>}
          {tone === 'warning' && <span className="text-warning"> · on pace for {formatMoney(line.projected)}</span>}
          {childPlanned > 0 && line.ownPlanned > 0 && <> · own {formatMoney(line.ownPlanned)} + subcategories {formatMoney(childPlanned)}</>}
        </p>
      </li>
      {line.children.map((c) => (
        <BudgetLineRow key={c.categoryId} line={c} depth={depth + 1} daysLeft={daysLeft} onSave={onSave} onReset={onReset} />
      ))}
    </>
  );
}
