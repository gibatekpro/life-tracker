import { describe, expect, it } from 'vitest';

import { currencySymbol, formatMoney, formatMoneyShort, parseDate, toIsoDate, ukTodayIso } from './format';

describe('ukTodayIso', () => {
  it('is the UK date, not the UTC one, late in the evening in summer', () => {
    expect(ukTodayIso(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01'); // 00:30 BST
  });

  it('is the UTC date in winter', () => {
    expect(ukTodayIso(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31'); // 23:30 GMT
  });

  it('agrees with the tz database every hour for two years, including both clock changes', () => {
    const uk = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 3_600_000) {
      const d = new Date(t);
      if (ukTodayIso(d) !== uk(d)) expect.fail(`${d.toISOString()}: ${ukTodayIso(d)} vs ${uk(d)}`);
    }
  });
});

describe('toIsoDate', () => {
  it('round-trips with parseDate as a local date', () => {
    expect(toIsoDate(parseDate('2026-03-09'))).toBe('2026-03-09');
    expect(toIsoDate(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27');
  });
});

describe('formatMoney', () => {
  it('writes the symbol itself, with a real minus sign', () => {
    expect(formatMoney(1240.5)).toBe('£1,240.50');
    expect(formatMoney(50000, 'NGN')).toBe('₦50,000.00');
    expect(formatMoney(-20)).toBe('−£20.00');
    expect(formatMoneyShort(2547.6)).toBe('£2,548');
    expect(currencySymbol('NGN')).toBe('₦');
  });

  it('reads exactly as Intl narrowSymbol did, for every supported currency', () => {
    const intl = (v: number, c: string, d: number) => v.toLocaleString('en-GB', {
      style: 'currency', currency: c, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d,
    }).replace('-', '−');
    for (const c of ['GBP', 'NGN', 'EUR', 'USD'])
      for (const v of [0, 0.004, 0.005, 1, 12.345, 999.995, 1234.5, -0.5, -18115, 1e7 + 0.126]) {
        expect(formatMoney(v, c)).toBe(intl(v, c, 2));
        expect(formatMoneyShort(v, c)).toBe(intl(v, c, 0));
      }
  });

  it('falls back to Intl for other currencies', () => {
    expect(formatMoney(5, 'JPY')).toBe('¥5.00');
  });
});
