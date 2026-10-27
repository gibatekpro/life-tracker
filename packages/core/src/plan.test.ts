import { describe, expect, it } from 'vitest';

import {
  extraOutcome, foreignOwed, monthlyBudgetNote, payoffChartDescription, payoffChartRows, payoffNote, planHeadline, planMissingRates,
} from './plan';
import { account, rate } from './testData';
import type { AvalanchePlan } from './types';

const plan = (p: Partial<AvalanchePlan> = {}): AvalanchePlan => ({
  canBePaidOff: true, months: 24, debtFreeDate: '2028-10-01', totalInterest: 900, monthlyBudget: 760.86,
  payoffs: [
    { id: 3, name: 'Aqua', month: 10, payoffDate: '2027-08-01', interestPaid: 300 },
    { id: 2, name: 'Capital One', month: 24, payoffDate: '2028-10-01', interestPaid: 600 },
  ],
  ...p,
});

describe('the plan', () => {
  it('says when the debts are gone, or why not', () => {
    expect(planHeadline(plan())).toEqual({ clears: true, date: 'Oct 2028', note: '24 months · £900.00 interest · paying £760.86 a month' });
    expect(planHeadline(plan({ canBePaidOff: false, monthlyBudget: 50 }))).toEqual({
      clears: false, message: "At £50.00 a month the debts can't be cleared within 50 years. Try a higher amount.",
    });
  });

  it('lists each debt for the chart, with and without the extra', () => {
    const extra = plan({ payoffs: [{ id: 3, name: 'Aqua', month: 7, payoffDate: '', interestPaid: 0 }] });
    expect(payoffChartRows(plan(), extra)).toEqual([
      { id: 3, name: 'Aqua', now: 10, withExtra: 7 }, { id: 2, name: 'Capital One', now: 24, withExtra: undefined },
    ]);
    expect(payoffChartDescription(0)).toBe('Months from now.');
    expect(payoffChartDescription(50)).toBe('Months from now, at your current budget and with the extra.');
  });

  it('describes each payoff and naira debts', () => {
    expect(payoffNote(plan().payoffs[0])).toBe('Cleared Aug 2027 · month 10');
    const loan = account({ id: 8, name: 'Ease Cash', type: 'Loan', currency: 'NGN', balance: 170574 });
    expect(foreignOwed(loan, [rate('NGN', 'GBP', 0.0005)])).toBe('₦170,574.00 owed · ≈ £85.29');
    expect(foreignOwed(account({ id: 1, name: 'Aqua' }), [])).toBeNull();
    expect(planMissingRates([])).toBeNull();
    expect(planMissingRates(['NGN'])).toBe("NGN debts aren't in this plan yet: record a transfer between pounds and NGN so they can be converted.");
    expect(monthlyBudgetNote(plan())).toMatch(/^The plan pays £760.86 a month: your planned payments/);
  });
});

describe('extraOutcome', () => {
  it('prompts until there is an extra amount', () => {
    expect(extraOutcome(0, plan(), plan())).toEqual({ tone: 'muted', headline: 'Drag the slider or type an amount.' });
  });

  it('says how much sooner and cheaper', () => {
    expect(extraOutcome(100, plan(), plan({ months: 19, totalInterest: 700 }))).toEqual({
      tone: 'positive', headline: '5 months sooner', sub: 'and £200.00 less interest',
    });
    expect(extraOutcome(10, plan(), plan({ months: 23, totalInterest: 880 })).headline).toBe('1 month sooner');
    expect(extraOutcome(10, plan(), plan({ totalInterest: 890 }))).toEqual({
      tone: 'positive', headline: '£10.00 less interest', sub: 'Same debt-free month, but cheaper.',
    });
  });

  it('says when it is still not enough, or now enough', () => {
    const never = plan({ canBePaidOff: false });
    expect(extraOutcome(10, never, never).headline).toBe('Still not enough to clear the debts.');
    expect(extraOutcome(10, never, plan()).headline).toBe('With the extra, the debts can be cleared.');
  });
});
