import { describe, expect, it } from 'vitest';

import { parseDate, toIsoDate, ukTodayIso } from './format';

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
