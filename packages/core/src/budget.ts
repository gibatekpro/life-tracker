import { formatMoney } from './format';
import type { TreeNode } from './tree';
import type { BudgetLine, BudgetMonth, BudgetMonthView, Category, DebtLine } from './types';

export type LineTone = 'accent' | 'warning' | 'negative';

// Green while on track, amber when today's pace would overspend by month-end, red once over.
// Pace only matters while there's money left: a bill paid exactly in full (a £18 subscription)
// isn't heading anywhere, even though "£18 in 27 days" projects past £18.
export function lineTone(planned: number, spent: number, projected: number, daysLeft: number): LineTone {
  if (planned > 0 && spent > planned) return 'negative';
  if (planned > 0 && spent < planned && daysLeft > 0 && projected > planned) return 'warning';
  return 'accent';
}

// Every line in the tree, parents before their children.
export const flattenLines = (lines: BudgetLine[]): BudgetLine[] => lines.flatMap((l) => [l, ...flattenLines(l.children)]);

// The budget lines to keep an eye on: up to three without subcategories that are over (first)
// or heading over.
export function linesToWatch(b: BudgetMonth) {
  return flattenLines(b.lines)
    .map((line) => ({ line, tone: lineTone(line.planned, line.spent, line.projected, b.daysLeft) }))
    .filter((x) => x.tone !== 'accent' && x.line.children.length === 0)
    .sort((x, y) => (x.tone === 'negative' ? 0 : 1) - (y.tone === 'negative' ? 0 : 1))
    .slice(0, 3);
}

export const watchLabel = ({ line, tone }: { line: BudgetLine; tone: LineTone }) =>
  tone === 'negative' ? `${formatMoney(-line.remaining)} over` : `heading for ${formatMoney(line.projected)}`;

// "How much can I spend today?": the per-day figure ("—" once the month has no days left) and
// the line under it.
export function safeToSpendSummary(b: BudgetMonth) {
  return {
    perDay: b.daysLeft > 0 ? formatMoney(b.safeToSpendPerDay) : '—',
    negative: b.safeToSpend < 0,
    note: `${b.safeToSpend < 0
      ? `${formatMoney(-b.safeToSpend)} more is planned or spent than came in`
      : `${formatMoney(b.safeToSpend)} not spent or set aside`} · ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left`,
  };
}

// ---- The budget page (web: BudgetPage, BudgetLineRow, DebtLineRow, AmountEditor, AddLineForm) ----

// A piece of a line's note; the pieces are shown joined with " · ", each in its tone.
export interface NotePart {
  text: string;
  tone?: 'negative' | 'warning' | 'positive';
}

// The budget's lines (already a tree) as tree nodes for a collapsible list.
export const budgetTree = (lines: BudgetLine[]): TreeNode<BudgetLine>[] =>
  lines.map((l) => ({ id: l.categoryId, item: l, children: budgetTree(l.children) }));

export const budgetDaysNote = (b: BudgetMonth) =>
  b.daysLeft === 0 ? 'Finished' : b.daysElapsed === 0 ? 'Not started yet' : `${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left`;

// The four figures at the top: income, planned, unallocated and safe to spend.
export function budgetStats({ budget: b, incomeMode }: BudgetMonthView) {
  return {
    income: { value: formatMoney(b.income), sub: incomeMode === 'Fixed' ? 'Take-home pay' : 'Recorded this month' },
    planned: {
      value: formatMoney(b.totalPlanned),
      sub: `${formatMoney(b.plannedSpending)} spending · ${formatMoney(b.plannedDebts)} debts`
        + (b.plannedSavings > 0 ? ` · ${formatMoney(b.plannedSavings)} savings` : ''),
    },
    unallocated: {
      value: formatMoney(b.unallocated), negative: b.unallocated < 0,
      sub: b.unallocated < 0 ? 'Planned more than income' : 'Income not yet budgeted',
    },
    safe: {
      value: b.daysLeft > 0 ? `${formatMoney(b.safeToSpendPerDay)}/day` : '—', negative: b.safeToSpend < 0,
      sub: b.safeToSpend < 0 ? `${formatMoney(-b.safeToSpend)} over-committed` : `${formatMoney(b.safeToSpend)} not spent or set aside`,
    },
  };
}

// What a budget amount shows: the figure, or an invitation to set one.
export const plannedLabel = (amount: number, currency = 'GBP') => (amount > 0 ? formatMoney(amount, currency) : 'Set budget');

// The undo for a month's own figure: back to the default, or off the month when there's none.
export const resetLabel = (defaultAmount: number | null, currency = 'GBP') =>
  defaultAmount !== null ? `Reset to ${formatMoney(defaultAmount, currency)}` : 'Remove from this month';

