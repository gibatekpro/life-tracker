import { formatDate, formatDateTime, formatMoney, monthName } from './format';
import type { Insight } from './types';

// The insights page (web: InsightsPage): an AI read of a budget month that the API asks OpenAI for.

// What the API says (503) when it has no OpenAI key; the page explains how to set one.
export const keyNotConfigured = 'OpenAI key not configured';
export const isKeyNotConfigured = (error: string | null | undefined) => error === keyNotConfigured;

export const insightsForMonth = (insights: Insight[], year: number, month: number) =>
  insights.filter((i) => i.year === year && i.month === month);

// The one picked from the list, if it's this month's; otherwise the month's newest (the list is newest first).
export const shownInsight = (forMonth: Insight[], selectedId: number | null) => forMonth.find((i) => i.id === selectedId) ?? forMonth[0];

// With a question it's always a new insight, so never "Regenerate".
export const generateLabel = (generating: boolean, hasInsight: boolean, hasQuestion = false) =>
  generating ? 'Generating…' : hasInsight && !hasQuestion ? 'Regenerate' : 'Generate';

export const generatingNote = (year: number | undefined, month: number | undefined, hasQuestion = false) =>
  `Asking OpenAI about ${year && month ? monthName(year, month) : 'this month'}${hasQuestion ? ' and your question' : ''}. This can take up to a minute.`;

// The optional question box above Generate.
export const maxQuestionLength = 500;
export const questionLabel = 'Ask a question (optional)';
export const questionPlaceholder = 'e.g. Can I afford a £50 train ticket this month?';
export const questionNote = "Sent to OpenAI with your budget summary. Don't include card numbers or passwords.";
export const questionCounter = (question: string) => `${question.length}/${maxQuestionLength}`;
export const hasQuestion = (question: string) => question.trim() !== '';

// A question in the list of past insights: its start, cut at a word.
export function shortQuestion(question: string, max = 60) {
  const q = question.trim().replace(/\s+/g, ' ');
  if (q.length <= max) return q;
  const cut = q.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?]+$/, '')}…`;
}

// "Up to about £45.00 a month, if you did them all." (null with no tips).
export function savingsNote(insight: Insight) {
  const tips = insight.result.savingTips;
  if (tips.length === 0) return null;
  return `Up to about ${formatMoney(tips.reduce((sum, t) => sum + t.estimatedMonthlySaving, 0))} a month, if you did them all.`;
}

// Where an insight came from: when, which model, how many tokens, and which month.
export const insightFooter = (i: Insight) =>
  `Generated ${formatDateTime(i.createdAt)} · ${i.model} · ${i.inputTokens.toLocaleString('en-GB')} in + ${i.outputTokens.toLocaleString('en-GB')} out tokens · for the month from ${formatDate(i.periodStart)}`;
