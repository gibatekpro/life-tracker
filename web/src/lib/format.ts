// Formatting shared by every screen. Amounts always show in their own currency.

// A proper minus sign (−), not a hyphen, so negative amounts line up with the "−£" we show for spending.
const withMinus = (s: string) => s.replace('-', '−');

// £10.00, ₦18,000.00. narrowSymbol shows "₦" rather than "NGN".
export const formatMoney = (amount: number, currency = 'GBP') =>
  withMinus(amount.toLocaleString('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }));

// Whole units for chart axes: £2,548.
export const formatMoneyShort = (amount: number, currency = 'GBP') =>
  withMinus(amount.toLocaleString('en-GB', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0,
  }));

// The API sends dates as "2026-10-21". Parsed as local dates, so they never shift by a day.
const parseDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDayMonth = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const formatMonthYear = (iso: string | null) =>
  iso ? parseDate(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

export const monthName = (year: number, month: number) =>
  new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// Today as "2026-10-21", in local time (the API's dates are UK dates).
export const todayIso = () => new Date().toLocaleDateString('en-CA');

export const currencySymbol = (currency: string) =>
  (0).toLocaleString('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .replace(/[\d.,\s]/g, '');

// "Wed 21 Oct", for grouping a list by day.
export const formatDayHeading = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
