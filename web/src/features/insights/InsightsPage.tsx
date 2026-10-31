import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { deleteInsight, generateInsight, getBudgetMonth, getInsights } from '../../api';
import type { Insight } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import {
  formatDateTime, formatMoney, generateLabel, generatingNote, hasQuestion, insightFooter, insightsForMonth,
  maxQuestionLength, monthName, periodLabel, questionCounter, questionLabel, questionNote, questionPlaceholder, savingsNote,
  shiftMonth, shortQuestion, shownInsight, toYm,
} from '@lifetracker/core';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ExpandButton from '../../components/tree/ExpandButton';
import { Field, Textarea } from '../../components/ui/Field';
import { Alert, EmptyState, PageHeader, Skeleton } from '../../components/ui/Bits';
import OpenAIError from './OpenAIError';

// AI insights for a budget month. Generate asks my API, which sends OpenAI a summary of the month
// (categories, merchants, budgets and debts; no account numbers, ids or aliases) and saves the answer.
// The browser never talks to OpenAI. A month's latest insight is shown until I regenerate it, and
// "What was sent" shows exactly what OpenAI saw. An optional question is answered at the top of a
// new insight (a question always asks afresh).
export default function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const param = params.get('month');
  const view = useData(`budget-${param ?? 'now'}`, () => {
    const [y, m] = (param ?? '').split('-').map(Number);
    return param ? getBudgetMonth(y, m) : getBudgetMonth();
  });
  const insights = useData('insights', getInsights);
  const { refresh } = useRefresh();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [question, setQuestion] = useState('');
  const asking = hasQuestion(question);

  const b = view.data?.budget;
  const ym = b ? toYm(b.year, b.month) : null;
  const forMonth = b ? insightsForMonth(insights.data ?? [], b.year, b.month) : [];
  const shown = shownInsight(forMonth, selectedId);

  function goTo(month: string, id: number | null = null) {
    setSelectedId(id);
    setError(null);
    setShowPrompt(false);
    setConfirmingDelete(false);
    setParams({ month }, { replace: true });
  }

  async function generate() {
    if (!b) return;
    setGenerating(true);
    setError(null);
    try {
      const insight = await generateInsight(b.year, b.month, shown !== undefined, question);
      setSelectedId(insight.id);
      setShowPrompt(false);
      setQuestion('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function remove(insight: Insight) {
    setError(null);
    try {
      await deleteInsight(insight.id);
      setSelectedId(null);
      setConfirmingDelete(false);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Insights"
        description="An AI read of a budget month: possible waste, ways to save, and how it fits with paying off debt." />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon="chevronLeft" aria-label="Previous month" disabled={!ym || generating}
          onClick={() => ym && goTo(shiftMonth(ym, -1))} />
        <h2 className="text-center text-lg font-semibold">{b ? periodLabel(b) : '…'}</h2>
        <Button variant="ghost" size="sm" icon="chevronRight" aria-label="Next month" disabled={!ym || generating}
          onClick={() => ym && goTo(shiftMonth(ym, 1))} />
      </div>

      {(view.error || insights.error) && <Alert tone="negative" className="mb-6">{view.error ?? insights.error}</Alert>}
      {error && (
        <Alert tone="negative" className="mb-6">
          <OpenAIError error={error} />
        </Alert>
      )}
      {generating && (
        <Alert className="mb-6">{generatingNote(b?.year, b?.month, asking)}</Alert>
      )}

      {!b || !insights.data ? <Skeleton className="h-96" /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-2">
            <Card>
              <Field label={questionLabel} hint={questionNote}>
                {(id) => <Textarea id={id} rows={3} maxLength={maxQuestionLength} value={question} disabled={generating}
                  placeholder={questionPlaceholder} onChange={(e) => setQuestion(e.target.value)} />}
              </Field>
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-xs text-muted tabular-nums">{questionCounter(question)}</p>
                <Button variant="primary" icon="sparkles" onClick={generate} disabled={generating}>
                  {generateLabel(generating, shown !== undefined, asking)}
                </Button>
              </div>
            </Card>

            <div className={cn('grid content-start gap-6', generating && 'opacity-60')}>
              {!shown ? (
                <Card>
                  <EmptyState icon="sparkles" title="No insight for this month yet">
                    Your API sends OpenAI a summary of this month's spending, budgets and debts, and saves what comes back.
                    Account numbers, ids and aliases are left out.
                  </EmptyState>
                </Card>
              ) : (
                <InsightView insight={shown} showPrompt={showPrompt} onTogglePrompt={() => setShowPrompt((s) => !s)}
                  confirmingDelete={confirmingDelete} onDelete={() => setConfirmingDelete(true)}
                  onCancelDelete={() => setConfirmingDelete(false)} onConfirmDelete={() => remove(shown)} />
              )}
            </div>
          </div>

          <Card title="Past insights" className="content-start">
            {insights.data.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="-my-1 grid gap-1">
                {insights.data.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => goTo(toYm(i.year, i.month), i.id)}
                      aria-current={shown?.id === i.id ? 'true' : undefined}
                      className={cn(
                        '-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted',
                        shown?.id === i.id && 'bg-accent-soft hover:bg-accent-soft',
                      )}>
                      <span className="block font-medium">{monthName(i.year, i.month)}</span>
                      {i.question && <span className="block text-xs text-ink">“{shortQuestion(i.question)}”</span>}
                      <span className="block text-xs text-muted">{formatDateTime(i.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function InsightView({ insight, showPrompt, onTogglePrompt, confirmingDelete, onDelete, onCancelDelete, onConfirmDelete }: {
  insight: Insight;
  showPrompt: boolean;
  onTogglePrompt: () => void;
  confirmingDelete: boolean;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const r = insight.result;
  const promptId = `prompt-${insight.id}`;

  return (
    <>
      {insight.question && (
        <Card title="Your question">
          <p className="border-l-2 border-accent pl-3 text-sm text-muted whitespace-pre-line">{insight.question}</p>
          {r.answer && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{r.answer}</p>}
        </Card>
      )}

      <Card title="Summary">
        <p className="text-sm leading-relaxed whitespace-pre-line">{r.summary}</p>
      </Card>

      <Card title="Possible waste" description="Spending that might not be worth what it costs.">
        {r.wasteItems.length === 0 ? <p className="text-sm text-muted">Nothing stood out this month.</p> : (
          <ul className="-my-3 divide-y divide-line">
            {r.wasteItems.map((w, n) => (
              <li key={n} className="py-3">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <p className="font-medium">{w.name}</p>
                  <p className="shrink-0 tabular-nums">{formatMoney(w.monthlyAmount)}<span className="text-muted">/month</span></p>
                </div>
                {w.reason && <p className="mt-1 text-sm text-muted">{w.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Ways to save"
        description={savingsNote(insight) ?? undefined}>
        {r.savingTips.length === 0 ? <p className="text-sm text-muted">No suggestions this time.</p> : (
          <ul className="-my-3 divide-y divide-line">
            {r.savingTips.map((t, n) => (
              <li key={n} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                <p>{t.tip}</p>
                <p className="shrink-0 font-medium text-positive tabular-nums">{formatMoney(t.estimatedMonthlySaving)}<span className="font-normal text-muted">/month</span></p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Debt advice">
        <p className="text-sm leading-relaxed whitespace-pre-line">{r.debtAdvice}</p>
      </Card>

      <div className="rounded-xl bg-surface-muted p-4 text-xs text-muted">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p>{insightFooter(insight)}</p>
          {!confirmingDelete && <Button key="delete" size="sm" variant="ghost" icon="trash" onClick={onDelete}>Delete</Button>}
        </div>
        {confirmingDelete && (
          <div key="confirm-delete" className="mt-3 flex flex-col gap-3 rounded-lg bg-negative-soft p-3 text-ink sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Delete this insight? Generating again asks OpenAI afresh.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onCancelDelete}>Keep it</Button>
              <Button size="sm" variant="destructive" icon="trash" onClick={onConfirmDelete}>Delete</Button>
            </div>
          </div>
        )}
        <p className="mt-2">General information from an AI, not financial advice.</p>

        <div className="mt-3 border-t border-line pt-3 text-sm text-ink">
          <ExpandButton expanded={showPrompt} controls={promptId} onClick={onTogglePrompt} className="font-medium">
            What was sent
          </ExpandButton>
          {showPrompt && (
            <pre id={promptId} className="mt-2 max-h-96 overflow-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {insight.promptSent}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
