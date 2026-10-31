import { describe, expect, it } from 'vitest';

import {
  addLineDefaults, addLineHint, avalancheExtraNote, budgetDaysNote, budgetLineNote, budgetStats, budgetTree, copyNotice,
  debtBudgetNote, debtLineNote, flattenLines, lineTone, linesToWatch, plannedLabel, resetLabel, safeToSpendSummary,
  unallocatedNote, watchLabel,
} from './budget';
import { budgetLine, budgetMonth, category, debtLine } from './testData';

describe('lineTone', () => {
  it('is red once over, amber when the pace would overspend, green otherwise', () => {
    expect(lineTone(100, 120, 150, 10)).toBe('negative');
    expect(lineTone(100, 50, 130, 10)).toBe('warning');
    expect(lineTone(100, 50, 90, 10)).toBe('accent');
  });

  it("doesn't warn about a bill paid exactly in full, the last day, or a line with nothing planned", () => {
    expect(lineTone(18, 18, 40, 20)).toBe('accent');
    expect(lineTone(100, 50, 130, 0)).toBe('accent');
    expect(lineTone(0, 50, 130, 10)).toBe('accent');
  });
});

describe('linesToWatch', () => {
  const food = budgetLine({ categoryId: 1, name: 'Food', planned: 200, spent: 150, projected: 260, remaining: 50 });
  const fuel = budgetLine({ categoryId: 2, name: 'Fuel', planned: 100, spent: 130, projected: 160, remaining: -30 });
  const fine = budgetLine({ categoryId: 3, name: 'Gym', planned: 30, spent: 30, projected: 30, remaining: 0 });
  const kids = budgetLine({ categoryId: 4, name: 'Kids', planned: 10, spent: 20, projected: 30, remaining: -10 });
  const parent = budgetLine({ categoryId: 5, name: 'Family', planned: 50, spent: 90, projected: 100, remaining: -40, children: [kids] });

  it('lists leaf lines that are over first, then heading over, at most three', () => {
    const b = budgetMonth({ lines: [food, fuel, fine, parent] });
    expect(linesToWatch(b).map((x) => [x.line.name, x.tone])).toEqual([['Fuel', 'negative'], ['Kids', 'negative'], ['Food', 'warning']]);
    expect(flattenLines(b.lines).map((l) => l.name)).toEqual(['Food', 'Fuel', 'Gym', 'Family', 'Kids']);
  });

  it('labels them as the web does', () => {
    expect(watchLabel({ line: fuel, tone: 'negative' })).toBe('£30.00 over');
    expect(watchLabel({ line: food, tone: 'warning' })).toBe('heading for £260.00');
  });
});

describe('safeToSpendSummary', () => {
  it('gives the per-day figure and what is left', () => {
    expect(safeToSpendSummary(budgetMonth({ safeToSpend: 300, safeToSpendPerDay: 30, daysLeft: 10 })))
      .toEqual({ perDay: '£30.00', negative: false, note: '£300.00 not spent or set aside · 10 days left' });
  });

  it('says how far over it is, and shows no per-day figure with no days left', () => {
    expect(safeToSpendSummary(budgetMonth({ safeToSpend: -45, safeToSpendPerDay: -45, daysLeft: 1 })))
      .toEqual({ perDay: '−£45.00', negative: true, note: '£45.00 more is planned or spent than came in · 1 day left' });
    expect(safeToSpendSummary(budgetMonth({ daysLeft: 0 })).perDay).toBe('—');
  });
});

const text = (parts: { text: string }[]) => parts.map((p) => p.text).join(' · ');

