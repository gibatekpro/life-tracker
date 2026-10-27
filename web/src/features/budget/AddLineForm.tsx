import { useState, type FormEvent } from 'react';
import type { Category } from '@lifetracker/core';
import { addLineDefaults, addLineHint } from '@lifetracker/core';
import Button from '../../components/ui/Button';
import { Field, MoneyInput } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Bits';
import CategorySelect from '../categories/CategorySelect';

// Adding a category to this month's budget. The amount starts from the category's default,
// which can be changed for this month only.
export default function AddLineForm({ categories, monthName, onSave, onDone }: {
  categories: Category[];
  monthName: string;
  onSave: (categoryId: number, amount: number) => Promise<void>;
  onDone: () => void;
}) {
  const [initial] = useState(() => addLineDefaults(categories));
  const [categoryId, setCategoryId] = useState<number | undefined>(initial.categoryId);
  const [amount, setAmount] = useState(initial.amount);
  const [error, setError] = useState<string | null>(null);
  const chosen = categories.find((c) => c.id === categoryId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (categoryId === undefined) return;
    setError(null);
    try {
      await onSave(categoryId, Number(amount || 0));
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Category">
        {(id) => (
          <CategorySelect id={id} categories={categories} kind="Expense" value={categoryId}
            onChange={(e) => {
              const next = categories.find((c) => c.id === Number(e.target.value));
              setCategoryId(next?.id);
              setAmount(next?.defaultMonthlyAmount?.toString() ?? '');   // pre-filled with its default
            }} />
        )}
      </Field>
      <Field label={`Budget for ${monthName}`}
        hint={addLineHint(chosen, monthName)}>
        {(id) => <MoneyInput id={id} symbol="£" required value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      {error && <Alert tone="negative">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary">Add to budget</Button>
      </div>
    </form>
  );
}
