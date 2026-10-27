import type { TransactionDraft, TransactionType } from '@lifetracker/core';
import { router } from 'expo-router';

// Opening the transaction modal from anywhere, like the web's useQuickAdd and useEditTransaction.
// Route params are strings, so a draft travels as ?type=Transfer&accountId=3&amount=15000…

export type TransactionParams = Partial<Record<'id' | keyof TransactionDraft, string>>;

// A new transaction, blank or partly filled in (e.g. "Pay" on a debt: a transfer to it).
export function openNewTransaction(draft: TransactionDraft = {}) {
  const params: TransactionParams = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value !== undefined) params[key as keyof TransactionDraft] = String(value);
  }
  router.push({ pathname: '/transaction', params });
}

export function openTransactionToEdit(id: number) {
  router.push({ pathname: '/transaction', params: { id: String(id) } });
}

const types: TransactionType[] = ['Expense', 'Income', 'Transfer'];
const num = (s: string | undefined) => (s === undefined || s === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

export function draftFromParams(p: TransactionParams): TransactionDraft {
  return {
    type: types.find((t) => t === p.type),
    accountId: num(p.accountId),
    toAccountId: num(p.toAccountId),
    amount: num(p.amount),
    description: p.description,
  };
}
