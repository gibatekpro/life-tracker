import { useState, type FormEvent } from 'react';
import { getCategories, markPlannedPurchaseBought } from '../../api';
import type { Category, PlannedPurchase } from '@lifetracker/core';
import { boughtFormValues, boughtNote, buildBoughtRequest, todayIso } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput } from '../../components/ui/Field';
import { Alert, Skeleton } from '../../components/ui/Bits';
import CategorySelect from '../categories/CategorySelect';

// "Mark as bought": records what it cost as an expense from its savings account and marks it bought.
// Anything left over stays in the account.
export default function BoughtForm({ purchase, onDone }: { purchase: PlannedPurchase; onDone: () => void }) {
  const categories = useData('categories', getCategories);
  if (categories.error) return <Alert tone="negative">{categories.error}</Alert>;
  if (!categories.data) return <Skeleton className="h-64" />;
  return <Form purchase={purchase} categories={categories.data} onDone={onDone} />;
}

function Form({ purchase, categories, onDone }: { purchase: PlannedPurchase; categories: Category[]; onDone: () => void }) {
  const { refresh } = useRefresh();
  const [values, setValues] = useState(() => boughtFormValues(purchase, categories, todayIso()));
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const built = buildBoughtRequest(values);
    if (built.error !== undefined) { setError(built.error); return; }
    setSaving(true);
    setError(null);
    try {
      await markPlannedPurchaseBought(purchase.id, built.request);
      refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm text-muted">{boughtNote(purchase)}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What it cost">
          {(id) => <MoneyInput id={id} symbol="£" required autoFocus value={values.amount} onChange={(e) => set({ amount: e.target.value })} />}
        </Field>
        <Field label="Date">
          {(id) => <Input id={id} type="date" required value={values.date} onChange={(e) => set({ date: e.target.value })} />}
        </Field>
      </div>
      <Field label="Category">
        {(id) => <CategorySelect id={id} categories={categories} kind="Expense" value={values.categoryId}
          onChange={(e) => set({ categoryId: Number(e.target.value) })} />}
      </Field>
      <Field label="Description">
        {(id) => <Input id={id} maxLength={200} value={values.description} onChange={(e) => set({ description: e.target.value })} />}
      </Field>

      {error && <Alert tone="negative">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Mark as bought'}</Button>
      </div>
    </form>
  );
}
