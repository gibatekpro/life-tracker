import { useState, type FormEvent } from 'react';
import { askPurchaseAdvice, createPlannedPurchase, getAccounts, getBudgetMonth, getPlannedPurchases, updatePlannedPurchase } from '../../api';
import type { Account, PlannedPurchase, PurchaseAdvice } from '@lifetracker/core';
import {
  adviceSentNote, askAdviceLabel, askingAdviceNote, buildPurchaseRequest, draftAdviceRequest, withSuggestion, essentialHint, formatMoney, freeSavingsAccounts, monthsHint, newAccountLabel, planChoices,
  purchaseFormValues, purchaseNamePlaceholder, purchasePreview, targetMonthChoices, toYm,
} from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput, Select, Textarea } from '../../components/ui/Field';
import { Alert, SegmentedControl, Skeleton } from '../../components/ui/Bits';
import OpenAIError from '../insights/OpenAIError';
import AdviceView from './AdviceView';

// Adding or editing a planned purchase: its name and target, then one way to plan it (a monthly
// amount, a number of months, or the last month to save in) with the other two worked out as I type
// (core's calculator, the same one the API saves with). Adding can make its savings account too, and
// can ask for AI advice on the draft first. suggestion: advice whose monthly amount to start from.
export default function PlannedPurchaseForm({ purchase, suggestion, onDone }: {
  purchase?: PlannedPurchase;
  suggestion?: PurchaseAdvice;
  onDone: (created?: PlannedPurchase) => void;
}) {
  // The plan starts from the budget month I'm in now, which follows payday.
  const view = useData('budget-now', () => getBudgetMonth());
  const accounts = useData('accounts', getAccounts);
  const purchases = useData('planned-purchases', getPlannedPurchases);
  const b = view.data?.budget;
  const error = view.error ?? accounts.error ?? purchases.error;

  if (error) return <Alert tone="negative">{error}</Alert>;
  if (!b || !accounts.data || !purchases.data) return <Skeleton className="h-96" />;
  return <Form purchase={purchase} suggestion={suggestion} onDone={onDone} currentMonth={toYm(b.year, b.month)}
    savingsAccounts={freeSavingsAccounts(accounts.data, purchases.data)} />;
}

function Form({ purchase, suggestion, onDone, currentMonth, savingsAccounts }: {
  purchase?: PlannedPurchase;
  suggestion?: PurchaseAdvice;
  onDone: (created?: PlannedPurchase) => void;
  currentMonth: string;
  savingsAccounts: Account[];
}) {
  const { refresh } = useRefresh();
  const [values, setValues] = useState(() => {
    const initial = purchaseFormValues(purchase, currentMonth);
    return suggestion ? withSuggestion(initial, suggestion) : initial;
  });
  const [advice, setAdvice] = useState<PurchaseAdvice | null>(null);
  const [asking, setAsking] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = purchase !== undefined;
  // What's saved already comes off the target: the purchase's own savings, or the chosen account's balance.
  const saved = purchase?.saved ?? savingsAccounts.find((a) => a.id === values.accountId)?.balance ?? 0;
  const preview = purchasePreview(values, saved, currentMonth, editing);

  // Advice on the draft, before saving it (nothing is saved but the advice itself).
  async function askFirst() {
    const built = draftAdviceRequest(values, currentMonth);
    if (built.error !== undefined) { setAdviceError(built.error); return; }
    setAsking(true);
    setAdviceError(null);
    try {
      setAdvice(await askPurchaseAdvice({ draft: built.draft }));
    } catch (err) {
      setAdviceError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const built = buildPurchaseRequest(values, saved, currentMonth, editing);
    if (built.error !== undefined) { setError(built.error); return; }
    setSaving(true);
    setError(null);
    try {
      if (purchase) {
        await updatePlannedPurchase(purchase.id, built.request);
        refresh();
        onDone();
      } else {
        const created = await createPlannedPurchase(built.request);
        refresh();
        onDone(created);
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Name">
          {(id) => <Input id={id} required maxLength={100} autoFocus value={values.name} placeholder={purchaseNamePlaceholder}
            onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label="Target">
          {(id) => <MoneyInput id={id} symbol="£" required placeholder="0.00" value={values.target} onChange={(e) => set({ target: e.target.value })} />}
        </Field>
      </div>

      {preview.kind !== 'reached' && (
        <>
          <SegmentedControl label="Plan by" options={planChoices} value={values.choice} onChange={(choice) => set({ choice })} />
          {values.choice === 'monthly' && (
            <Field label="Monthly amount">
              {(id) => <MoneyInput id={id} symbol="£" placeholder="0.00" value={values.monthly} onChange={(e) => set({ monthly: e.target.value })} />}
            </Field>
          )}
          {values.choice === 'months' && (
            <Field label="Number of months" hint={monthsHint}>
              {(id) => <Input id={id} type="number" min={1} max={120} step={1} inputMode="numeric" className="tabular-nums"
                value={values.months} onChange={(e) => set({ months: e.target.value })} />}
            </Field>
          )}
          {values.choice === 'targetMonth' && (
            <Field label="Last month to save in">
              {(id) => (
                <Select id={id} value={values.targetMonth} onChange={(e) => set({ targetMonth: e.target.value })}>
                  <option value="" disabled>Choose a month</option>
                  {targetMonthChoices(currentMonth).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              )}
            </Field>
          )}
        </>
      )}

      <div className="rounded-xl bg-surface-muted p-4" aria-live="polite">
        {preview.kind === 'plan' ? (
          <>
            <dl className="grid grid-cols-3 gap-3">
              {preview.figures.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd className="truncate font-semibold tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
            {preview.note && <p className="mt-2 text-xs text-muted">{preview.note}</p>}
          </>
        ) : (
          <p className={preview.kind === 'error' ? 'text-sm text-negative' : 'text-sm text-muted'}>{preview.message}</p>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-surface-muted p-3 text-sm">
        <input type="checkbox" className="mt-0.5 accent-accent" checked={values.isEssential}
          onChange={(e) => set({ isEssential: e.target.checked })} />
        <span>
          <span className="font-medium">Essential</span>
          <span className="block text-xs text-muted">{essentialHint}</span>
        </span>
      </label>

      {!editing && (
        <Field label="Save into" hint="Money goes in as transfers from a current account.">
          {(id) => (
            <Select id={id} value={values.accountId ?? ''} onChange={(e) => set({ accountId: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">{newAccountLabel}</option>
              {savingsAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)})</option>)}
            </Select>
          )}
        </Field>
      )}

      <Field label="Notes" hint="Optional, e.g. when it's due.">
        {(id) => <Textarea id={id} rows={2} maxLength={1000} value={values.notes} onChange={(e) => set({ notes: e.target.value })} />}
      </Field>

      {!editing && (
        <div className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Not sure yet? Get advice before saving.</p>
            <Button size="sm" icon="sparkles" disabled={asking} onClick={askFirst}>{askAdviceLabel(asking, advice !== null)}</Button>
          </div>
          {asking && <p className="mt-2 text-xs text-muted">{askingAdviceNote(values.name.trim())}</p>}
          {adviceError && <Alert tone="negative" className="mt-3"><OpenAIError error={adviceError} /></Alert>}
          {advice ? (
            <div className="mt-3"><AdviceView advice={advice} onUse={() => setValues((v) => withSuggestion(v, advice))} /></div>
          ) : !asking && <p className="mt-2 text-xs text-muted">{adviceSentNote}</p>}
        </div>
      )}

      {error && <Alert tone="negative">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button onClick={() => onDone()}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add planned purchase'}
        </Button>
      </div>
    </form>
  );
}
