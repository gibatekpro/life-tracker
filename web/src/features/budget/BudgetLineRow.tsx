import type { BudgetLine } from '@lifetracker/core';
import { formatMoney } from '@lifetracker/core';
import { cn } from '../../lib/cn';
import { Badge, ProgressBar } from '../../components/ui/Bits';
import ExpandButton from '../../components/tree/ExpandButton';
import type { RowContext } from '../../components/tree/CollapsibleTree';
import AmountEditor from './AmountEditor';
import { lineTone } from './tone';

// One category's line: spent of planned (planned can be changed in place), a progress bar, and
// what's left. Its subcategories are drawn by CollapsibleTree, under the row; on a small screen
// the name opens and closes them.
export default function BudgetLineRow({ line, context: { depth, expandable, expanded, toggle, controls }, daysLeft, onSave, onReset }: {
  line: BudgetLine;
  context: RowContext;
  daysLeft: number;
  onSave: (categoryId: number, amount: number) => Promise<void>;
  onReset: (categoryId: number) => Promise<void>;
}) {
  const tone = lineTone(line.planned, line.spent, line.projected, daysLeft);
  const childPlanned = line.planned - line.ownPlanned;
  const name = <span className={cn(depth === 0 ? 'font-semibold' : 'font-medium')}>{line.name}</span>;

  return (
    <div className="py-3" style={{ paddingLeft: `${Math.min(depth, 4) * 1.25}rem` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {depth > 0 && !expandable && <span aria-hidden className="text-subtle">└</span>}
          {expandable
            ? <ExpandButton expanded={expanded} controls={controls} onClick={toggle}>{name}</ExpandButton>
            : <span className="truncate">{name}</span>}
          {line.isArchived && <Badge>Archived</Badge>}
          {line.monthAmount !== null && <Badge tone="accent">This month</Badge>}
        </div>
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
        {expandable && !expanded && <> · {line.children.length} subcategor{line.children.length === 1 ? 'y' : 'ies'}</>}
      </p>
    </div>
  );
}
