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

export const generateLabel = (generating: boolean, hasInsight: boolean) =>
  generating ? 'Generating…' : hasInsight ? 'Regenerate' : 'Generate';

export const generatingNote = (year: number | undefined, month: number | undefined) =>
  `Asking OpenAI about ${year && month ? monthName(year, month) : 'this month'}. This can take up to a minute.`;

// "Up to about £45.00 a month, if you did them all." (null with no tips).
export function savingsNote(insight: Insight) {
  const tips = insight.result.savingTips;
  if (tips.length === 0) return null;
  return `Up to about ${formatMoney(tips.reduce((sum, t) => sum + t.estimatedMonthlySaving, 0))} a month, if you did them all.`;
}

// Where an insight came from: when, which model, how many tokens, and which month.
export const insightFooter = (i: Insight) =>
  `Generated ${formatDateTime(i.createdAt)} · ${i.model} · ${i.inputTokens.toLocaleString('en-GB')} in + ${i.outputTokens.toLocaleString('en-GB')} out tokens · for the month from ${formatDate(i.periodStart)}`;
