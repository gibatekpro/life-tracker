import { formatDateTime, formatMoney } from './format';
import { purchasePreview, type PurchaseFormValues } from './plannedPurchaseForm';
import type { AdviceDraft, AdviceVerdict, PurchaseAdvice } from './types';

// AI advice on a planned purchase (web: AdviceCard, the form's "Ask first"; phone: the same). The API
// asks OpenAI; with no key it answers 503 "OpenAI key not configured" (insights.ts: isKeyNotConfigured).

export const verdictLabel: Record<AdviceVerdict, { label: string; tone: 'positive' | 'warning' | 'negative' }> = {
  GoodIdea: { label: 'Good idea', tone: 'positive' },
  GoodIdeaLater: { label: 'Good idea, later', tone: 'warning' },
  Reconsider: { label: 'Reconsider', tone: 'negative' },
};

export const adviceSuggestion = (a: PurchaseAdvice) =>
  `${formatMoney(a.result.suggestedMonthlyAmount)} a month for ${a.result.suggestedMonths} month${a.result.suggestedMonths === 1 ? '' : 's'}`;

export const adviceFooter = (a: PurchaseAdvice) =>
  `Asked ${formatDateTime(a.createdAt)} · ${a.model} · ${a.inputTokens.toLocaleString('en-GB')} in + ${a.outputTokens.toLocaleString('en-GB')} out tokens`;

export const askAdviceLabel = (asking: boolean, hasAdvice: boolean) => (asking ? 'Asking…' : hasAdvice ? 'Ask again' : 'Get advice');

export const askingAdviceNote = (name: string) => `Asking OpenAI about ${name || 'this purchase'}. This can take up to a minute.`;

export const adviceSentNote =
  'Sent to OpenAI: this purchase and its notes, your income, budget lines, debts and other planned purchases. Never account numbers.';

export const adviceDisclaimer = 'General information, not financial advice.';

// Asking about the form before saving: its name, target and essential switch, and the plan the preview
// shows (left out while there isn't one, so the advice suggests one).
export function draftAdviceRequest(v: PurchaseFormValues, currentMonth: string):
  { draft: AdviceDraft; error?: undefined } | { draft?: undefined; error: string } {
  const target = Number(v.target);
  if (v.name.trim() === '' || !(target > 0)) return { error: 'Enter a name and target first.' };
  const preview = purchasePreview(v, 0, currentMonth, false);
  return {
    draft: {
      name: v.name.trim(),
      targetAmount: target,
      ...(preview.kind === 'plan' ? { monthlyAmount: preview.plan.monthlyAmount, months: preview.plan.months } : {}),
      isEssential: v.isEssential,
      notes: v.notes.trim() === '' ? null : v.notes.trim(),
    },
  };
}

// "Use this amount": the form planned by the suggested monthly amount (the phone passes just the amount
// to its form modal).
export const withMonthlyAmount = (v: PurchaseFormValues, amount: number): PurchaseFormValues =>
  ({ ...v, choice: 'monthly', monthly: String(amount) });

export const withSuggestion = (v: PurchaseFormValues, a: PurchaseAdvice) => withMonthlyAmount(v, a.result.suggestedMonthlyAmount);
