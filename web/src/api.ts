import type { Transaction, CreateTransaction, MonthlySummary, DebtsOverview, AvalanchePlan } from './types';

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

export async function getMonthlySummary(): Promise<MonthlySummary> {
  const res = await fetch('/api/summary/monthly');
  if (!res.ok) throw new Error('Failed to load summary');
  return res.json();
}

export async function getDebts(): Promise<DebtsOverview> {
  const res = await fetch('/api/debts');
  if (!res.ok) throw new Error('Failed to load debts');
  return res.json();
}

export async function getAvalanchePlan(extra = 0): Promise<AvalanchePlan> {
  const res = await fetch(`/api/debts/avalanche?extra=${extra}`);
  if (!res.ok) throw new Error('Failed to load avalanche plan');
  return res.json();
}