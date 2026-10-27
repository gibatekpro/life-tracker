import { describe, expect, it } from 'vitest';

import { account, category, rate, transaction } from './testData';
import {
  buildTransactionRequest, describeForm, firstCategoryFor, initialFormValues, suggestReceived,
  withAccount, withType, type TransactionFormValues,
} from './transactionForm';

const lloyds = account({ id: 1, name: 'Lloyds Current' });
const amex = account({ id: 2, name: 'Amex', type: 'CreditCard' });
const palmpay = account({ id: 3, name: 'PalmPay', currency: 'NGN' });
const fairmoney = account({ id: 4, name: 'FairMoney', type: 'Loan', currency: 'NGN' });
const accounts = [amex, lloyds, palmpay, fairmoney]; // a card first: a blank form still starts on Lloyds

const old = category({ id: 9, name: 'Old', isArchived: true });
const food = category({ id: 10, name: 'Food' });
const salary = category({ id: 20, name: 'Salary', kind: 'Income' });
const categories = [old, food, salary];

const rates = [rate('GBP', 'NGN', 2000), rate('NGN', 'GBP', 0.0005)];
const data = { accounts, categories, rates };
const today = '2026-10-27';

const blank = () => initialFormValues({ accounts, categories, today });
const form = (v: Partial<TransactionFormValues>) => ({ ...blank(), ...v });
const build = (v: TransactionFormValues) => buildTransactionRequest(v, describeForm(v, data));

describe('initialFormValues', () => {
  it('starts a blank form as an expense on the first current account, first live category, today', () => {
    expect(blank()).toMatchObject({ type: 'Expense', accountId: 1, categoryId: 10, date: today, amount: '', toAmountTyped: false });
  });

  it('fills in a draft (e.g. Pay on a debt)', () => {
    const v = initialFormValues({
      accounts, categories, today,
      draft: { type: 'Transfer', accountId: 3, toAccountId: 4, amount: 15000, description: 'Payment to FairMoney' },
    });
    expect(v).toMatchObject({ type: 'Transfer', accountId: 3, toAccountId: 4, amount: '15000', categoryId: undefined });
  });

  it("keeps an edited naira expense's £ value and a transfer's received amount", () => {
    const naira = initialFormValues({ accounts, categories, today,
      transaction: transaction({ id: 7, currency: 'NGN', amount: 5000, gbpAmount: 2.6, accountId: 3, date: '2026-10-01' }) });
    expect(naira).toMatchObject({ amount: '5000', gbpAmount: '2.6', date: '2026-10-01', categoryId: 1 });

    const transfer = initialFormValues({ accounts, categories, today, transaction: transaction({
      id: 8, type: 'Transfer', categoryId: null, accountId: 1, toAccountId: 3, toAmount: 19500, toCurrency: 'NGN' }) });
    expect(transfer).toMatchObject({ toAmount: '19500', toAmountTyped: true, gbpAmount: '', categoryId: undefined });
  });
});

describe('withType and withAccount', () => {
  it('switches to the first category of the new kind, and none for a transfer', () => {
    expect(withType(blank(), 'Income', categories).categoryId).toBe(20);
    expect(withType(blank(), 'Transfer', categories).categoryId).toBeUndefined();
    expect(firstCategoryFor(categories, 'Expense')).toBe(10); // skips the archived one
  });

  it('clears the destination when the source becomes the same account', () => {
    expect(withAccount(form({ toAccountId: 3 }), 3).toAccountId).toBeUndefined();
    expect(withAccount(form({ toAccountId: 3 }), 2).toAccountId).toBe(3);
  });
});

