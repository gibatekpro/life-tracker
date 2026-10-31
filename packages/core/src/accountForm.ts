import { isDebtType } from './accounts';
import type { Account, AccountType, SaveAccount } from './types';

// The rules of the account form (web: AccountForm): one form for a bank or savings account (just a
// balance), a credit card (what's owed, APR, payments, limit) and a loan, including Nigerian loan apps.

export const currencyChoices = [
  { code: 'GBP', label: 'GBP · British pound' },
  { code: 'NGN', label: 'NGN · Nigerian naira' },
  { code: 'EUR', label: 'EUR · Euro' },
  { code: 'USD', label: 'USD · US dollar' },
];

// What the form holds, numbers as typed.
export interface AccountFormValues {
  name: string;
  type: AccountType;
  currency: string;
  balance: string;
  apr: string;
  minimumPayment: string;
  monthlyPayment: string;
  creditLimit: string;
}

export const accountFormValues = (a?: Account): AccountFormValues => ({
  name: a?.name ?? '',
  type: a?.type ?? 'Current',
  currency: a?.currency ?? 'GBP',
  balance: a ? String(a.balance) : '',
  apr: a ? String(a.apr) : '',
  minimumPayment: a ? String(a.minimumPayment) : '',
  monthlyPayment: a ? String(a.monthlyPayment) : '',
  creditLimit: a?.creditLimit != null ? String(a.creditLimit) : '',
});

export const accountNamePlaceholder = (type: AccountType) =>
  ({ Current: 'e.g. Lloyds Current', Savings: 'e.g. Visa fees', CreditCard: 'e.g. Aqua', Loan: 'e.g. FairMoney' })[type];

// The balance field: what's owed on a card or loan; a current account can be overdrawn, a savings account can't.
export const balanceField = (type: AccountType) =>
  isDebtType(type) ? { label: 'Amount owed', hint: undefined, allowNegative: false }
    : type === 'Current' ? { label: 'Balance', hint: 'Can be negative if overdrawn', allowNegative: true }
      : { label: 'Balance', hint: undefined, allowNegative: false };

// Loan apps quote interest per month and add fees up front, so the total repayable already includes
// the interest; entering an APR as well would count it twice. The form explains that for a loan
// that isn't in pounds.
export const showsLoanAppHint = (v: AccountFormValues) => v.type === 'Loan' && v.currency !== 'GBP';

const notNumber = (s: string) => s.trim() !== '' && Number.isNaN(Number(s));

// The request to send, or what's missing first (what the web form's required fields catch).
export function buildAccountRequest(v: AccountFormValues):
  { request: SaveAccount; error?: undefined } | { request?: undefined; error: string } {
  const isDebt = isDebtType(v.type);
  if (v.name.trim() === '') return { error: 'Enter a name.' };
  if (v.balance.trim() === '') return { error: isDebt ? 'Enter the amount owed.' : 'Enter the balance.' };
  if (isDebt && v.monthlyPayment.trim() === '') return { error: 'Enter the monthly payment.' };
  if ([v.balance, ...(isDebt ? [v.apr, v.minimumPayment, v.monthlyPayment] : []), v.creditLimit].some(notNumber))
    return { error: 'Amounts must be numbers.' };
  if (!balanceField(v.type).allowNegative && Number(v.balance) < 0)
    return { error: isDebt ? "The amount owed can't be negative." : "A savings account's balance can't be negative." };
  return {
    request: {
      name: v.name.trim(),
      type: v.type,
      currency: v.currency,
      balance: Number(v.balance || 0),
      apr: isDebt ? Number(v.apr || 0) : 0,
      minimumPayment: isDebt ? Number(v.minimumPayment || 0) : 0,
      monthlyPayment: isDebt ? Number(v.monthlyPayment || 0) : 0,
      creditLimit: v.type === 'CreditCard' && v.creditLimit.trim() !== '' ? Number(v.creditLimit) : null,
    },
  };
}
