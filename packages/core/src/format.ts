// Formatting shared by every screen. Amounts always show in their own currency.

// A proper minus sign (−), not a hyphen, so negative amounts line up with the "−£" we show for spending.
const withMinus = (s: string) => s.replace('-', '−');

// The symbols of the currencies the app supports. Written out rather than asked of Intl: the
// phone's JavaScript engine (Hermes) ignores currencyDisplay 'narrowSymbol' and shows "NGN 5,000.00".
const symbols: Record<string, string> = { GBP: '£', NGN: '₦', EUR: '€', USD: '$' };

const money = (amount: number, currency: string, digits: number) => {
  const symbol = symbols[currency];
  if (!symbol) {
    return withMinus(amount.toLocaleString('en-GB', {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits,
    }));
  }
  const digitsText = Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${amount < 0 ? '−' : ''}${symbol}${digitsText}`;
};

// £10.00, ₦18,000.00, −£4.50.
export const formatMoney = (amount: number, currency = 'GBP') => money(amount, currency, 2);

// Whole units for chart axes: £2,548.
export const formatMoneyShort = (amount: number, currency = 'GBP') => money(amount, currency, 0);

// The API sends dates as "2026-10-21". Parsed as local dates, so they never shift by a day.
export const parseDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// The other way: a local date (e.g. from the phone's date picker) as "2026-10-21".
export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const formatDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// A moment, e.g. when an insight was generated: "27 Oct 2026, 18:40".
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatDayMonth = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const formatMonthYear = (iso: string | null) =>
  iso ? parseDate(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

export const monthName = (year: number, month: number) =>
  new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// Today as "2026-10-21", in local time (the API's dates are UK dates).
export const todayIso = () => new Date().toLocaleDateString('en-CA');

// When UK clocks change: the last Sunday of March (forward) or October (back), at 01:00 UTC.
const ukClockChange = (year: number, monthIndex: number) => {
  const d = new Date(Date.UTC(year, monthIndex + 1, 0, 1)); // the month's last day, 01:00 UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
};

// Today in the UK as "2026-10-21", wherever the device is (the phone may be in Lagos), since the
// API's dates are UK dates. Works the offset out from the clock-change rule rather than relying on
// Intl time zone support, which not every JavaScript engine has.
export function ukTodayIso(now = new Date()) {
  const year = now.getUTCFullYear();
  const summerTime = now.getTime() >= ukClockChange(year, 2) && now.getTime() < ukClockChange(year, 9);
  return new Date(now.getTime() + (summerTime ? 3_600_000 : 0)).toISOString().slice(0, 10);
}

export const currencySymbol = (currency: string) =>
  symbols[currency] ?? (0).toLocaleString('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .replace(/[\d.,\s]/g, '');

// "Wed 21 Oct", for grouping a list by day.
export const formatDayHeading = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// A budget month's name: "October 2026" for a calendar month, or its dates when it follows
// payday: "25 Oct – 24 Nov 2026".
export const periodLabel = (p: { year: number; month: number; periodStart: string; periodEnd: string }) => {
  if (p.periodStart.endsWith('-01')) return monthName(p.year, p.month);
  const start = parseDate(p.periodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${start} – ${formatDate(p.periodEnd)}`;
};

// 1 -> "1st", 22 -> "22nd", 25 -> "25th".
export const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
};
