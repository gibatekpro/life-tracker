import type { Transaction, CreateTransaction } from './types';

export async function getTransactions(): Promise<Transaction[]> {
  const res = await fetch('/api/transactions');
  if (!res.ok) throw new Error('Failed to load transactions');
  return res.json();
}

export async function createTransaction(t: CreateTransaction): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(t),
  });
  if (!res.ok) throw new Error('Failed to save transaction');
  return res.json();
}