describe('the budget page', () => {
  it('says where the month is', () => {
    expect(budgetDaysNote(budgetMonth({ daysLeft: 0 }))).toBe('Finished');
    expect(budgetDaysNote(budgetMonth({ daysElapsed: 0, daysLeft: 30 }))).toBe('Not started yet');
    expect(budgetDaysNote(budgetMonth({ daysLeft: 1 }))).toBe('1 day left');
  });

  it('gives the four figures', () => {
    const stats = budgetStats({ incomeMode: 'Fixed', settingsDebtBudget: null, budget: budgetMonth({
      income: 2500, totalPlanned: 2700, plannedSpending: 2000, plannedDebts: 700, unallocated: -200,
      safeToSpend: -50, safeToSpendPerDay: -5, daysLeft: 10,
    }) });
    expect(stats).toEqual({
      income: { value: '£2,500.00', sub: 'Take-home pay' },
      planned: { value: '£2,700.00', sub: '£2,000.00 spending · £700.00 debts' },
      unallocated: { value: '−£200.00', negative: true, sub: 'Planned more than income' },
      safe: { value: '−£5.00/day', negative: true, sub: '£50.00 over-committed' },
    });
    expect(budgetStats({ incomeMode: 'Recorded', settingsDebtBudget: null, budget: budgetMonth({ daysLeft: 0, safeToSpend: 10 }) }).safe)
      .toEqual({ value: '—', negative: false, sub: '£10.00 not spent or set aside' });
    expect(budgetStats({ incomeMode: 'Fixed', settingsDebtBudget: null, budget: budgetMonth({
      totalPlanned: 4030, plannedSpending: 2000, plannedDebts: 700, plannedSavings: 1330,
    }) }).planned.sub).toBe('£2,000.00 spending · £700.00 debts · £1,330.00 savings');
  });

  it('labels amounts and resets', () => {
    expect(plannedLabel(0)).toBe('Set budget');
    expect(plannedLabel(15000, 'NGN')).toBe('₦15,000.00');
    expect(resetLabel(200)).toBe('Reset to £200.00');
    expect(resetLabel(null)).toBe('Remove from this month');
    expect(copyNotice(0)).toBe('Last month had no figures of its own to copy.');
    expect(copyNotice(1)).toBe('Copied 1 figure from last month.');
    expect(copyNotice(3)).toBe('Copied 3 figures from last month.');
  });

  it('builds the tree from the lines', () => {
    const tree = budgetTree([budgetLine({ categoryId: 1, name: 'Bills', children: [budgetLine({ categoryId: 2, name: 'Rent' })] })]);
    expect(tree[0]).toMatchObject({ id: 1, children: [{ id: 2, children: [] }] });
  });
});

describe('budgetLineNote', () => {
  it('describes what is left, per day, and the pace when heading over', () => {
    const food = budgetLine({ categoryId: 1, name: 'Food', planned: 200, spent: 150, remaining: 50, dailyAllowance: 5, projected: 260 });
    expect(budgetLineNote(food, 10)).toEqual([{ text: '£50.00 left · £5.00/day' }, { text: 'on pace for £260.00', tone: 'warning' }]);
    expect(text(budgetLineNote({ ...food, projected: 100 }, 0))).toBe('£50.00 left');
  });

  it('says over, fully used or nothing planned', () => {
    expect(budgetLineNote(budgetLine({ categoryId: 1, name: 'X', planned: 100, spent: 130, remaining: -30 }), 5)[0])
      .toEqual({ text: '£30.00 over', tone: 'negative' });
    expect(text(budgetLineNote(budgetLine({ categoryId: 1, name: 'X', planned: 18, spent: 18 }), 5))).toBe('Fully used');
    expect(text(budgetLineNote(budgetLine({ categoryId: 1, name: 'X' }), 5))).toBe('No budget this month');
  });

  it("splits a parent's own amount from its subcategories', and counts them when collapsed", () => {
    const parent = budgetLine({ categoryId: 1, name: 'Bills', planned: 300, ownPlanned: 100, spent: 300, remaining: 0,
      children: [budgetLine({ categoryId: 2, name: 'Rent' }), budgetLine({ categoryId: 3, name: 'Water' })] });
    expect(text(budgetLineNote(parent, 5, true))).toBe('Fully used · own £100.00 + subcategories £200.00 · 2 subcategories');
    expect(text(budgetLineNote(parent, 5, false))).toBe('Fully used · own £100.00 + subcategories £200.00');
  });
});

