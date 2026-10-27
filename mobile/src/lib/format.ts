// The parts of web/src/lib/format.ts the phone uses so far; keep them the same as the web's.

// A proper minus sign (−), not a hyphen, so negative amounts line up with the "−£" we show for spending.
const withMinus = (s: string) => s.replace('-', '−');

// £10.00, ₦18,000.00. narrowSymbol shows "₦" rather than "NGN".
export const formatMoney = (amount: number, currency = 'GBP') =>
  withMinus(amount.toLocaleString('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }));

// The API sends dates as "2026-10-21". Parsed as local dates, so they never shift by a day.
const parseDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDayMonth = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
