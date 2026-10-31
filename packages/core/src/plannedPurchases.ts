import type { NotePart } from './budget';
import { formatMoney, formatMonthYear, monthName } from './format';
import { parseYm, shiftMonth } from './months';
import type { BudgetMonth, PlannedPurchase, SavingsLine } from './types';

// The maths of saving for something, the same as the API's PlannedPurchaseCalculator (and tested
// with the same cases), so a form can preview a plan as I type. Months are "2027-01" strings; the
// target month is the last month I save in. Worked in whole pennies, so 1.10 ÷ 0.10 is exactly 11.

export const maxPlanMonths = 120;

// How I choose a plan: one of these, and the other two are worked out.
export type PlanBy =
  | { by: 'monthly'; amount: number }
  | { by: 'months'; months: number }
  | { by: 'targetMonth'; month: string };

// monthlyAmount for `months` months, ending in targetMonth; the last month is lastAmount, which may be smaller.
export interface PurchasePlan {
  monthlyAmount: number;
  months: number;
  targetMonth: string;
  lastAmount: number;
}

export type PlanResult = { plan: PurchasePlan; error?: undefined } | { plan?: undefined; error: string };

// Whole months from one month to another: "2026-11" to "2027-01" is 2.
export function monthsBetween(from: string, to: string) {
  const a = parseYm(from);
  const b = parseYm(to);
  return (b.year - a.year) * 12 + b.month - a.month;
}

const pennies = (pounds: number) => Math.round(pounds * 100);
const pounds = (p: number) => p / 100;
// Both whole numbers, so a whole-number answer comes out exact and rounding up is safe.
const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

export function planPurchase(target: number, saved: number, currentMonth: string, by: PlanBy): PlanResult {
  const t = pennies(target);
  if (!(t > 0)) return { error: 'Enter a target above zero.' };
  const remaining = t - Math.max(0, pennies(saved));
  if (remaining <= 0) return { error: `That's already saved: ${formatMoney(saved)} of ${formatMoney(pounds(t))}.` };

  // The monthly amount, rounded up so the months cover it; the count follows from it, so the last
  // month takes what's left (smaller, never zero).
  const ok = (monthly: number): PlanResult => {
    const months = ceilDiv(remaining, monthly);
    return {
      plan: {
        monthlyAmount: pounds(monthly),
        months,
        targetMonth: shiftMonth(currentMonth, months - 1),
        lastAmount: pounds(remaining - monthly * (months - 1)),
      },
    };
  };

  switch (by.by) {
    case 'monthly': {
      const amount = pennies(by.amount);
      if (!(amount > 0)) return { error: 'Enter a monthly amount above zero.' };
      const needed = ceilDiv(remaining, amount);
      if (needed > maxPlanMonths)
        return { error: `At ${formatMoney(pounds(amount))} a month that takes ${needed} months; the most is ${maxPlanMonths}.` };
      return ok(amount);
    }
    case 'months':
      if (!Number.isInteger(by.months) || by.months < 1 || by.months > maxPlanMonths)
        return { error: `Choose 1 to ${maxPlanMonths} months.` };
      return ok(ceilDiv(remaining, by.months));
    case 'targetMonth': {
      if (by.month < currentMonth) return { error: "The target month can't be in the past." };
      const count = monthsBetween(currentMonth, by.month) + 1;
      if (count > maxPlanMonths) return { error: `Choose a target month within ${maxPlanMonths} months.` };
      return ok(ceilDiv(remaining, count));
    }
  }
}

// A planned purchase now. saved is its account's balance; contributed* are the transfers in since
// startMonth, before this month and in it.
export interface PurchaseProgressInput {
  target: number;
  saved: number;
  monthlyAmount: number;
  startMonth: string;
  targetMonth: string;
  currentMonth: string;
  contributedBefore: number;
  contributedThisMonth: number;
}

