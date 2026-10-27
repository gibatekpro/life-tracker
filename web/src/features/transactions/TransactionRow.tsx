import type { Transaction } from '@lifetracker/core';
import { formatDayMonth, formatMoney } from '@lifetracker/core';
import { cn } from '../../lib/cn';
import Icon, { type IconName } from '../../components/ui/Icon';
import { useEditTransaction } from './quickAdd';

const look: Record<Transaction['type'], { icon: IconName; circle: string }> = {
  Expense: { icon: 'arrowUpRight', circle: 'bg-surface-muted text-muted' },
  Income: { icon: 'arrowDownLeft', circle: 'bg-positive-soft text-positive' },
  Transfer: { icon: 'swap', circle: 'bg-accent-soft text-accent' },
};

// One transaction in a list: what it was, where the money went, and how much. Tapping it opens
// it for editing. Spending shows as −£, money in as +£ (green), and transfers neutrally,
// since they aren't spending. showDate is off where the list is already grouped by day.
export default function TransactionRow({ t, showDate = true }: { t: Transaction; showDate?: boolean }) {
  const edit = useEditTransaction();
  const { icon, circle } = look[t.type];
  const inOtherCurrency = t.currency !== 'GBP' && t.toCurrency !== 'GBP';

  return (
    <li>
      <button type="button" onClick={() => edit(t)} aria-label={`Edit ${t.description || 'transaction'}`}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
        <div className={cn('grid size-9 shrink-0 place-items-center rounded-full', circle)}>
          <Icon name={icon} className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{t.description || '—'}</p>
          <p className="truncate text-xs text-muted">
            {t.type === 'Transfer'
              ? <>{t.accountName} <span aria-hidden>→</span><span className="sr-only">to</span> {t.toAccountName}</>
              : <>{t.category} · {t.accountName}</>}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-medium tabular-nums',
            t.type === 'Income' ? 'text-positive' : t.type === 'Transfer' ? 'text-muted' : 'text-ink')}>
            {t.type === 'Income' ? '+' : t.type === 'Expense' ? '−' : ''}{formatMoney(t.amount, t.currency)}
            {t.toAmount !== null && t.toCurrency && <> → {formatMoney(t.toAmount, t.toCurrency)}</>}
          </p>
          {(showDate || inOtherCurrency) && (
            <p className="text-xs text-muted">
              {inOtherCurrency && <>≈ {formatMoney(t.gbpAmount)}</>}
              {inOtherCurrency && showDate && ' · '}
              {showDate && formatDayMonth(t.date)}
            </p>
          )}
        </div>
        <Icon name="chevronRight" className="size-4 shrink-0 text-subtle" />
      </button>
    </li>
  );
}
