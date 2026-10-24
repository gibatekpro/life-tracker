import { useState, type FormEvent } from 'react';
import { createCategory, updateCategory } from '../../api';
import type { Category, CategoryKind } from '../../types';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Bits';
import CategorySelect from './CategorySelect';

// A category and everything under it, so it can't be moved under one of its own subcategories.
function withDescendants(id: number, categories: Category[]) {
  const found = new Set([id]);
  for (let added = true; added;) {
    added = false;
    for (const c of categories)
      if (c.parentId !== null && found.has(c.parentId) && !found.has(c.id)) { found.add(c.id); added = true; }
  }
  return found;
}

// Adding or editing a category: its name, where it sits in the tree, and (for spending)
// the default monthly budget that every month starts from.
export default function CategoryForm({ kind, category, parentId, categories, onDone }: {
  kind: CategoryKind;
  category?: Category;          // editing this one
  parentId?: number | null;     // or adding one under this parent
  categories: Category[];
  onDone: () => void;
}) {
  const { refresh } = useRefresh();
  const [name, setName] = useState(category?.name ?? '');
  const [parent, setParent] = useState<number | null>(category?.parentId ?? parentId ?? null);
  const [amount, setAmount] = useState(category?.defaultMonthlyAmount?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      kind,
      parentId: parent,
      defaultMonthlyAmount: kind === 'Expense' && amount !== '' ? Number(amount) : null,
    };
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
        {(id) => <Input id={id} required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'Expense' ? 'e.g. Subscriptions' : 'e.g. Side job'} />}
      </Field>

      <Field label="Inside" hint="Put it under another category to make it a subcategory.">
        {(id) => (
          <CategorySelect id={id} categories={categories} kind={kind} topLevelLabel="Top level (no parent)"
            exclude={category ? withDescendants(category.id, categories) : undefined}
            value={parent} onChange={(e) => setParent(e.target.value === '' ? null : Number(e.target.value))} />
        )}
      </Field>

      {kind === 'Expense' && (
        <Field label="Default monthly budget"
          hint="Optional. Every month starts with this; you can change a single month on the Budget page.">
          {(id) => <MoneyInput id={id} symbol="£" placeholder="No default" value={amount} onChange={(e) => setAmount(e.target.value)} />}
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