// The note under a category's line. collapsed: its subcategories are hidden, so say how many there are.
export function budgetLineNote(line: BudgetLine, daysLeft: number, collapsed = false): NotePart[] {
  const tone = lineTone(line.planned, line.spent, line.projected, daysLeft);
  const childPlanned = line.planned - line.ownPlanned;
  const parts: NotePart[] = [
    line.planned === 0 ? { text: 'No budget this month' }
      : line.remaining < 0 ? { text: `${formatMoney(-line.remaining)} over`, tone: 'negative' }
      : line.remaining === 0 ? { text: 'Fully used' }
      : { text: `${formatMoney(line.remaining)} left${daysLeft > 0 ? ` · ${formatMoney(line.dailyAllowance)}/day` : ''}` },
  ];
  if (tone === 'warning') parts.push({ text: `on pace for ${formatMoney(line.projected)}`, tone: 'warning' });
  if (childPlanned > 0 && line.ownPlanned > 0)
    parts.push({ text: `own ${formatMoney(line.ownPlanned)} + subcategories ${formatMoney(childPlanned)}` });
  if (collapsed && line.children.length > 0)
    parts.push({ text: `${line.children.length} subcategor${line.children.length === 1 ? 'y' : 'ies'}` });
  return parts;
}

// A debt line's note, in its own currency (₦ for a naira loan) with its £ share of the month's
// budget, and what the avalanche plan suggests paying (differs: worth offering "Use").
export function debtLineNote(d: DebtLine) {
  const c = d.currency;
  const parts: NotePart[] = [
    d.nativePlanned === 0 ? { text: 'Nothing planned this month' }
      : d.nativeRemaining <= 0 ? { text: 'Paid for this month', tone: 'positive' }
      : { text: `${formatMoney(d.nativeRemaining, c)} still to pay` },
  ];
  if (c !== 'GBP')
    parts.push(d.rate !== null ? { text: `≈ ${formatMoney(d.planned)} of this month's budget` }
      : { text: "no £ rate yet, so it isn't in the totals", tone: 'warning' });
  return {
    parts,
    progressTone: (d.nativeRemaining <= 0 ? 'positive' : 'accent') as 'positive' | 'accent',
    suggestion: d.nativeSuggested === null ? null : {
      amount: d.nativeSuggested,
      text: formatMoney(d.nativeSuggested, c),
      differs: Math.abs(d.nativeSuggested - d.nativePlanned) >= 0.01,
    },
  };
}

// What the avalanche pays beyond the debt lines, so the month's debt total (and so unallocated and
// safe-to-spend) is what the plan actually pays.
export const avalancheExtraNote = (b: BudgetMonth) =>
  `The plan pays ${formatMoney(b.plannedDebts)} a month; your debt lines add up to ${formatMoney(b.plannedDebts - b.avalancheExtra)}. Paying more than a line's figure counts here.`;

// Where the avalanche plan's budget comes from, around a link to the plan.
export const debtBudgetNote = ({ budget: b, settingsDebtBudget }: BudgetMonthView) => (b.hasMonthDebtAmounts
  ? { before: `This month's debt lines (${formatMoney(b.plannedDebts)}) are the `, link: 'avalanche plan', after: "'s budget." }
  : {
    before: 'The ', link: 'avalanche plan',
    after: ` uses your debt budget from Settings${settingsDebtBudget !== null ? ` (${formatMoney(settingsDebtBudget)})` : ''} until you set a debt amount for this month.`,
  });

// Income not budgeted while there are debts: a nudge towards the plan (null when it doesn't apply).
export const unallocatedNote = (b: BudgetMonth) => (b.unallocated > 0 && b.debts.length > 0
  ? {
    before: `${formatMoney(b.unallocated)} of income isn't budgeted. Raising a debt payment here moves the avalanche plan's debt-free date; see the effect on the `,
    link: 'Debt plan', after: '.',
  }
  : null);

export const copyNotice = (copied: number) =>
  copied === 0 ? 'Last month had no figures of its own to copy.' : `Copied ${copied} figure${copied === 1 ? '' : 's'} from last month.`;

// Adding a line: it starts on the first spending category, with its default amount.
export function addLineDefaults(categories: Category[]) {
  const first = categories.find((c) => c.kind === 'Expense' && !c.isArchived);
  return { categoryId: first?.id, amount: first?.defaultMonthlyAmount?.toString() ?? '' };
}

export const addLineHint = (category: Category | undefined, monthName: string) =>
  category?.defaultMonthlyAmount != null
    ? `Its default is £${category.defaultMonthlyAmount}; this changes ${monthName} only.`
    : 'For this month only. Set a default in Settings → Categories to have it every month.';
