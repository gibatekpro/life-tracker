import type { AccountType } from '@lifetracker/core';
import type { SFSymbol } from 'expo-symbols';

// Each account type's icon (web: typeIcon in accountLabels.ts).
export const typeIcon: Record<AccountType, SFSymbol> = {
  Current: 'building.columns',
  CreditCard: 'creditcard',
  Loan: 'banknote',
};