// percent is rounded down (99.9% until it's really there). neededByNow: what should be saved by now for
// the monthly amount to reach the target by the target month. expectedFinish: the month it's reached at
// the pace so far, or null if that's not within maxPlanMonths (or nothing is coming in).
export interface PurchaseProgress {
  saved: number;
  remaining: number;
  percent: number;
  neededByNow: number;
  onTrack: boolean;
  monthsLeft: number;
  expectedFinish: string | null;
}

export function purchaseProgress(p: PurchaseProgressInput): PurchaseProgress {
  const target = pennies(p.target);
  const saved = Math.max(0, pennies(p.saved));
  const monthly = pennies(p.monthlyAmount);
  const remaining = Math.max(0, target - saved);
  const percent = target > 0 ? Math.min(100, Math.floor((saved * 1000) / target) / 10) : 0;

  // Counting this month: on track means the monthly amount over the months left still gets there.
  const monthsLeft = Math.max(0, monthsBetween(p.currentMonth, p.targetMonth) + 1);
  const neededByNow = Math.max(0, target - monthly * monthsLeft);

  // The pace: what came in per month since the start. This month counts once its monthly amount is in;
  // until then a part payment is saved but doesn't drag the pace down, and the month is still open.
  // With no whole month to go on yet, the plan.
  const thisMonth = pennies(p.contributedThisMonth);
  const paidThisMonth = thisMonth > 0 && thisMonth >= monthly;
  const counted = Math.max(0, monthsBetween(p.startMonth, p.currentMonth)) + (paidThisMonth ? 1 : 0);
  const contributed = pennies(p.contributedBefore) + (paidThisMonth ? thisMonth : 0);
  const more = counted === 0 ? (monthly > 0 ? ceilDiv(remaining, monthly) : Infinity)
    : contributed > 0 ? ceilDiv(remaining * counted, contributed) : Infinity;

  // This month is still a saving month until its amount is in.
  const expectedFinish = remaining === 0 ? p.currentMonth
    : more <= maxPlanMonths ? shiftMonth(p.currentMonth, more - (paidThisMonth ? 0 : 1)) : null;

  return {
    saved: pounds(saved),
    remaining: pounds(remaining),
    percent,
    neededByNow: pounds(neededByNow),
    onTrack: remaining === 0 || saved >= neededByNow,
    monthsLeft,
    expectedFinish,
  };
}

// ---- The pages (web: PlannedPurchasesPage, PlannedPurchaseDetailPage; phone: planned-purchases/) ----

// "2027-01" as "Jan 2027", or in full as "January 2027".
export const formatYm = (ym: string) => formatMonthYear(`${ym}-01`);
export const formatYmLong = (ym: string) => { const { year, month } = parseYm(ym); return monthName(year, month); };

export type PurchaseTone = 'positive' | 'warning' | 'neutral' | 'accent';

const isSaving = (p: PlannedPurchase) => p.status === 'Active' || p.status === 'Achieved';

// The badge: reached, on track or behind while saving; bought or cancelled once finished.
export function purchaseStatus(p: PlannedPurchase): { label: string; tone: PurchaseTone } {
  switch (p.status) {
    case 'Bought': return { label: 'Bought', tone: 'neutral' };
    case 'Cancelled': return { label: 'Cancelled', tone: 'neutral' };
    case 'Achieved': return { label: 'Reached', tone: 'positive' };
    default: return p.onTrack ? { label: 'On track', tone: 'positive' } : { label: 'Behind', tone: 'warning' };
  }
}

