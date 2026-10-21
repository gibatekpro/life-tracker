import { createContext, useContext } from 'react';
import type { Transaction, TransactionType } from '../../types';

// Any page can open the one transaction form: empty or partly filled in for a new transaction
// (e.g. "Pay" on a card opens a transfer to that card), or with an existing one to edit.
export interface TransactionDraft {
  type?: TransactionType;
  accountId?: number;
  toAccountId?: number;
  amount?: number;
  description?: string;
}

interface TransactionModal {
  add: (draft?: TransactionDraft) => void;
  edit: (transaction: Transaction) => void;
}

export const TransactionModalContext = createContext<TransactionModal>({ add: () => {}, edit: () => {} });

export const useQuickAdd = () => useContext(TransactionModalContext).add;
export const useEditTransaction = () => useContext(TransactionModalContext).edit;
