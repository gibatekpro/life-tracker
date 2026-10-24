import type { DebtLine } from '../../types';
import { formatMoney } from '../../lib/format';
import Button from '../../components/ui/Button';
import { Badge, ProgressBar } from '../../components/ui/Bits';
import AmountEditor from './AmountEditor';

// A card or loan's line: what I plan to pay this month, what's been paid in, and what the
// avalanche plan suggests (with a button to use it).
export default function DebtLineRow({ debt, onSave, onReset }: {
  debt: DebtLine;
  onSave: (accountId: number, amount: number) => Promise<void>;
  onReset: (accountId: number) => Promise<void>;
}) {
  const suggestionDiffers = debt.suggested !== null && Math.abs(debt.suggested - debt.planned) >= 0.01;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {debt.name}
          {debt.monthAmount !== null && <Badge tone="accent">This month</Badge>}
        </p>
        <div className="flex items-baseline gap-1 text-sm">
          <span className="tabular-nums">{formatMoney(debt.paid)}</span>
          <span className="text-muted">paid of</span>
          <AmountEditor label={debt.name} shown={debt.planned} current={debt.planned}
            defaultAmount={debt.defaultAmount} monthAmount={debt.monthAmount}
            onSave={(amount) => onSave(debt.accountId, amount)} onReset={() => onReset(debt.accountId)} />
        </div>
      </div>

      {debt.planned > 0 && (
        <div className="mt-2">
          <ProgressBar label={`${debt.name} paid`} value={debt.paid / debt.planned} tone={debt.remaining <= 0 ? 'positive' : 'accent'} />
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {debt.defaultAmount === null ? 'No £ rate yet: record a transfer in its currency'
            : debt.remaining <= 0 ? <span className="text-positive">Paid for this month</span>
            : `${formatMoney(debt.remaining)} still to pay`}
        </span>
        {debt.suggested !== null && (
          <span className="flex items-center gap-2">
            Avalanche suggests <strong className="font-medium text-ink tabular-nums">{formatMoney(debt.suggested)}</strong>
            {suggestionDiffers && <Button size="sm" variant="ghost" onClick={() => onSave(debt.accountId, debt.suggested!)}>Use</Button>}
          </span>
        )}
      </div>
    </li>
  );
}
