import { describe, expect, it } from 'vitest';

import { planPurchase, purchaseProgress, type PlanBy } from './plannedPurchases';

// The same cases as the API's PlannedPurchaseCalculatorTests: the forms preview with this copy and
// the API saves with that one, so they must agree.
const plan = (target: number, saved: number, by: PlanBy) => planPurchase(target, saved, '2026-11', by);

describe('planPurchase', () => {
  it('saves for the visa fees by January in three equal months', () => {
    expect(plan(3990, 0, { by: 'targetMonth', month: '2027-01' }).plan)
      .toEqual({ monthlyAmount: 1330, months: 3, targetMonth: '2027-01', lastAmount: 1330 });
  });

  it('rounds the months up from a monthly amount, with a smaller last month', () => {
    expect(plan(3990, 0, { by: 'monthly', amount: 1500 }).plan)
      .toEqual({ monthlyAmount: 1500, months: 3, targetMonth: '2027-01', lastAmount: 990 });
    expect(plan(3990, 0, { by: 'monthly', amount: 1330 }).plan)
      .toEqual({ monthlyAmount: 1330, months: 3, targetMonth: '2027-01', lastAmount: 1330 });
  });

  it('rounds the monthly amount up to the penny from a number of months', () => {
    expect(plan(1000, 0, { by: 'months', months: 3 }).plan)
      .toEqual({ monthlyAmount: 333.34, months: 3, targetMonth: '2027-01', lastAmount: 333.32 });
  });

  it("takes off what's already saved first", () => {
    expect(plan(3990, 1000, { by: 'months', months: 2 }).plan)
      .toEqual({ monthlyAmount: 1495, months: 2, targetMonth: '2026-12', lastAmount: 1495 });
  });

  it('counts pennies that trip up floating point exactly', () => {
    expect(plan(1.1, 0, { by: 'monthly', amount: 0.1 }).plan)
      .toEqual({ monthlyAmount: 0.1, months: 11, targetMonth: '2027-09', lastAmount: 0.1 });
  });

  it('makes this month as the target one month of everything', () => {
    expect(plan(250, 0, { by: 'targetMonth', month: '2026-11' }).plan)
      .toEqual({ monthlyAmount: 250, months: 1, targetMonth: '2026-11', lastAmount: 250 });
  });

  it('allows a target month up to 120 months away', () => {
    expect(plan(1200, 0, { by: 'targetMonth', month: '2036-10' }).plan?.months).toBe(120);
  });

  it.each<[number, number, PlanBy, string]>([
    [0, 0, { by: 'months', months: 3 }, 'Enter a target above zero.'],
    [3990, 4000, { by: 'months', months: 3 }, "That's already saved: £4,000.00 of £3,990.00."],
    [3990, 0, { by: 'monthly', amount: 0 }, 'Enter a monthly amount above zero.'],
    [3990, 0, { by: 'monthly', amount: 10 }, 'At £10.00 a month that takes 399 months; the most is 120.'],
    [3990, 0, { by: 'months', months: 0 }, 'Choose 1 to 120 months.'],
    [3990, 0, { by: 'months', months: 121 }, 'Choose 1 to 120 months.'],
    [3990, 0, { by: 'months', months: 2.5 }, 'Choose 1 to 120 months.'],
    [3990, 0, { by: 'targetMonth', month: '2026-10' }, "The target month can't be in the past."],
    [3990, 0, { by: 'targetMonth', month: '2036-11' }, 'Choose a target month within 120 months.'],
  ])('says what is wrong with %s, %s saved, %o', (target, saved, by, error) => {
    expect(plan(target, saved, by).error).toBe(error);
  });

  it('treats a blank amount (NaN) as missing', () => {
    expect(plan(Number(''), 0, { by: 'months', months: 3 }).error).toBe('Enter a target above zero.');
    expect(plan(3990, 0, { by: 'monthly', amount: Number('abc') }).error).toBe('Enter a monthly amount above zero.');
  });
});

describe('purchaseProgress', () => {
  // Visa fees: £3,990 at £1,330 a month, November to January.
  const progress = (currentMonth: string, saved: number, contributedBefore: number, contributedThisMonth: number) =>
    purchaseProgress({
      target: 3990, saved, monthlyAmount: 1330, startMonth: '2026-11', targetMonth: '2027-01',
      currentMonth, contributedBefore, contributedThisMonth,
    });

  it('is on track in the first month with nothing yet, finishing on plan', () => {
    expect(progress('2026-11', 0, 0, 0)).toEqual({
      saved: 0, remaining: 3990, percent: 0, neededByNow: 0, onTrack: true, monthsLeft: 3, expectedFinish: '2027-01',
    });
  });

  it('is a third of the way once the first month is paid', () => {
    expect(progress('2026-11', 1330, 0, 1330)).toEqual({
      saved: 1330, remaining: 2660, percent: 33.3, neededByNow: 0, onTrack: true, monthsLeft: 3, expectedFinish: '2027-01',
    });
  });

  it('is still on track in the second month before paying', () => {
    expect(progress('2026-12', 1330, 1330, 0)).toEqual({
      saved: 1330, remaining: 2660, percent: 33.3, neededByNow: 1330, onTrack: true, monthsLeft: 2, expectedFinish: '2027-01',
    });
  });

  it('is behind after skipping the first month, with no finish in sight', () => {
    expect(progress('2026-12', 0, 0, 0)).toMatchObject({ onTrack: false, neededByNow: 1330, expectedFinish: null });
  });

  it('expects to finish at the pace so far', () => {
    // £1,330 in November and £500 so far in December: £915 a month, £2,160 to go.
    expect(progress('2026-12', 1830, 1330, 500).expectedFinish).toBe('2027-03');
  });

  it('is behind past the target month while short', () => {
    expect(progress('2027-02', 3000, 3000, 0)).toMatchObject({ monthsLeft: 0, neededByNow: 3990, onTrack: false });
  });

  it('is 100% and finished now once reached', () => {
    expect(progress('2026-12', 3990, 1330, 2660)).toEqual({
      saved: 3990, remaining: 0, percent: 100, neededByNow: 1330, onTrack: true, monthsLeft: 2, expectedFinish: '2026-12',
    });
  });

  it('rounds the percent down, so it is never 100 until it is there', () => {
    expect(progress('2027-01', 3989.99, 2659.99, 1330).percent).toBe(99.9);
  });

  it('counts whole months exactly at an uneven pace', () => {
    // £1,000 over three months (£333.33...) with £2,000 to go is exactly 6 more months, not 7.
    expect(purchaseProgress({
      target: 3000, saved: 1000, monthlyAmount: 500, startMonth: '2026-11', targetMonth: '2027-10',
      currentMonth: '2027-02', contributedBefore: 1000, contributedThisMonth: 0,
    }).expectedFinish).toBe('2027-07');
  });

  it('has no finish when the pace takes more than 120 months', () => {
    // £10 over two whole months is £5 a month: 796 more months.
    expect(progress('2027-01', 10, 10, 0).expectedFinish).toBeNull();
  });
});
