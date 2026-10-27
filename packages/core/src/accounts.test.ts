import { describe, expect, it } from 'vitest';

import {
  accountGroups, accountLabel, creditUsage, defaultWhatIfPayment, foreignCurrencies, payDraft, payoffStat, whatIfSummary,
} from './accounts';
import { account } from './testData';
import type { PayoffProjection } from './types';

describe('accountGroups', () => {
  it('orders money, then cards, then loans, leaving out empty groups and keeping order within one', () => {
    const groups = accountGroups([
      account({ id: 1, name: 'Ease Cash', type: 'Loan', currency: 'NGN' }),
      account({ id: 2, name: 'Lloyds' }),
      account({ id: 3, name: 'PalmPay', currency: 'NGN' }),
    ]);
    expect(groups.map((g) => [g.label, g.accounts.map(accountLabel)])).toEqual([
      ['Money', ['Lloyds', 'PalmPay (NGN)']],
      ['Loans', ['Ease Cash (NGN)']],
    ]);
  });
});

const lloyds = account({ id: 1, name: 'Lloyds' });
const palmpay = account({ id: 2, name: 'PalmPay', currency: 'NGN' });
const easeCash = account({ id: 3, name: 'Ease Cash', type: 'Loan', currency: 'NGN', monthlyPayment: 15000 });
const aqua = account({ id: 4, name: 'Aqua', type: 'CreditCard', balance: 920, creditLimit: 1000, availableCredit: 80, monthlyPayment: 60 });

describe('payDraft', () => {
  it('pays a naira loan from a naira account with the instalment filled in', () => {
    expect(payDraft(easeCash, [lloyds, palmpay, easeCash])).toEqual({
      type: 'Transfer', accountId: 2, toAccountId: 3, amount: 15000, description: 'Payment to Ease Cash',
    });
  });

  it('pays across currencies from the first current account, leaving the amount to enter', () => {
    expect(payDraft(easeCash, [lloyds, easeCash])).toMatchObject({ accountId: 1, amount: undefined });
    expect(payDraft(aqua, [lloyds, palmpay])).toMatchObject({ accountId: 1, amount: 60 });
  });
});

describe('the account cards', () => {
  it('lists the other currencies once', () => {
    expect(foreignCurrencies([lloyds, palmpay, easeCash])).toEqual(['NGN']);
  });

  it("shows a card's credit used", () => {
    expect(creditUsage(aqua)).toEqual({ used: 0.92, tone: 'negative', note: '£80.00 available of £1,000.00' });
    expect(creditUsage(lloyds)).toBeNull();
  });

  it('says when a debt is paid off, or that it never will be', () => {
    const p: PayoffProjection = { canBePaidOff: true, months: 14, payoffDate: '2027-12-01', totalInterest: 123.4, totalPaid: 0 };
    expect(payoffStat(p, 'GBP')).toEqual({ value: 'Dec 2027', clears: true, sub: '14 months · £123.40 interest' });
    expect(payoffStat({ ...p, canBePaidOff: false }, 'GBP')).toMatchObject({ value: 'Never', sub: 'Payment is below the interest' });
  });
});

describe('the what-if', () => {
  const p = (months: number, interest: number, can = true): PayoffProjection =>
    ({ canBePaidOff: can, months, payoffDate: '2027-06-01', totalInterest: interest, totalPaid: 0 });

  it('starts at half as much again as the planned payment', () => {
    expect(defaultWhatIfPayment(aqua)).toBe(90);
  });

  it('compares with the current plan', () => {
    expect(whatIfSummary({ current: p(20, 300), whatIf: p(12, 180), monthsSaved: 8, interestSaved: 120 }, 90, 'GBP')).toEqual({
      clears: true, cleared: 'Jun 2027', months: '12 months', interest: '£180.00', compared: '8 months sooner', better: true,
      interestSaved: '£120.00 less interest',
    });
    expect(whatIfSummary({ current: p(10, 100), whatIf: p(12, 120), monthsSaved: -2, interestSaved: -20 }, 50, 'GBP'))
      .toMatchObject({ compared: '2 months later', better: false, interestSaved: null });
    expect(whatIfSummary({ current: p(0, 0, false), whatIf: p(30, 500), monthsSaved: 0, interestSaved: 0 }, 50, 'GBP'))
      .toMatchObject({ compared: 'Clears it at all', better: true });
  });

  it('says when the payment never clears it', () => {
    expect(whatIfSummary({ current: p(1, 1), whatIf: p(0, 0, false), monthsSaved: 0, interestSaved: 0 }, 5000, 'NGN')).toEqual({
      clears: false, message: 'At ₦5,000.00 a month the interest outpaces the payment, so it never clears.',
    });
  });
});
