import type { DebtLine } from '../../types';
import { formatMoney } from '../../lib/format';
import Button from '../../components/ui/Button';
import { Badge, ProgressBar } from '../../components/ui/Bits';
import AmountEditor from './AmountEditor';

// A card or loan's line: what I plan to pay this month, what's been paid in, and what the
// avalanche plan suggests (with a button to use it). Everything is in the account's own currency
// (₦ for a naira loan); for those, the £ figure that counts in the month's totals is shown too.
export default function DebtLineRow({ debt: d, onSave, onReset }: {
  debt: DebtLine;
  onSave: (accountId: number, amount: number) => Promise<void>;
  onReset: (accountId: number) => Promise<void>;
}) {
  const c = d.currency;
  const foreign = c !== 'GBP';
  const suggestionDiffers = d.nativeSuggested !== null && Math.abs(d.nativeSuggested - d.nativePlanned) >= 0.01;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {d.name}
          {foreign && <Badge>{c}</Badge>}
          {d.nativeMonthAmount !== null && <Badge tone="accent">This month</Badge>}
        </p>
        <div className="flex items-baseline gap-1 text-sm">
          <span className="tabular-nums">{formatMoney(d.nativePaid, c)}</span>
          <span className="text-muted">paid of</span>
          <AmountEditor label={d.name} currency={c} shown={d.nativePlanned} current={d.nativePlanned}
            defaultAmount={d.nativeDefault} monthAmount={d.nativeMonthAmount}
            onSave={(amount) => onSave(d.accountId, amount)} onReset={() => onReset(d.accountId)} />
        </div>
      </div>

      {d.nativePlanned > 0 && (
        <div className="mt-2">
          <ProgressBar label={`${d.name} paid`} value={d.nativePaid / d.nativePlanned} tone={d.nativeRemaining <= 0 ? 'positive' : 'accent'} />
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {d.nativePlanned === 0 ? 'Nothing planned this month'
            : d.nativeRemaining <= 0 ? <span className="text-positive">Paid for this month</span>
            : `${formatMoney(d.nativeRemaining, c)} still to pay`}
          {foreign && (d.rate !== null
            ? <> · ≈ {formatMoney(d.planned)} of this month's budget</>
            : <> · <span className="text-warning">no £ rate yet, so it isn't in the totals</span></>)}
        </span>
        {d.nativeSuggested !== null && (
          <span className="flex items-center gap-2">
            Avalanche suggests <strong className="font-medium text-ink tabular-nums">{formatMoney(d.nativeSuggested, c)}</strong>
            {suggestionDiffers && <Button size="sm" variant="ghost" onClick={() => onSave(d.accountId, d.nativeSuggested!)}>Use</Button>}
          </span>
        )}
      </div>
    </li>
  );
}