describe('debtLineNote', () => {
  it('shows a naira loan in ₦ with its £ share and the avalanche suggestion', () => {
    const d = debtLine({ accountId: 8, name: 'Ease Cash', currency: 'NGN', rate: 0.0005, planned: 7.5,
      nativePlanned: 15000, nativePaid: 5000, nativeRemaining: 10000, nativeSuggested: 20000 });
    expect(debtLineNote(d)).toEqual({
      parts: [{ text: '₦10,000.00 still to pay' }, { text: "≈ £7.50 of this month's budget" }],
      progressTone: 'accent',
      suggestion: { amount: 20000, text: '₦20,000.00', differs: true },
    });
  });

  it('says when it is paid, has no rate, or the suggestion matches', () => {
    const d = debtLine({ accountId: 8, name: 'X', currency: 'NGN', rate: null, nativePlanned: 100, nativeRemaining: 0, nativeSuggested: 100.004 });
    expect(debtLineNote(d)).toMatchObject({
      parts: [{ text: 'Paid for this month', tone: 'positive' }, { text: "no £ rate yet, so it isn't in the totals", tone: 'warning' }],
      progressTone: 'positive', suggestion: { differs: false },
    });
    expect(text(debtLineNote(debtLine({ accountId: 1, name: 'Aqua' })).parts)).toBe('Nothing planned this month');
  });
});

describe('the debt notes', () => {
  const view = (b: Parameters<typeof budgetMonth>[0], settingsDebtBudget: number | null = 700) =>
    ({ incomeMode: 'Fixed' as const, settingsDebtBudget, budget: budgetMonth(b) });

  it('explains the avalanche extra and where the plan gets its budget', () => {
    expect(avalancheExtraNote(budgetMonth({ plannedDebts: 700, avalancheExtra: 150 })))
      .toBe("The plan pays £700.00 a month; your debt lines add up to £550.00. Paying more than a line's figure counts here.");
    expect(debtBudgetNote(view({ hasMonthDebtAmounts: true, plannedDebts: 700 })))
      .toEqual({ before: "This month's debt lines (£700.00) are the ", link: 'avalanche plan', after: "'s budget." });
    expect(debtBudgetNote(view({})).after).toBe(' uses your debt budget from Settings (£700.00) until you set a debt amount for this month.');
    expect(debtBudgetNote(view({}, null)).after).toBe(' uses your debt budget from Settings until you set a debt amount for this month.');
  });

  it('nudges towards the plan only with unbudgeted income and debts', () => {
    const debts = [debtLine({ accountId: 1, name: 'Aqua' })];
    expect(unallocatedNote(budgetMonth({ unallocated: 300, debts }))?.before).toMatch(/^£300.00 of income isn't budgeted/);
    expect(unallocatedNote(budgetMonth({ unallocated: 300 }))).toBeNull();
    expect(unallocatedNote(budgetMonth({ unallocated: 0, debts }))).toBeNull();
  });
});

describe('adding a line', () => {
  const cats = [category({ id: 1, name: 'Old', isArchived: true }), category({ id: 2, name: 'Food', defaultMonthlyAmount: 200 }),
    category({ id: 3, name: 'Gifts' })];

  it('starts on the first live spending category with its default', () => {
    expect(addLineDefaults(cats)).toEqual({ categoryId: 2, amount: '200' });
    expect(addLineDefaults([])).toEqual({ categoryId: undefined, amount: '' });
  });

  it("explains whether it changes the month's figure or adds one", () => {
    expect(addLineHint(cats[1], 'November 2026')).toBe('Its default is £200; this changes November 2026 only.');
    expect(addLineHint(cats[2], 'November 2026')).toBe('For this month only. Set a default in Settings → Categories to have it every month.');
  });
});
