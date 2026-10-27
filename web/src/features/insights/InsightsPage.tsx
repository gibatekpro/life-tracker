import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { deleteInsight, generateInsight, getBudgetMonth, getInsights } from '../../api';
import type { Insight } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import { formatDate, formatMoney, monthName, periodLabel } from '@lifetracker/core';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ExpandButton from '../../components/tree/ExpandButton';
import { Alert, EmptyState, PageHeader, Skeleton } from '../../components/ui/Bits';

const NotConfigured = 'OpenAI key not configured';

function shiftMonth(ym: string, by: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// AI insights for a budget month. Generate asks my API, which sends OpenAI a summary of the month
// (categories, merchants, budgets and debts; no account numbers, ids or aliases) and saves the answer.
// The browser never talks to OpenAI. A month's latest insight is shown until I regenerate it, and
// "What was sent" shows exactly what OpenAI saw.
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

  const b = view.data?.budget;
  const ym = b ? `${b.year}-${String(b.month).padStart(2, '0')}` : null;
  const forMonth = (insights.data ?? []).filter((i) => b && i.year === b.year && i.month === b.month);
  // The one picked from the list, if it's this month's; otherwise the month's newest (the list is newest first).
  const shown = forMonth.find((i) => i.id === selectedId) ?? forMonth[0];

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
      const insight = await generateInsight(b.year, b.month, shown !== undefined);
      setSelectedId(insight.id);
      setShowPrompt(false);
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
        description="An AI read of a budget month: possible waste, ways to save, and how it fits with paying off debt."
        actions={b && (
          <Button variant="primary" icon="sparkles" onClick={generate} disabled={generating || insights.loading && !insights.data}>
            {generating ? 'Generating…' : shown ? 'Regenerate' : 'Generate'}
          </Button>
        )} />

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
          {error === NotConfigured ? (
            <>
              <p className="font-medium">No OpenAI key is set up yet.</p>
              <p className="mt-1">
                In the <code className="font-mono">api</code> folder, run{' '}
                <code className="font-mono break-all">dotnet user-secrets set "OpenAI:ApiKey" "&lt;your key&gt;"</code>{' '}
                and restart the API. The key stays in the API; this page never sees it.
              </p>
            </>
          ) : error}
        </Alert>
      )}
      {generating && (
        <Alert className="mb-6">Asking OpenAI about {b ? monthName(b.year, b.month) : 'this month'}. This can take up to a minute.</Alert>
      )}

      {!b || !insights.data ? <Skeleton className="h-96" /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className={cn('grid content-start gap-6 lg:col-span-2', generating && 'opacity-60')}>
            {!shown ? (
              <Card>
                <EmptyState icon="sparkles" title="No insight for this month yet"
                  action={<Button variant="primary" icon="sparkles" onClick={generate} disabled={generating}>Generate</Button>}>
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

          <Card title="Past insights" className="content-start">
            {insights.data.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="-my-1 grid gap-1">
                {insights.data.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => goTo(`${i.year}-${String(i.month).padStart(2, '0')}`, i.id)}
                      aria-current={shown?.id === i.id ? 'true' : undefined}
                      className={cn(
                        '-mx-2 w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted',
                        shown?.id === i.id && 'bg-accent-soft hover:bg-accent-soft',
                      )}>
                      <span className="block font-medium">{monthName(i.year, i.month)}</span>
                      <span className="block text-xs text-muted">{formatWhen(i.createdAt)}</span>
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
  const totalSaving = r.savingTips.reduce((sum, t) => sum + t.estimatedMonthlySaving, 0);
  const promptId = `prompt-${insight.id}`;

  return (
    <>
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
        description={r.savingTips.length > 0 ? `Up to about ${formatMoney(totalSaving)} a month, if you did them all.` : undefined}>
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
          <p>
            Generated {formatWhen(insight.createdAt)} · {insight.model} · {insight.inputTokens.toLocaleString('en-GB')} in
            + {insight.outputTokens.toLocaleString('en-GB')} out tokens · for the month from {formatDate(insight.periodStart)}
          </p>
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
