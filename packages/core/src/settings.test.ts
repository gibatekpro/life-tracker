import { describe, expect, it } from 'vitest';

import {
  archivedCount, budgetSettingsValues, buildBudgetSettings, buildCategoryRequest, categoryFormValues, categoryNote, categoryRemoval,
  earlyIncomeChoices, incomeModeHint, rateCurrencies, rateEditLabel, rateEditStart, rateLabel, startDayChoices, startDayHint,
  visibleCategories, withDescendants,
} from './settings';
import { category, rate } from './testData';
import type { Settings } from './types';

const settings: Settings = {
  id: 1, monthlyIncome: 2589.23, monthlyDebtBudget: null, defaultAccountId: null, incomeMode: 'Fixed', monthStartDay: 28,
  useTransferRates: false, earlyIncomeDays: 3, updatedAt: '',
};

describe('income and budget', () => {
  it('describes the choices', () => {
    expect(incomeModeHint('Fixed')).toMatch(/^A set monthly amount/);
    expect(earlyIncomeChoices.map((c) => c.label).slice(0, 3)).toEqual(['No, only within the month', 'Up to 1 day before', 'Up to 2 days before']);
    expect(startDayChoices[0].label).toBe('1st (calendar month)');
    expect(startDayChoices[27].label).toBe('28th (payday)');
    expect(startDayHint(1)).toBe('Calendar months.');
    expect(startDayHint(22)).toBe('Each month runs from the 22nd to the day before the next 22nd.');
  });

  it('builds the update from the saved settings and changes', () => {
    const v = budgetSettingsValues(settings);
    expect(v).toEqual({ incomeMode: 'Fixed', income: '2589.23', debtBudget: '', startDay: 28, earlyDays: 3 });
    expect(buildBudgetSettings({ ...v, debtBudget: '700' }).request).toEqual({
      monthlyIncome: 2589.23, monthlyDebtBudget: 700, incomeMode: 'Fixed', monthStartDay: 28, earlyIncomeDays: 3,
    });
    expect(buildBudgetSettings(v).request?.monthlyDebtBudget).toBeNull();
  });

  it('needs take-home pay only when measuring against it', () => {
    const v = { ...budgetSettingsValues(settings), income: '' };
    expect(buildBudgetSettings(v).error).toBe('Enter your monthly take-home pay.');
    expect(buildBudgetSettings({ ...v, incomeMode: 'Recorded' }).request?.monthlyIncome).toBe(0);
    expect(buildBudgetSettings({ ...v, income: '1', debtBudget: 'x' }).error).toBe('Amounts must be numbers.');
  });
});

describe('categories', () => {
  const subs = category({ id: 1, name: 'Subscriptions', childCount: 2, defaultMonthlyAmount: 30 });
  const ai = category({ id: 2, name: 'AI', parentId: 1, childCount: 1 });
  const claude = category({ id: 3, name: 'Claude', parentId: 2, transactionCount: 4 });
  const old = category({ id: 4, name: 'Old', isArchived: true });
  const gift = category({ id: 5, name: 'Gift', kind: 'Income' });
  const all = [subs, ai, claude, old, gift];

  it('shows one kind, archived ones only when asked', () => {
    expect(visibleCategories(all, 'Expense', false).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(visibleCategories(all, 'Expense', true).map((c) => c.id)).toEqual([1, 2, 3, 4]);
    expect(archivedCount(all, 'Expense')).toBe(1);
  });

  it('describes each one', () => {
    expect(categoryNote(subs, 2)).toBe('£30.00 a month · 0 transactions · 2 subcategories');
    expect(categoryNote(claude)).toBe('No default budget · 4 transactions');
    expect(categoryNote(gift)).toBe('0 transactions');
  });

  it('archives what has history, deletes what does not, unarchives the archived', () => {
    expect(categoryRemoval(subs)).toBe('archive');
    expect(categoryRemoval(claude)).toBe('archive');
    expect(categoryRemoval(gift)).toBe('delete');
    expect(categoryRemoval(old)).toBe('unarchive');
  });

  it("can't be moved under its own subcategories", () => {
    expect([...withDescendants(1, all)].sort()).toEqual([1, 2, 3]);
    expect([...withDescendants(3, all)]).toEqual([3]);
  });

  it('builds the request, with a default budget only for spending', () => {
    expect(categoryFormValues(undefined, 2)).toEqual({ name: '', parentId: 2, amount: '' });
    expect(categoryFormValues(subs)).toEqual({ name: 'Subscriptions', parentId: null, amount: '30' });
    expect(buildCategoryRequest({ name: ' Claude ', parentId: 2, amount: '18' }, 'Expense').request)
      .toEqual({ name: 'Claude', kind: 'Expense', parentId: 2, defaultMonthlyAmount: 18 });
    expect(buildCategoryRequest({ name: 'Tips', parentId: null, amount: '18' }, 'Income').request?.defaultMonthlyAmount).toBeNull();
    expect(buildCategoryRequest({ name: ' ', parentId: null, amount: '' }, 'Expense').error).toBe('Enter a name.');
  });
});

describe('currencies', () => {
  const rates = [rate('GBP', 'NGN', 1811.5), rate('NGN', 'GBP', 0.000509), { ...rate('GBP', 'EUR', null), manualRate: null }];

  it('lists each currency once', () => {
    expect(rateCurrencies(rates)).toEqual(['NGN', 'EUR']);
  });

  it('labels each direction', () => {
    expect(rateLabel(rates[0])).toBe('£1 = ₦1,811.5');
    expect(rateLabel(rates[2])).toBe('£1 = —');
    expect(rateEditLabel(rates[0])).toBe('Change');
    expect(rateEditLabel(rates[2])).toBe('Set my rate');
    expect(rateEditStart(rates[1])).toBe('0.000509');
    expect(rateEditStart(rates[2])).toBe('');
  });
});
