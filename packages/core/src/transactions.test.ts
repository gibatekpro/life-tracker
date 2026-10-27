import { describe, expect, it } from 'vitest';

import { transaction } from './testData';
import { groupByDay, showsPoundsValue } from './transactions';

describe('groupByDay', () => {
  it('groups by date, newest day first and newest first within a day', () => {
    const list = [
      transaction({ id: 1, date: '2026-10-20' }),
      transaction({ id: 4, date: '2026-10-21' }),
      transaction({ id: 2, date: '2026-10-21' }),
      transaction({ id: 3, date: '2026-10-19' }),
      transaction({ id: 5, date: '2026-10-20' }),
    ];
    const sections = groupByDay(list);
    expect(sections.map((s) => [s.date, s.data.map((t) => t.id)])).toEqual([
      ['2026-10-21', [4, 2]],
      ['2026-10-20', [5, 1]],
      ['2026-10-19', [3]],
    ]);
  });

  it('leaves the list it was given alone', () => {
    const list = [transaction({ id: 1, date: '2026-10-19' }), transaction({ id: 2, date: '2026-10-21' })];
    groupByDay(list);
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });

  it('gives no sections for no transactions', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('showsPoundsValue', () => {
  it('shows a £ value only when neither side is in pounds', () => {
    expect(showsPoundsValue(transaction({ id: 1 }))).toBe(false); // £ spending
    expect(showsPoundsValue(transaction({ id: 2, currency: 'NGN' }))).toBe(true); // ₦ spending
    // £ → ₦ transfer: the £ side is already shown.
    expect(showsPoundsValue(transaction({ id: 3, type: 'Transfer', toCurrency: 'NGN', toAmount: 18000 }))).toBe(false);
    // ₦ → £: likewise.
    expect(showsPoundsValue(transaction({ id: 4, type: 'Transfer', currency: 'NGN', toCurrency: 'GBP' }))).toBe(false);
    // ₦ → ₦ (PalmPay paying a naira loan): no £ anywhere.
    expect(showsPoundsValue(transaction({ id: 5, type: 'Transfer', currency: 'NGN', toCurrency: 'NGN' }))).toBe(true);
  });
});
