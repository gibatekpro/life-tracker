import type { AccountType } from '@lifetracker/core';
import type { IconName } from '../../components/ui/Icon';

// Each account type's icon. The labels, isDebt and payDraft are in core (accounts.ts), shared with the phone.
export const typeIcon: Record<AccountType, IconName> = {
  Current: 'bank',
  Savings: 'target',
  CreditCard: 'card',
  Loan: 'loan',
};
