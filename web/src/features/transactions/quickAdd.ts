import { createContext, useContext } from 'react';
import type { TransactionType } from '../../types';

// Any page can open the one "New transaction" form, optionally filled in already
// (e.g. "Pay" on a card opens a transfer to that card).
export interface TransactionDraft {
  type?: TransactionType;
  accountId?: number;
  toAccountId?: number;
  amount?: number;
  description?: string;
}

export const QuickAddContext = createContext<(draft?: TransactionDraft) => void>(() => {});

export const useQuickAdd = () => useContext(QuickAddContext);
