import { describe, expect, it } from 'vitest';

import { flattenLines, lineTone, linesToWatch, safeToSpendSummary, watchLabel } from './budget';
import { budgetLine, budgetMonth } from './testData';

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
