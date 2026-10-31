import { describe, expect, it } from 'vitest';

import { accountFormValues, accountNamePlaceholder, balanceField, buildAccountRequest, showsLoanAppHint } from './accountForm';
import { account } from './testData';

const blank = accountFormValues();

describe('the account form', () => {
  it('starts as a pound current account, or with the account being edited', () => {
    expect(blank).toMatchObject({ type: 'Current', currency: 'GBP', balance: '', creditLimit: '' });
    expect(accountFormValues(account({ id: 1, name: 'Aqua', type: 'CreditCard', balance: 920, creditLimit: 1000, apr: 34.9 })))
      .toMatchObject({ name: 'Aqua', type: 'CreditCard', balance: '920', apr: '34.9', creditLimit: '1000' });
  });

  it('builds a current account, ignoring the debt fields', () => {
    expect(buildAccountRequest({ ...blank, name: ' Lloyds ', balance: '-12.5', apr: '20', creditLimit: '500' }).request).toEqual({
      name: 'Lloyds', type: 'Current', currency: 'GBP', balance: -12.5, apr: 0, minimumPayment: 0, monthlyPayment: 0, creditLimit: null,
    });
  });

  it('builds a card with its limit, and a loan app with no limit', () => {
    const card = { ...blank, name: 'Aqua', type: 'CreditCard' as const, balance: '920', apr: '34.9', monthlyPayment: '60', creditLimit: '1000' };
    expect(buildAccountRequest(card).request).toMatchObject({ apr: 34.9, monthlyPayment: 60, minimumPayment: 0, creditLimit: 1000 });
    const loan = { ...card, type: 'Loan' as const, currency: 'NGN' };
    expect(buildAccountRequest(loan).request?.creditLimit).toBeNull();
    expect(showsLoanAppHint(loan)).toBe(true);
    expect(showsLoanAppHint({ ...loan, currency: 'GBP' })).toBe(false);
  });

  it('says what is missing first, as the web form does', () => {
    expect(buildAccountRequest(blank).error).toBe('Enter a name.');
    expect(buildAccountRequest({ ...blank, name: 'X' }).error).toBe('Enter the balance.');
    expect(buildAccountRequest({ ...blank, name: 'X', type: 'Loan' }).error).toBe('Enter the amount owed.');
    expect(buildAccountRequest({ ...blank, name: 'X', type: 'Loan', balance: '5' }).error).toBe('Enter the monthly payment.');
    expect(buildAccountRequest({ ...blank, name: 'X', balance: '5a' }).error).toBe('Amounts must be numbers.');
  });

  it('suggests a name for each type', () => {
    expect(accountNamePlaceholder('Loan')).toBe('e.g. FairMoney');
    expect(accountNamePlaceholder('Savings')).toBe('e.g. Visa fees');
  });

  it('builds a savings account like a current one, but never overdrawn', () => {
    const savings = { ...blank, name: 'Visa fees', type: 'Savings' as const, balance: '0', monthlyPayment: '60' };
    expect(buildAccountRequest(savings).request).toMatchObject({ type: 'Savings', balance: 0, monthlyPayment: 0, apr: 0 });
    expect(buildAccountRequest({ ...savings, balance: '-1' }).error).toBe("A savings account's balance can't be negative.");
    expect(balanceField('Savings')).toEqual({ label: 'Balance', hint: undefined, allowNegative: false });
    expect(balanceField('Current')).toMatchObject({ hint: 'Can be negative if overdrawn', allowNegative: true });
    expect(balanceField('Loan')).toMatchObject({ label: 'Amount owed', allowNegative: false });
  });
});
