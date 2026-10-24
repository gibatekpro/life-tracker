import type { ExchangeRate } from '../../types';
import { currencySymbol, formatMoney } from '../../lib/format';
import { describeSource, formatRate, quoteFor, rateFor } from '../../lib/rates';

// "≈ £243" beside an amount in another currency, at its rate to pounds. For display only:
// anything stored is converted by the API.
export function ApproxPounds({ amount, currency, rates, className }: {
  amount: number;
  currency: string;
  rates: ExchangeRate[] | undefined;
  className?: string;
}) {
  if (currency === 'GBP') return null;
  const rate = rateFor(rates, currency, 'GBP');
  return (
    <span className={className ?? 'text-sm text-muted tabular-nums'}>
      {rate !== null ? `≈ ${formatMoney(amount * rate)}` : 'no £ rate yet'}
    </span>
  );
}

// The rate those £ figures use and where it comes from: "₦1 = £0.00052 · Your rate · 24 Oct".
export function RateNote({ currency, rates }: { currency: string; rates: ExchangeRate[] | undefined }) {
  const q = quoteFor(rates, currency, 'GBP');
  return (
    <p className="text-xs text-muted">
      {q?.rate != null
        ? <>{currencySymbol(currency)}1 = £{formatRate(q.rate)} · {describeSource(q)}</>
        : <>No {currency} to £ rate yet. Set one in Settings → Currencies.</>}
    </p>
  );
}
