import { describe, expect, it } from 'vitest';

import { purchaseFormValues } from './plannedPurchaseForm';
import { adviceFooter, adviceSuggestion, askAdviceLabel, draftAdviceRequest, verdictLabel, withSuggestion } from './purchaseAdvice';
import { purchaseAdvice } from './testData';

const blank = purchaseFormValues(undefined, '2026-11');

describe('purchase advice', () => {
  it('words the verdict and the suggestion', () => {
    expect(verdictLabel.GoodIdeaLater).toEqual({ label: 'Good idea, later', tone: 'warning' });
    expect(adviceSuggestion(purchaseAdvice())).toBe('£1,000.00 a month for 4 months');
    expect(adviceSuggestion(purchaseAdvice({ suggestedMonths: 1 }))).toBe('£1,000.00 a month for 1 month');
    expect(adviceFooter(purchaseAdvice())).toMatch(/^Asked 1 Nov 2026, \d\d:30 · gpt-5\.4-mini · 1,800 in \+ 320 out tokens$/);
    expect([askAdviceLabel(true, false), askAdviceLabel(false, false), askAdviceLabel(false, true)]).toEqual(['Asking…', 'Get advice', 'Ask again']);
  });

  it('asks about the form with the plan its preview shows, or none yet', () => {
    const v = { ...blank, name: ' Visa fees ', target: '3990', choice: 'targetMonth' as const, targetMonth: '2027-01', isEssential: true, notes: 'Due Jan' };
    expect(draftAdviceRequest(v, '2026-11')).toEqual({
      draft: { name: 'Visa fees', targetAmount: 3990, monthlyAmount: 1330, months: 3, isEssential: true, notes: 'Due Jan' },
    });
    expect(draftAdviceRequest({ ...blank, name: 'Laptop', target: '1200' }, '2026-11'))
      .toEqual({ draft: { name: 'Laptop', targetAmount: 1200, isEssential: false, notes: null } });
    expect(draftAdviceRequest({ ...blank, name: 'Laptop' }, '2026-11').error).toBe('Enter a name and target first.');
  });

  it('puts the suggested amount into the form', () => {
    expect(withSuggestion({ ...blank, choice: 'months', months: '3' }, purchaseAdvice())).toMatchObject({ choice: 'monthly', monthly: '1000', months: '3' });
  });
});
