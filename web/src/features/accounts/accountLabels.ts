import type { Account, AccountType } from '@lifetracker/core';
import type { IconName } from '../../components/ui/Icon';
import type { TransactionDraft } from '../transactions/quickAdd';

export const typeLabel: Record<AccountType, string> = {
  Current: 'Current account',
  CreditCard: 'Credit card',
  Loan: 'Loan',
};

export const typeIcon: Record<AccountType, IconName> = {
  Current: 'bank',
  CreditCard: 'card',
  Loan: 'loan',
};

export const isDebt = (a: Account) => a.type !== 'Current';

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
