import { describe, expect, it } from 'vitest';

import {
  categoryShares, earlierMonths, leftNote, moneyHeld, owedNote, spendingTrend, spentNote, spentShare, spentShareTone,
} from './overview';
import { account, debtsOverview, summary } from './testData';

describe('earlierMonths', () => {
  it('lists the months before, oldest first, across a year end', () => {
    expect(earlierMonths(2026, 2, 3)).toEqual([{ year: 2025, month: 11 }, { year: 2025, month: 12 }, { year: 2026, month: 1 }]);
  });
});

describe('moneyHeld', () => {
  it('adds up current accounts per currency, pounds first, the rest underneath', () => {
    const held = moneyHeld([
      account({ id: 1, name: 'PalmPay', currency: 'NGN', balance: 50000 }),
      account({ id: 2, name: 'Lloyds', balance: 1000 }),
      account({ id: 3, name: 'Revolut', balance: 240.5 }),
      account({ id: 4, name: 'Amex', type: 'CreditCard', balance: 900 }),
    ]);
    expect(held).toEqual({ value: '£1,240.50', negative: false, sub: '₦50,000.00' });
  });

  it('counts current accounts when everything is in pounds, and flags an overdrawn total', () => {
    expect(moneyHeld([account({ id: 1, name: 'Lloyds', balance: -20 })])).toEqual({ value: '−£20.00', negative: true, sub: '1 current accounts' });
    expect(moneyHeld([]).value).toBe('£0.00');
  });
});

describe('the stat cards', () => {
  it('describes spending against income', () => {
    const s = summary({ totalSpent: 2000, monthlyIncome: 2500, remaining: 500 });
    expect(spentShare(s)).toBe(0.8);
    expect(spentShareTone(0.8)).toBe('warning');
    expect(spentShareTone(0.95)).toBe('negative');
    expect(spentShareTone(0.5)).toBe('accent');
    expect(spentNote(s)).toBe('of £2,500.00 take-home pay');
    expect(spentNote(summary({ incomeMode: 'Recorded' }))).toBe('of £2,500.00 income received');
    expect(leftNote(s)).toBe('20% of income left');
  });

  it('says when nothing has come in or the month is over budget', () => {
    expect(leftNote(summary({ incomeMode: 'Recorded', monthlyIncome: 0, remaining: -10, totalSpent: 10 }))).toBe('No income recorded yet');
    expect(leftNote(summary({ remaining: -1, totalSpent: 2501 }))).toBe('Over budget');
    expect(spentShare(summary({ monthlyIncome: 0, totalSpent: 5 }))).toBe(0);
  });

  it('says when the debts are gone', () => {
    expect(owedNote(debtsOverview())).toBe('No debts');
    expect(owedNote(debtsOverview({ debts: [{} as never], debtFreeDate: '2028-03-01' }))).toBe('Debt-free Mar 2028');
  });
});

describe('categoryShares', () => {
  it("gives each category's share of spending and its bar against the biggest", () => {
    const s = summary({ totalSpent: 400, byCategory: [{ category: 'Food', total: 300 }, { category: 'Fuel', total: 100 }] });
    expect(categoryShares(s)).toEqual([
      { category: 'Food', total: 300, percent: 75, bar: 1 },
      { category: 'Fuel', total: 100, percent: 25, bar: 1 / 3 },
    ]);
  });
});

describe('spendingTrend', () => {
  const months = (spent: number[], s = {}) => spent.map((totalSpent, i) => summary({ month: 5 + i, totalSpent, ...s }));

  it('labels each bar with its month, oldest first', () => {
    expect(spendingTrend(months([1, 2])).bars).toEqual([
      { label: 'May', spent: 1, income: 2500 }, { label: 'Jun', spent: 2, income: 2500 },
    ]);
  });

  it('draws the take-home pay line once spending gets to half of it, and mentions it otherwise', () => {
    expect(spendingTrend(months([1300, 900])).showIncomeLine).toBe(true);
    const low = spendingTrend(months([300, 400]));
    expect(low.showIncomeLine).toBe(false);
    expect(low.note).toBe('Take-home pay £2,500.00 a month; spending is well below it.');
  });

  it('shows recorded income as bars, not a line', () => {
    const r = spendingTrend(months([1300, 900], { incomeMode: 'Recorded' }));
    expect(r).toMatchObject({ recorded: true, showIncomeLine: false, note: null });
  });
});
