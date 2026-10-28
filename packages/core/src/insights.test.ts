import { describe, expect, it } from 'vitest';

import {
  generateLabel, generatingNote, hasQuestion, insightFooter, insightsForMonth, isKeyNotConfigured, questionCounter, savingsNote,
  shortQuestion, shownInsight,
} from './insights';
import type { Insight } from './types';

const insight = (i: Partial<Insight> & Pick<Insight, 'id'>): Insight => ({
  year: 2026, month: 10, periodStart: '2026-09-28', createdAt: '2026-10-27T17:40:00Z', model: 'gpt-5.4-mini',
  inputTokens: 1834, outputTokens: 612, promptSent: '…', question: null,
  result: { summary: '', wasteItems: [], savingTips: [], debtAdvice: '', answer: null }, ...i,
});

describe('insights', () => {
  const list = [insight({ id: 3 }), insight({ id: 2, month: 9 }), insight({ id: 1 })]; // newest first

  it("shows the month's chosen insight, or its newest", () => {
    const october = insightsForMonth(list, 2026, 10);
    expect(october.map((i) => i.id)).toEqual([3, 1]);
    expect(shownInsight(october, 1)?.id).toBe(1);
    expect(shownInsight(october, 2)?.id).toBe(3); // picked, but from another month
    expect(shownInsight(october, null)?.id).toBe(3);
    expect(shownInsight([], null)).toBeUndefined();
  });

  it('labels the button and the wait', () => {
    expect(generateLabel(true, true)).toBe('Generating…');
    expect(generateLabel(false, true)).toBe('Regenerate');
    expect(generateLabel(false, false)).toBe('Generate');
    expect(generatingNote(2026, 10)).toBe('Asking OpenAI about October 2026. This can take up to a minute.');
    expect(generatingNote(undefined, undefined)).toBe('Asking OpenAI about this month. This can take up to a minute.');
  });

  it('never offers "Regenerate" with a question, and mentions it while waiting', () => {
    expect(generateLabel(false, true, true)).toBe('Generate');
    expect(generatingNote(2026, 10, true)).toBe('Asking OpenAI about October 2026 and your question. This can take up to a minute.');
  });

  it('counts and shortens questions', () => {
    expect(questionCounter('Can I?')).toBe('6/500');
    expect(hasQuestion('   ')).toBe(false);
    expect(hasQuestion(' Can I? ')).toBe(true);
    expect(shortQuestion('Can I afford a £50 train ticket this month?')).toBe('Can I afford a £50 train ticket this month?');
    expect(shortQuestion('Can I afford a £50 train ticket this month, and should I pay the Aqua card first?', 40))
      .toBe('Can I afford a £50 train ticket this…');
    expect(shortQuestion('  Two\n lines  ')).toBe('Two lines');
  });

  it('adds up the saving tips', () => {
    const tips = [{ tip: 'a', estimatedMonthlySaving: 12.5 }, { tip: 'b', estimatedMonthlySaving: 30 }];
    expect(savingsNote(insight({ id: 1, result: { summary: '', wasteItems: [], savingTips: tips, debtAdvice: '', answer: null } })))
      .toBe('Up to about £42.50 a month, if you did them all.');
    expect(savingsNote(insight({ id: 1 }))).toBeNull();
  });

  it('says where an insight came from', () => {
    expect(insightFooter(insight({ id: 1 }))).toMatch(
      /^Generated 27 Oct 2026, \d\d:40 · gpt-5\.4-mini · 1,834 in \+ 612 out tokens · for the month from 28 Sept 2026$/);
  });

  it('recognises the API saying it has no OpenAI key', () => {
    expect(isKeyNotConfigured('OpenAI key not configured')).toBe(true);
    expect(isKeyNotConfigured('Rate limited')).toBe(false);
  });
});