// What a card and the detail show. finish: when it should be reached at the pace so far (late: after
// the target month, or not at all); expected: the same under an "Expected" label. behind: how far
// short of where it should be by now.
export function purchaseFigures(p: PlannedPurchase) {
  const saving = p.status === 'Active';
  const late = saving && (p.expectedFinish === null || p.expectedFinish > p.targetMonth);
  return {
    saved: `${formatMoney(p.saved)} of ${formatMoney(p.targetAmount)}`,
    percent: `${p.percent}%`,
    progress: p.targetAmount > 0 ? p.saved / p.targetAmount : 0,
    progressTone: (p.status === 'Achieved' || p.status === 'Bought' ? 'positive' : saving && !p.onTrack ? 'warning' : 'accent') as
      'positive' | 'warning' | 'accent',
    monthly: `${formatMoney(p.monthlyAmount)} a month`,
    target: `By ${formatYm(p.targetMonth)}`,
    finish: p.status === 'Achieved' ? 'Target reached'
      : p.status === 'Bought' ? 'Bought'
      : p.status === 'Cancelled' ? `${formatMoney(p.saved)} still in ${p.accountName}`
      : p.expectedFinish ? `Expected ${formatYm(p.expectedFinish)}` : 'Not at this pace',
    expected: p.status === 'Achieved' ? 'Reached' : p.status !== 'Active' ? '—'
      : p.expectedFinish ? formatYm(p.expectedFinish) : 'Not at this pace',
    late,
    behind: saving && !p.onTrack ? `${formatMoney(Math.max(0, p.neededByNow - p.saved))} behind` : null,
    left: saving ? `${formatMoney(p.remaining)} to go · ${p.monthsLeft} month${p.monthsLeft === 1 ? '' : 's'} left` : null,
  };
}

// The list: what I'm saving for, then what's finished (bought or cancelled). Empty groups are left out.
// The API already sends them in order (by target month).
export function purchaseGroups(purchases: PlannedPurchase[]) {
  return [
    { label: 'Saving', items: purchases.filter(isSaving) },
    { label: 'Finished', items: purchases.filter((p) => !isSaving(p)) },
  ].filter((g) => g.items.length > 0);
}

// Home's card: up to three I'm saving for, and what's saved across all of them (null with none).
export function homePurchases(purchases: PlannedPurchase[]) {
  const saving = purchases.filter(isSaving);
  if (saving.length === 0) return null;
  const saved = saving.reduce((sum, p) => sum + p.saved, 0);
  const target = saving.reduce((sum, p) => sum + p.targetAmount, 0);
  return {
    items: saving.slice(0, 3),
    more: saving.length > 3 ? `and ${saving.length - 3} more` : null,
    summary: `${formatMoney(saved)} saved of ${formatMoney(target)}`,
  };
}

export const canChangePurchase = (p: PlannedPurchase) => isSaving(p);

export const cancelPurchaseMessage = (p: PlannedPurchase) =>
  p.saved > 0
    ? `The ${formatMoney(p.saved)} saved stays in ${p.accountName} until you move it.`
    : 'Nothing has been saved for it yet.';

// ---- The budget's Savings section (web: SavingsLineRow; phone: SavingsLineRow) ----

export const savingsCardDescription = (b: BudgetMonth) =>
  `${formatMoney(b.savingsPaid)} saved of ${formatMoney(b.plannedSavings)} planned`;

// A planned purchase's line note: how much is still to put aside this month, and when the line is
// smaller than usual because only that much was still needed.
export function savingsLineNote(s: SavingsLine) {
  const usual = s.monthAmount ?? s.defaultAmount;
  const parts: NotePart[] = [
    s.planned === 0 ? (s.stillNeeded <= 0 ? { text: 'Target reached', tone: 'positive' } : { text: 'Nothing planned this month' })
      : s.remaining <= 0 ? { text: 'Saved for this month', tone: 'positive' }
      : { text: `${formatMoney(s.remaining)} still to put aside` },
  ];
  if (s.planned > 0 && s.planned < usual) parts.push({ text: `only ${formatMoney(s.planned)} still needed` });
  return { parts, progressTone: (s.planned > 0 && s.remaining <= 0 ? 'positive' : 'accent') as 'positive' | 'accent' };
}
