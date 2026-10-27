import { describe, expect, it } from 'vitest';

import { categoryChain, categoryLevels } from './categories';
import { category } from './testData';

// Food, Subscriptions › AI › Claude (+ an archived Gemini), Salary (income), in the API's tree order.
const food = category({ id: 1, name: 'Food' });
const subs = category({ id: 2, name: 'Subscriptions' });
const ai = category({ id: 3, name: 'AI', parentId: 2 });
const claude = category({ id: 4, name: 'Claude', parentId: 3 });
const gemini = category({ id: 5, name: 'Gemini', parentId: 3, isArchived: true });
const salary = category({ id: 6, name: 'Salary', kind: 'Income' });
const all = [food, subs, ai, claude, gemini, salary];

const names = (cs: { name: string }[]) => cs.map((c) => c.name);

describe('categoryChain', () => {
  it('lists a category and its parents from the top', () => {
    expect(names(categoryChain(all, 4))).toEqual(['Subscriptions', 'AI', 'Claude']);
  });

  it('is empty for nothing chosen or an unknown id', () => {
    expect(categoryChain(all, undefined)).toEqual([]);
    expect(categoryChain(all, 99)).toEqual([]);
  });
});

describe('categoryLevels', () => {
  it('starts with only the top level of the right kind', () => {
    const levels = categoryLevels(all, 'Expense', undefined);
    expect(levels).toHaveLength(1);
    expect(levels[0].parent).toBeNull();
    expect(names(levels[0].options)).toEqual(['Food', 'Subscriptions']);
    expect(levels[0].selected).toBeUndefined();
  });

  it('adds a level under each chosen category that has subcategories, hiding archived ones', () => {
    const levels = categoryLevels(all, 'Expense', 3); // AI chosen
    expect(levels.map((l) => l.parent?.name ?? 'top')).toEqual(['top', 'Subscriptions', 'AI']);
    expect(levels.map((l) => l.selected?.name)).toEqual(['Subscriptions', 'AI', undefined]);
    expect(names(levels[2].options)).toEqual(['Claude']);
  });

  it('stops at a chosen category with no subcategories (a leaf, or a parent chosen itself)', () => {
    expect(categoryLevels(all, 'Expense', 1)).toHaveLength(1); // Food
    expect(categoryLevels(all, 'Expense', 4)).toHaveLength(3); // Claude: nothing below it
  });

  it('keeps an archived category in the list when it is the one already chosen', () => {
    const levels = categoryLevels(all, 'Expense', 5);
    expect(names(levels[2].options)).toEqual(['Claude', 'Gemini']);
    expect(levels[2].selected?.name).toBe('Gemini');
  });

  it('only offers the other kind for income', () => {
    expect(names(categoryLevels(all, 'Income', undefined)[0].options)).toEqual(['Salary']);
  });
});
