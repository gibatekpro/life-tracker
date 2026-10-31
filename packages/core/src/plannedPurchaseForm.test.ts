import { describe, expect, it } from 'vitest';

import {
  addMoneyDraft, boughtFormValues, buildBoughtRequest, buildPurchaseRequest, freeSavingsAccounts, purchaseFormValues, purchasePreview,
  targetMonthChoices, type PurchaseFormValues,
} from './plannedPurchaseForm';
import { account, category, plannedPurchase } from './testData';

const now = '2026-11';
const form = (v: Partial<PurchaseFormValues>): PurchaseFormValues => ({ ...purchaseFormValues(undefined, now), name: 'Visa fees', target: '3990', ...v });

describe('the planned purchase form', () => {
  it('previews the other two figures live from the one chosen', () => {
    const preview = purchasePreview(form({ choice: 'targetMonth', targetMonth: '2027-01' }), 0, now, false);
    expect(preview).toMatchObject({
      kind: 'plan',
      figures: [{ label: 'Each month', value: '£1,330.00' }, { label: 'Months', value: '3' }, { label: 'Done by', value: 'January 2027' }],
      note: null,
    });
    expect(purchasePreview(form({ monthly: '1500' }), 1000, now, false))
      .toMatchObject({ kind: 'plan', note: '£1,000.00 already saved is taken off first. The last month is £1,490.00.' });
  });

  it("says what's missing or wrong instead", () => {
    expect(purchasePreview(form({ target: '' }), 0, now, false)).toEqual({ kind: 'missing', message: 'Enter the target to see a plan.' });
    expect(purchasePreview(form({ choice: 'months' }), 0, now, false)).toEqual({ kind: 'missing', message: 'Enter the number of months.' });
    expect(purchasePreview(form({ choice: 'targetMonth' }), 0, now, false))
      .toEqual({ kind: 'missing', message: 'Choose the last month to save in.' });
    expect(purchasePreview(form({ choice: 'months', months: '200' }), 0, now, false))
      .toEqual({ kind: 'error', message: 'Choose 1 to 120 months.' });
  });

  it('sends only the chosen way, and the account when one was picked', () => {
    expect(buildPurchaseRequest(form({ choice: 'months', months: '3', monthly: '99', isEssential: true, notes: ' Due Jan ', accountId: 4 }), 0, now, false))
      .toEqual({ request: { name: 'Visa fees', targetAmount: 3990, months: 3, isEssential: true, notes: 'Due Jan', accountId: 4 } });
    expect(buildPurchaseRequest(form({ name: ' ' }), 0, now, false).error).toBe('Enter a name.');
  });

  it('when editing one already reached, sends no plan', () => {
    const v = purchaseFormValues(plannedPurchase({ saved: 4000, targetMonth: '2026-10' }), now);
    expect(v).toMatchObject({ monthly: '1330', months: '1', targetMonth: '2026-11' });
    expect(purchasePreview(v, 4000, now, true).kind).toBe('reached');
    expect(buildPurchaseRequest(v, 4000, now, true).request)
      .toEqual({ name: 'Visa fees', targetAmount: 3990, isEssential: true, notes: null });
  });

  it('offers five years of target months, and only free pound savings accounts', () => {
    const months = targetMonthChoices(now);
    expect([months.length, months[0], months[59].value]).toEqual([60, { value: '2026-11', label: 'November 2026' }, '2031-10']);
    const free = freeSavingsAccounts([
      account({ id: 1, name: 'Lloyds' }), account({ id: 2, name: 'Pot', type: 'Savings' }),
      account({ id: 3, name: 'Naira pot', type: 'Savings', currency: 'NGN' }), account({ id: 9, name: 'Visa fees', type: 'Savings' }),
    ], [plannedPurchase()]);
    expect(free.map((a) => a.id)).toEqual([2]);
  });
});

describe('adding money and buying it', () => {
  const lloyds = account({ id: 1, name: 'Lloyds' });
  const revolut = account({ id: 2, name: 'Revolut' });
  const palmPay = account({ id: 3, name: 'PalmPay', currency: 'NGN' });

  it('transfers this month\'s amount from the default pound current account', () => {
    expect(addMoneyDraft(plannedPurchase(), [lloyds, revolut], 2)).toEqual({
      type: 'Transfer', accountId: 2, toAccountId: 9, amount: 1330, description: 'Saving for Visa fees',
    });
    expect(addMoneyDraft(plannedPurchase({ remaining: 90 }), [palmPay, lloyds], 3)).toMatchObject({ accountId: 1, amount: 90 });
    expect(addMoneyDraft(plannedPurchase(), [palmPay], null)).toMatchObject({ accountId: 3, amount: undefined });
  });

  it('starts at what is saved, up to the target, and checks the cost and category', () => {
    const categories = [category({ id: 5, name: 'Bills' })];
    expect(boughtFormValues(plannedPurchase({ saved: 4000 }), categories, '2027-01-10'))
      .toEqual({ amount: '3990', categoryId: 5, date: '2027-01-10', description: 'Visa fees' });
    expect(boughtFormValues(plannedPurchase(), [...categories, category({ id: 8, name: 'Other' })], '2027-01-10').categoryId).toBe(8);
    const v = boughtFormValues(plannedPurchase(), categories, '2027-01-10');
    expect(buildBoughtRequest(v).error).toBe('Enter what it cost.');
    expect(buildBoughtRequest({ ...v, amount: '3990', categoryId: undefined }).error).toBe('Choose a category.');
    expect(buildBoughtRequest({ ...v, amount: '3990', description: '' }).request).toEqual({ amount: 3990, categoryId: 5, date: '2027-01-10' });
  });
});
