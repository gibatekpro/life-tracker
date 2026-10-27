import type { ExchangeRate } from './types';
import { currencySymbol, formatDate, formatDayMonth, formatMoney } from './format';

// The rate for from -> to out of the list GET /exchange-rates returns (1 for the same currency).
export function rateFor(rates: ExchangeRate[] | undefined, from: string, to: string): number | null {
  if (from === to) return 1;
  return rates?.find((r) => r.from === from && r.to === to)?.rate ?? null;
}

export function quoteFor(rates: ExchangeRate[] | undefined, from: string, to: string) {
  return rates?.find((r) => r.from === from && r.to === to);
}

// "Your rate · 24 Oct", "From your GBP → NGN rate", "Latest transfer · 1 Oct", "No rate yet".
export function describeSource(r: ExchangeRate | undefined) {
  if (!r || r.source === 'None') return 'No rate yet';
  if (r.source === 'Manual') return `Your rate${r.updatedAt ? ` · ${formatDayMonth(r.updatedAt)}` : ''}`;
  if (r.source === 'InverseOfManual') return `From your ${r.to} → ${r.from} rate`;
  if (r.source === 'Transfer') return `Latest transfer${r.transferDate ? ` · ${formatDate(r.transferDate)}` : ''}`;
  return '';
}

// Rates span 1,850 and 0.00052, so show enough significant digits for either.
export const formatRate = (rate: number) =>
  rate.toLocaleString('en-GB', rate >= 1 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 });

// "≈ £243.00" beside an amount in another currency, at its rate to pounds (display only: anything
// stored is converted by the API). null for pounds.
export function approxPounds(amount: number, currency: string, rates: ExchangeRate[] | undefined) {
  if (currency === 'GBP') return null;
  const rate = rateFor(rates, currency, 'GBP');
  return rate !== null ? `≈ ${formatMoney(amount * rate)}` : 'no £ rate yet';
}

// The rate those £ figures use and where it comes from: "₦1 = £0.00052 · Your rate · 24 Oct".
export function rateNote(currency: string, rates: ExchangeRate[] | undefined) {
  const q = quoteFor(rates, currency, 'GBP');
  return q?.rate != null
    ? `${currencySymbol(currency)}1 = £${formatRate(q.rate)} · ${describeSource(q)}`
    : `No ${currency} to £ rate yet. Set one in Settings → Currencies.`;
}
