import { firstCategoryFor, type TransactionDraft } from './transactionForm';
import { formatMoney } from './format';
import { shiftMonth } from './months';
import {
  formatYmLong, maxPlanMonths, monthsBetween, planPurchase, type PlanBy, type PurchasePlan,
} from './plannedPurchases';
import type { Account, Category, CreatePlannedPurchase, MarkBought, PlannedPurchase } from './types';

// The planned purchase forms (web: PlannedPurchaseForm, BoughtForm; phone: planned-purchase-form,
// planned-purchase-bought). The plan is chosen one way and the other two are previewed live with the
// same calculator the API saves with, so what's shown is what's saved.

export type PlanChoice = PlanBy['by'];

export const planChoices: { value: PlanChoice; label: string }[] = [
  { value: 'monthly', label: 'Monthly amount' },
  { value: 'months', label: 'Months' },
  { value: 'targetMonth', label: 'By month' },
];

// What the form holds, numbers as typed. accountId (adding only): an existing savings account, or
// null for a new one made with it.
export interface PurchaseFormValues {
  name: string;
  target: string;
  choice: PlanChoice;
  monthly: string;
  months: string;
  targetMonth: string;
  isEssential: boolean;
  notes: string;
  accountId: number | null;
}

// A blank form, or the one being edited with its plan filled into all three ways (so switching
// between them starts from the current plan).
export function purchaseFormValues(p: PlannedPurchase | undefined, currentMonth: string): PurchaseFormValues {
  if (!p) return { name: '', target: '', choice: 'monthly', monthly: '', months: '', targetMonth: '', isEssential: false, notes: '', accountId: null };
  const last = p.targetMonth < currentMonth ? currentMonth : p.targetMonth;
  return {
    name: p.name, target: String(p.targetAmount), choice: 'monthly', monthly: String(p.monthlyAmount),
    months: String(monthsBetween(currentMonth, last) + 1), targetMonth: last,
    isEssential: p.isEssential, notes: p.notes ?? '', accountId: p.accountId,
  };
}

// The months "By month" offers: this one and the next five years.
export const targetMonthChoices = (currentMonth: string, count = 60) =>
  Array.from({ length: count }, (_, i) => shiftMonth(currentMonth, i)).map((value) => ({ value, label: formatYmLong(value) }));

// Savings accounts a new planned purchase can save in: in pounds and not already saving for something.
export const freeSavingsAccounts = (accounts: Account[], purchases: PlannedPurchase[]) =>
  accounts.filter((a) => a.type === 'Savings' && a.currency === 'GBP' && !purchases.some((p) => p.accountId === a.id));

const blank = (s: string) => s.trim() === '';

function chosen(v: PurchaseFormValues): PlanBy | null {
  switch (v.choice) {
    case 'monthly': return blank(v.monthly) ? null : { by: 'monthly', amount: Number(v.monthly) };
    case 'months': return blank(v.months) ? null : { by: 'months', months: Number(v.months) };
    case 'targetMonth': return blank(v.targetMonth) ? null : { by: 'targetMonth', month: v.targetMonth };
  }
}

// The live preview under the plan: the three figures, or what's missing or wrong. reached: editing one
// whose savings already cover the target, so there's nothing left to plan (and none is sent).
export type PurchasePreview =
  | { kind: 'plan'; plan: PurchasePlan; figures: { label: string; value: string }[]; note: string | null }
  | { kind: 'reached'; message: string }
  | { kind: 'missing'; message: string }
  | { kind: 'error'; message: string };

