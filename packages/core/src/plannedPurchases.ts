import { formatMoney } from './format';
import { parseYm, shiftMonth } from './months';

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

  // The pace: what came in per month since the start, counting this month once money has come in
  // (until then, this month's payment may still be on its way). With nothing to go on yet, the plan.
  const paidThisMonth = p.contributedThisMonth > 0;
  const counted = Math.max(0, monthsBetween(p.startMonth, p.currentMonth)) + (paidThisMonth ? 1 : 0);
  const contributed = pennies(p.contributedBefore) + pennies(p.contributedThisMonth);
  const more = counted === 0 ? (monthly > 0 ? ceilDiv(remaining, monthly) : Infinity)
    : contributed > 0 ? ceilDiv(remaining * counted, contributed) : Infinity;

  // This month still counts as a saving month until money has come in.
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
