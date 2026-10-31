import { formatMoney, formatMonthYear } from './format';
import type { TransactionDraft } from './transactionForm';
import type { Account, AccountType, PayoffProjection, WhatIfComparison } from './types';

export const typeLabel: Record<AccountType, string> = {
  Current: 'Current account',
  Savings: 'Savings account',
  CreditCard: 'Credit card',
  Loan: 'Loan',
};

// Money I owe (cards and loans); everything else is money I have.
export const isDebtType = (type: AccountType) => type === 'CreditCard' || type === 'Loan';
export const isDebt = (a: Account) => isDebtType(a.type);

// The accounts Apple Pay can spend from: anything but a savings account.
export const captureAccounts = (accounts: Account[]) => accounts.filter((a) => a.type !== 'Savings');

// "Pay" on a debt opens the transaction form as a transfer to it, from a current account in the
// same currency if I have one (PalmPay for a naira loan), with the usual instalment filled in.
// Paying across currencies, the amount sent depends on the rate, so it's left for me to enter.
export function payDraft(debt: Account, accounts: Account[]): TransactionDraft {
  const current = accounts.filter((a) => a.type === 'Current');
  const from = current.find((a) => a.currency === debt.currency) ?? current[0];
  return {
    type: 'Transfer',
    accountId: from?.id,
    toAccountId: debt.id,
    amount: from?.currency === debt.currency ? debt.monthlyPayment : undefined,
    description: `Payment to ${debt.name}`,
  };
}

// The currencies other than pounds that my accounts use, each once, in the order they appear.
export const foreignCurrencies = (accounts: Account[]) => [...new Set(accounts.map((a) => a.currency).filter((c) => c !== 'GBP'))];

// How much of a card's limit is used, for its bar: null without a limit.
export function creditUsage(a: Account) {
  if (!a.creditLimit) return null;
  const used = a.balance / a.creditLimit;
  return {
    used,
    tone: (used > 0.9 ? 'negative' : used > 0.75 ? 'warning' : 'accent') as 'negative' | 'warning' | 'accent',
    note: `${formatMoney(a.availableCredit ?? 0, a.currency)} available of ${formatMoney(a.creditLimit, a.currency)}`,
  };
}

// The "Paid off" figure for a debt: the month it clears, or never when the payment doesn't cover the interest.
export const payoffStat = (p: PayoffProjection, currency: string) => (p.canBePaidOff
  ? { value: formatMonthYear(p.payoffDate), clears: true, sub: `${p.months} months · ${formatMoney(p.totalInterest, currency)} interest` }
  : { value: 'Never', clears: false, sub: 'Payment is below the interest' });

// What a what-if payment starts at: half as much again as the planned payment.
export const defaultWhatIfPayment = (debt: Account) => Math.round(debt.monthlyPayment * 1.5);

// The what-if result in words: never clears, or when it clears and how that compares with now.
export function whatIfSummary(r: WhatIfComparison, payment: number, currency: string) {
  if (!r.whatIf.canBePaidOff)
    return { clears: false as const, message: `At ${formatMoney(payment, currency)} a month the interest outpaces the payment, so it never clears.` };
  return {
    clears: true as const,
    cleared: formatMonthYear(r.whatIf.payoffDate),
    months: `${r.whatIf.months} months`,
    interest: formatMoney(r.whatIf.totalInterest, currency),
    compared: !r.current.canBePaidOff ? 'Clears it at all'
      : r.monthsSaved > 0 ? `${r.monthsSaved} months sooner` : r.monthsSaved < 0 ? `${-r.monthsSaved} months later` : 'Same time',
    better: !r.current.canBePaidOff || r.monthsSaved > 0,
    interestSaved: r.interestSaved > 0 ? `${formatMoney(r.interestSaved, currency)} less interest` : null,
  };
}

// An account as a picker shows it: "PalmPay (NGN)", or just the name in pounds.
export const accountLabel = (a: Account) => `${a.name}${a.currency !== 'GBP' ? ` (${a.currency})` : ''}`;

// Accounts grouped the way I think about them: money I have, then what I owe. Empty groups are left out.
export const accountGroupOrder: { label: string; types: AccountType[] }[] = [
  { label: 'Money', types: ['Current'] },
  { label: 'Savings', types: ['Savings'] },
  { label: 'Credit cards', types: ['CreditCard'] },
  { label: 'Loans', types: ['Loan'] },
];

export function accountGroups(accounts: Account[]) {
  return accountGroupOrder
    .map((g) => ({ label: g.label, accounts: accounts.filter((a) => g.types.includes(a.type)) }))
    .filter((g) => g.accounts.length > 0);
}