export function purchasePreview(v: PurchaseFormValues, saved: number, currentMonth: string, editing: boolean): PurchasePreview {
  const target = Number(v.target);
  if (blank(v.target) || !(target > 0)) return { kind: 'missing', message: 'Enter the target to see a plan.' };
  if (editing && saved >= target)
    return { kind: 'reached', message: `Already saved: ${formatMoney(saved)} of ${formatMoney(target)}. Nothing more to put aside.` };
  const by = chosen(v);
  if (!by) return { kind: 'missing', message: v.choice === 'targetMonth' ? 'Choose the last month to save in.' : `Enter the ${v.choice === 'monthly' ? 'monthly amount' : 'number of months'}.` };

  const result = planPurchase(target, saved, currentMonth, by);
  if (!result.plan) return { kind: 'error', message: result.error };
  const p = result.plan;
  return {
    kind: 'plan',
    plan: p,
    figures: [
      { label: 'Each month', value: formatMoney(p.monthlyAmount) },
      { label: 'Months', value: String(p.months) },
      { label: 'Done by', value: formatYmLong(p.targetMonth) },
    ],
    note: [
      saved > 0 ? `${formatMoney(saved)} already saved is taken off first.` : null,
      p.months > 1 && p.lastAmount < p.monthlyAmount ? `The last month is ${formatMoney(p.lastAmount)}.` : null,
    ].filter(Boolean).join(' ') || null,
  };
}

// The request, sending only the chosen way (the API works out the rest exactly as the preview did),
// or what's wrong first.
export function buildPurchaseRequest(v: PurchaseFormValues, saved: number, currentMonth: string, editing: boolean):
  { request: CreatePlannedPurchase; error?: undefined } | { request?: undefined; error: string } {
  if (blank(v.name)) return { error: 'Enter a name.' };
  const preview = purchasePreview(v, saved, currentMonth, editing);
  if (preview.kind === 'missing' || preview.kind === 'error') return { error: preview.message };

  const by = preview.kind === 'plan' ? chosen(v) : null;
  const request: CreatePlannedPurchase = {
    name: v.name.trim(),
    targetAmount: Number(v.target),
    isEssential: v.isEssential,
    notes: blank(v.notes) ? null : v.notes.trim(),
  };
  if (by?.by === 'monthly') request.monthlyAmount = by.amount;
  if (by?.by === 'months') request.months = by.months;
  if (by?.by === 'targetMonth') request.targetMonth = by.month;
  if (!editing && v.accountId !== null) request.accountId = v.accountId;
  return { request };
}

export const purchaseNamePlaceholder = 'e.g. Visa fees';
export const essentialHint = 'A need, like a visa fee, rather than a want. Advice treats a need with a deadline as coming first.';
export const newAccountLabel = 'A new savings account';
export const monthsHint = `1 to ${maxPlanMonths}`;

// "Add money": a transfer into its savings account from my default current account (the Apple Pay
// default, if that's a pound current account; otherwise my first pound current account), with this
// month's amount filled in (never more than is still needed).
export function addMoneyDraft(p: PlannedPurchase, accounts: Account[], defaultAccountId: number | null): TransactionDraft {
  const current = accounts.filter((a) => a.type === 'Current');
  const from = current.find((a) => a.id === defaultAccountId && a.currency === 'GBP')
    ?? current.find((a) => a.currency === 'GBP') ?? current[0];
  const amount = Math.min(p.monthlyAmount, p.remaining);
  return {
    type: 'Transfer',
    accountId: from?.id,
    toAccountId: p.accountId,
    amount: from?.currency === 'GBP' && amount > 0 ? amount : undefined,
    description: `Saving for ${p.name}`,
  };
}

// "Mark as bought": an expense from its savings account. It starts at what's saved (up to the target).
export interface BoughtFormValues {
  amount: string;
  categoryId: number | undefined;
  date: string;
  description: string;
}

export const boughtFormValues = (p: PlannedPurchase, categories: Category[], today: string): BoughtFormValues => ({
  amount: p.saved > 0 ? String(Math.min(p.saved, p.targetAmount)) : '',
  categoryId: firstCategoryFor(categories, 'Expense'),
  date: today,
  description: p.name,
});

export const boughtNote = (p: PlannedPurchase) =>
  `Recorded as an expense from ${p.accountName} (${formatMoney(p.saved)} saved). Anything left over stays there.`;

export function buildBoughtRequest(v: BoughtFormValues):
  { request: MarkBought; error?: undefined } | { request?: undefined; error: string } {
  const amount = Number(v.amount);
  if (blank(v.amount) || !(amount > 0)) return { error: 'Enter what it cost.' };
  if (v.categoryId === undefined) return { error: 'Choose a category.' };
  return {
    request: {
      amount, categoryId: v.categoryId, date: v.date,
      ...(blank(v.description) ? {} : { description: v.description.trim() }),
    },
  };
}
