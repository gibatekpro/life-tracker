import { describe, expect, it } from 'vitest';

import { transaction } from './testData';
import { filterTransactions, groupByDay, inPeriod, showsPoundsValue, transactionTotals } from './transactions';

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

const list = [
  transaction({ id: 1, date: '2026-09-27', description: 'Before', gbpAmount: 99 }),
  transaction({ id: 2, date: '2026-09-28', description: 'Tesco', category: 'Food', gbpAmount: 12.5 }),
  transaction({ id: 3, date: '2026-10-05', description: 'Salary', type: 'Income', category: 'Salary', gbpAmount: 2500 }),
  transaction({ id: 4, date: '2026-10-10', description: 'Netflix', category: 'Subscriptions › TV', accountId: 2, gbpAmount: 10.99 }),
  transaction({ id: 5, date: '2026-10-12', description: 'Transfer to PalmPay', type: 'Transfer', category: null,
    accountId: 1, toAccountId: 7, gbpAmount: 10 }),
  transaction({ id: 6, date: '2026-10-28', description: 'After', gbpAmount: 99 }),
];
const october = { periodStart: '2026-09-28', periodEnd: '2026-10-27' };

describe('inPeriod', () => {
  it('keeps the transactions dated within the period, both ends included', () => {
    expect(inPeriod(list, october).map((t) => t.id)).toEqual([2, 3, 4, 5]);
  });
});

describe('filterTransactions', () => {
  const ids = (f: Parameters<typeof filterTransactions>[1]) => filterTransactions(list, f).map((t) => t.id);
  const all = { accountId: null, type: 'All' as const, search: '' };

  it('finds an account on either side of a transfer', () => {
    expect(ids({ ...all, accountId: 7 })).toEqual([5]);
    expect(ids({ ...all, accountId: 2 })).toEqual([4]);
  });

  it('filters by type', () => {
    expect(ids({ ...all, type: 'Income' })).toEqual([3]);
  });

  it('searches the description and the category path, ignoring case and spaces around it', () => {
    expect(ids({ ...all, search: ' tesco ' })).toEqual([2]);
    expect(ids({ ...all, search: 'tv' })).toEqual([4]);
  });
});

describe('transactionTotals', () => {
  it('adds spending and money in as £, and counts transfers', () => {
    const totals = transactionTotals(inPeriod(list, october));
    expect(totals.spent).toBeCloseTo(23.49);
    expect(totals).toMatchObject({ received: 2500, transfers: 1 });
  });
});
