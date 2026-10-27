import type { ExchangeRate } from '@lifetracker/core';
import { approxPounds, rateNote } from '@lifetracker/core';

// "≈ £243" beside an amount in another currency, at its rate to pounds. For display only:
// anything stored is converted by the API.
export function ApproxPounds({ amount, currency, rates, className }: {
  amount: number;
  currency: string;
  rates: ExchangeRate[] | undefined;
  className?: string;
}) {
  const text = approxPounds(amount, currency, rates);
  return text === null ? null : <span className={className ?? 'text-sm text-muted tabular-nums'}>{text}</span>;
}

// The rate those £ figures use and where it comes from: "₦1 = £0.00052 · Your rate · 24 Oct".
export function RateNote({ currency, rates }: { currency: string; rates: ExchangeRate[] | undefined }) {
  return <p className="text-xs text-muted">{rateNote(currency, rates)}</p>;
}
