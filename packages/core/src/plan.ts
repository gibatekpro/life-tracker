import { formatMoney, formatMonthYear } from './format';
import { approxPounds } from './rates';
import type { Account, AvalanchePlan, ExchangeRate, PlannedPayoff } from './types';

// The debt plan page (web: DebtPlanPage, ExtraSimulator, PayoffChart): the avalanche method pays every
// debt its normal payment and puts anything extra on the highest interest rate first; a cleared debt's
// payment rolls on to the next.

// The big figure: when the debts are gone, or why they never are at this budget.
export const planHeadline = (p: AvalanchePlan) => (p.canBePaidOff
  ? {
    clears: true as const, date: formatMonthYear(p.debtFreeDate),
    note: `${p.months} months · ${formatMoney(p.totalInterest)} interest · paying ${formatMoney(p.monthlyBudget)} a month`,
  }
  : { clears: false as const, message: `At ${formatMoney(p.monthlyBudget)} a month the debts can't be cleared within 50 years. Try a higher amount.` });

// The chart's rows: months until each debt is cleared, at the current budget and with the extra.
export const payoffChartRows = (baseline: AvalanchePlan, plan: AvalanchePlan) =>
  baseline.payoffs.map((p) => ({ id: p.id, name: p.name, now: p.month, withExtra: plan.payoffs.find((x) => x.id === p.id)?.month }));

export const payoffChartDescription = (extra: number) =>
  extra > 0 ? 'Months from now, at your current budget and with the extra.' : 'Months from now.';

export const payoffNote = (x: PlannedPayoff) => `Cleared ${formatMonthYear(x.payoffDate)} · month ${x.month}`;

// A debt in another currency: what's owed in it, and roughly in pounds. null for pounds.
export const foreignOwed = (a: Account | undefined, rates: ExchangeRate[] | undefined) =>
  !a || a.currency === 'GBP' ? null : `${formatMoney(a.balance, a.currency)} owed · ${approxPounds(a.balance, a.currency, rates)}`;

export const planMissingRates = (currencies: string[]) => (currencies.length === 0 ? null
  : `${currencies.join(', ')} debts aren't in this plan yet: record a transfer between pounds and ${currencies.join('/')} so they can be converted.`);

export const monthlyBudgetNote = (b: AvalanchePlan) =>
  `The plan pays ${formatMoney(b.monthlyBudget)} a month: your planned payments, or your fixed debt budget if it's higher. A fixed budget keeps a cleared card's payment working on the rest.`;

// "What if I paid a bit more each month?": the plan with the extra against the plan without.
export function extraOutcome(extra: number, b: AvalanchePlan, p: AvalanchePlan):
  { tone: 'muted' | 'positive'; headline: string; sub?: string } {
  if (extra === 0) return { tone: 'muted', headline: 'Drag the slider or type an amount.' };
  if (!p.canBePaidOff) return { tone: 'muted', headline: 'Still not enough to clear the debts.' };
  if (!b.canBePaidOff) return { tone: 'positive', headline: 'With the extra, the debts can be cleared.' };
  const monthsSaved = b.months - p.months;
  const interestSaved = b.totalInterest - p.totalInterest;
  return monthsSaved > 0
    ? { tone: 'positive', headline: `${monthsSaved} ${monthsSaved === 1 ? 'month' : 'months'} sooner`, sub: `and ${formatMoney(interestSaved)} less interest` }
    : { tone: 'positive', headline: `${formatMoney(interestSaved)} less interest`, sub: 'Same debt-free month, but cheaper.' };
}
