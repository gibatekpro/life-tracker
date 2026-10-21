import type { ReactNode } from 'react';
import type { Transaction } from '../../types';
import { formatDayMonth, formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';
import Icon, { type IconName } from '../../components/ui/Icon';

const look: Record<Transaction['type'], { icon: IconName; circle: string }> = {
  Expense: { icon: 'arrowUpRight', circle: 'bg-surface-muted text-muted' },
  Income: { icon: 'arrowDownLeft', circle: 'bg-positive-soft text-positive' },
  Transfer: { icon: 'swap', circle: 'bg-accent-soft text-accent' },
};

// One transaction in a list: what it was, where the money went, and how much.
// Spending shows as −£, money in as +£ (green), and transfers neutrally, since they aren't spending.
export default function TransactionRow({ t, action }: { t: Transaction; action?: ReactNode }) {
  const { icon, circle } = look[t.type];
  const inOtherCurrency = t.currency !== 'GBP' && t.toCurrency !== 'GBP';

  return (
    <li className="flex items-center gap-3 py-3">
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
        <p className="text-xs text-muted">
          {inOtherCurrency && <>≈ {formatMoney(t.gbpAmount)} · </>}{formatDayMonth(t.date)}
        </p>
      </div>
      {action}
    </li>
  );
}
