import type { Transaction, CreateTransaction, MonthlySummary, DebtsOverview, AvalanchePlan, Settings } from './types';

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

export async function getSettings(): Promise<Settings> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function updateSettings(s: {
  monthlyIncome: number;
  monthlyDebtBudget: number | null;
}): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function recordDebtPayment(debtId: number, amount: number, date: string) {
  const res = await fetch(`/api/debts/${debtId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, date }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Failed to record payment');
  }
  return res.json();
}