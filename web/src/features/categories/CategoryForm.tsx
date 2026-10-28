import { useState, type FormEvent } from 'react';
import { createCategory, updateCategory } from '../../api';
import type { Category, CategoryKind } from '@lifetracker/core';
import { buildCategoryRequest, categoryFormValues, categoryNamePlaceholder, essentialChoice, withDescendants } from '@lifetracker/core';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Bits';
import CategorySelect from './CategorySelect';

// Adding or editing a category: its name, where it sits in the tree, and (for spending) whether
// it's essential and the default monthly budget that every month starts from.
export default function CategoryForm({ kind, category, parentId, categories, onDone }: {
  kind: CategoryKind;
  category?: Category;          // editing this one
  parentId?: number | null;     // or adding one under this parent
  categories: Category[];
  onDone: () => void;
}) {
  const { refresh } = useRefresh();
  const [values, setValues] = useState(() => categoryFormValues(category, parentId));
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const { name, parentId: parent, amount, essential } = values;
  const essentialFrom = essentialChoice(parent, categories);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const built = buildCategoryRequest(values, kind);
    if (built.error !== undefined) { setError(built.error); return; }
    const body = built.request;
    setSaving(true);
    setError(null);
    try {
      if (category) await updateCategory(category.id, body);
      else await createCategory(body);
      refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Name">
        {(id) => <Input id={id} required maxLength={100} autoFocus value={name} onChange={(e) => set({ name: e.target.value })}
          placeholder={categoryNamePlaceholder(kind)} />}
      </Field>

      <Field label="Inside" hint="Put it under another category to make it a subcategory.">
        {(id) => (
          <CategorySelect id={id} categories={categories} kind={kind} topLevelLabel="Top level (no parent)"
            exclude={category ? withDescendants(category.id, categories) : undefined}
            value={parent} onChange={(e) => set({ parentId: e.target.value === '' ? null : Number(e.target.value) })} />
        )}
      </Field>

      {kind === 'Expense' && (
        <label className="flex items-start gap-3 rounded-xl bg-surface-muted p-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-accent" checked={essentialFrom.locked || essential}
            disabled={essentialFrom.locked} onChange={(e) => set({ essential: e.target.checked })} />
          <span>
            <span className="font-medium">Essential</span>
            <span className="block text-xs text-muted">{essentialFrom.hint}</span>
          </span>
        </label>
      )}

      {kind === 'Expense' && (
        <Field label="Default monthly budget"
          hint="Optional. Every month starts with this; you can change a single month on the Budget page.">
          {(id) => <MoneyInput id={id} symbol="£" placeholder="No default" value={amount} onChange={(e) => set({ amount: e.target.value })} />}
        </Field>
      )}

      {error && <Alert tone="negative">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : category ? 'Save changes' : 'Add category'}
        </Button>
      </div>
    </form>
  );
}