describe('describeForm: the received amount of a transfer between currencies', () => {
  const gbpToNgn = form({ type: 'Transfer', accountId: 1, toAccountId: 3, amount: '10' });

  it('is pre-filled from my GBP → NGN rate, to the penny', () => {
    const view = describeForm(gbpToNgn, data);
    expect(view.crossesCurrencies).toBe(true);
    expect(view.receivedShown).toBe('20000.00');
    expect(view.receivedHint).toBe('At 2,000 (your rate). Change it to what actually arrived.');
  });

  it('follows the amount until I type my own, then keeps mine and shows the rate it implies', () => {
    expect(describeForm({ ...gbpToNgn, amount: '12.5' }, data).receivedShown).toBe('25000.00');
    const typed = describeForm({ ...gbpToNgn, toAmount: '19500', toAmountTyped: true }, data);
    expect(typed.receivedShown).toBe('19500');
    expect(typed.receivedHint).toBe('1 GBP = 1,950 NGN');
  });

  it('is empty with no rate or no amount', () => {
    expect(describeForm(gbpToNgn, { ...data, rates: [] }).receivedShown).toBe('');
    expect(describeForm({ ...gbpToNgn, amount: '' }, data).receivedShown).toBe('');
    expect(suggestReceived(10, null)).toBe('');
  });

  it("doesn't ask for a received amount within one currency", () => {
    expect(describeForm(form({ type: 'Transfer', accountId: 3, toAccountId: 4 }), data).crossesCurrencies).toBe(false);
    expect(describeForm(form({ type: 'Transfer', accountId: 1, toAccountId: 2 }), data).crossesCurrencies).toBe(false);
  });
});

describe('describeForm: the £ value', () => {
  it('is asked for when neither side is in pounds, with an estimate at the rate', () => {
    const view = describeForm(form({ accountId: 3, amount: '5000' }), data);
    expect(view.asksForPounds).toBe(true);
    expect(view.estimatedPounds).toBe('£2.50');
  });

  it('is not asked for in pounds, or for a transfer into pounds', () => {
    expect(describeForm(form({ amount: '5' }), data).asksForPounds).toBe(false);
    expect(describeForm(form({ type: 'Transfer', accountId: 3, toAccountId: 1 }), data).asksForPounds).toBe(false);
  });
});

describe('buildTransactionRequest', () => {
  it('builds an expense', () => {
    expect(build(form({ amount: '12.40', description: ' Tesco ' })).request).toEqual({
      type: 'Expense', amount: 12.4, description: 'Tesco', categoryId: 10, date: today,
      accountId: 1, toAccountId: null, toAmount: null, gbpAmount: null,
    });
  });

  it('builds a GBP → NGN transfer with the pre-filled received amount and a default description', () => {
    expect(build(form({ type: 'Transfer', categoryId: undefined, accountId: 1, toAccountId: 3, amount: '10' })).request)
      .toEqual({
        type: 'Transfer', amount: 10, description: 'Transfer to PalmPay', categoryId: null, date: today,
        accountId: 1, toAccountId: 3, toAmount: 20000, gbpAmount: null,
      });
  });

  it('calls a transfer to a card or loan a payment, and sends a typed £ value for naira', () => {
    const pay = build(form({ type: 'Transfer', accountId: 3, toAccountId: 4, amount: '15000', gbpAmount: '7.80' })).request;
    expect(pay).toMatchObject({ description: 'Payment to FairMoney', toAmount: null, gbpAmount: 7.8 });
  });

  it('never sends a category for a transfer, or a £ value for something in pounds', () => {
    const v = form({ type: 'Transfer', categoryId: 10, accountId: 1, toAccountId: 2, amount: '50', gbpAmount: '1' });
    expect(build(v).request).toMatchObject({ categoryId: null, gbpAmount: null });
  });

  it('says what is missing first, as the web form does', () => {
    expect(build(form({ accountId: undefined })).error).toBe('Choose an account.');
    expect(build(form({ type: 'Transfer', amount: '5' })).error).toBe('Choose the account the money went to.');
    expect(build(form({ description: 'Tesco' })).error).toBe('Enter the amount.');
    expect(build(form({ amount: '5' })).error).toBe('Enter a description.');
    expect(build(form({ amount: 'abc', description: 'x' })).error).toBe('Enter the amount.');
    expect(build(form({ type: 'Transfer', accountId: 1, toAccountId: 3, amount: '10' })).error).toBeUndefined();
    const noRate = form({ type: 'Transfer', accountId: 1, toAccountId: 3, amount: '10' });
    expect(buildTransactionRequest(noRate, describeForm(noRate, { ...data, rates: [] })).error)
      .toBe('Enter the amount that arrived.');
  });
});
