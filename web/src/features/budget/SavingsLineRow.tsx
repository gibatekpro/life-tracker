import { Link } from 'react-router';
import type { SavingsLine } from '@lifetracker/core';
import { formatMoney, savingsLineNote } from '@lifetracker/core';
import { Badge, ProgressBar } from '../../components/ui/Bits';
import AmountEditor from './AmountEditor';
import NoteParts from './NoteParts';

// A planned purchase's line: what I plan to put aside this month (its monthly amount, or this
// month's own figure, never more than it still needs) and what's gone into its savings account.
export default function SavingsLineRow({ line: s, onSave, onReset }: {
  line: SavingsLine;
  onSave: (accountId: number, amount: number) => Promise<void>;
  onReset: (accountId: number) => Promise<void>;
}) {
  const { parts, progressTone } = savingsLineNote(s);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Link to={`/planned-purchases/${s.plannedPurchaseId}`} className="hover:underline">{s.name}</Link>
          {s.isEssential && <Badge tone="accent">Essential</Badge>}
          {s.monthAmount !== null && <Badge tone="accent">This month</Badge>}
        </p>
        <div className="flex items-baseline gap-1 text-sm">
          <span className="tabular-nums">{formatMoney(s.paid)}</span>
          <span className="text-muted">saved of</span>
          <AmountEditor label={s.name} shown={s.planned} current={s.planned} defaultAmount={s.defaultAmount} monthAmount={s.monthAmount}
            onSave={(amount) => onSave(s.accountId, amount)} onReset={() => onReset(s.accountId)} />
        </div>
      </div>
      {s.planned > 0 && <div className="mt-2"><ProgressBar label={`${s.name} saved`} value={s.paid / s.planned} tone={progressTone} /></div>}
      <p className="mt-1.5 text-xs text-muted"><NoteParts parts={parts} /></p>
    </li>
  );
}
