import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format';
import Icon, { type IconName } from './Icon';

type Tone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';

const badgeTones: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-muted',
  accent: 'bg-accent-soft text-accent',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', badgeTones[tone])}>
      {children}
    </span>
  );
}

// An amount in its own currency, with digits that line up in columns.
// direction adds a sign: "in" shows +£10.00, "out" shows −£10.00.
export function Money({ amount, currency = 'GBP', direction, className }: {
  amount: number;
  currency?: string;
  direction?: 'in' | 'out';
  className?: string;
}) {
  const sign = direction === 'in' ? '+' : direction === 'out' ? '−' : '';
  return <span className={cn('tabular-nums', className)}>{sign}{formatMoney(amount, currency)}</span>;
}

// A headline number with a label above and a line of context below.
export function Stat({ label, value, sub, valueClassName }: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className={cn('mt-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl', valueClassName)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted sm:text-sm">{sub}</p>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: Tone; label: string }) {
  const fill: Record<Tone, string> = {
    neutral: 'bg-subtle', accent: 'bg-accent', positive: 'bg-positive', negative: 'bg-negative', warning: 'bg-warning',
  };
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar"
      aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

const alertTones = {
  info: { box: 'border-line bg-surface-muted text-ink', icon: 'info' as IconName, iconClass: 'text-muted' },
  warning: { box: 'border-transparent bg-warning-soft text-ink', icon: 'alert' as IconName, iconClass: 'text-warning' },
  negative: { box: 'border-transparent bg-negative-soft text-ink', icon: 'alert' as IconName, iconClass: 'text-negative' },
};

export function Alert({ tone = 'info', children, className }: {
  tone?: keyof typeof alertTones;
  children: ReactNode;
  className?: string;
}) {
  const t = alertTones[tone];
  return (
    <div role={tone === 'negative' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', t.box, className)}>
      <Icon name={t.icon} className={cn('mt-0.5 size-4 shrink-0', t.iconClass)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-surface-muted p-3 text-muted"><Icon name={icon} /></div>
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-muted', className)} />;
}

export function PageHeader({ title, description, actions }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 empty:hidden">{actions}</div>}
    </div>
  );
}

// A row of mutually exclusive choices, e.g. Expense / Income / Transfer.
export function SegmentedControl<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-muted p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 rounded-lg text-sm font-medium transition',
            o.value === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
