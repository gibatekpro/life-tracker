import { useState, type FormEvent } from 'react';
import { currencySymbol, formatMoney } from '@lifetracker/core';
import Button from '../../components/ui/Button';
import { MoneyInput } from '../../components/ui/Field';

// A budget amount you click to change in place. Saving sets this month's own figure; when the
// month has one, "Reset" goes back to the default (or takes the line off the month if there's none).
// currency: what the figure is in (a naira loan's debt line is set in ₦).
export default function AmountEditor({ label, shown, current, defaultAmount, monthAmount, onSave, onReset, currency = 'GBP' }: {
  label: string;               // what it's for, for screen readers: "Food"
  shown: number;               // the amount displayed (a parent's includes its subcategories)
  current: number;             // what editing starts from (a parent's own amount)
  defaultAmount: number | null;
  monthAmount: number | null;
  onSave: (amount: number) => Promise<void>;
  onReset: () => Promise<void>;
  currency?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(() => onSave(Number(value || 0)));
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => { setValue(String(current)); setEditing(true); }}
        aria-label={`Change the ${label} budget`}
        className="rounded-md px-1 font-medium tabular-nums underline decoration-subtle decoration-dotted underline-offset-4 hover:bg-surface-muted hover:decoration-accent">
        {shown > 0 ? formatMoney(shown, currency) : 'Set budget'}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center justify-end gap-2">
      <div className="w-32"><MoneyInput symbol={currencySymbol(currency)} autoFocus aria-label={`${label} budget this month`} value={value}
        onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} /></div>
      <Button size="sm" type="submit" variant="primary">Save</Button>
      <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
      {monthAmount !== null && (
        <Button size="sm" variant="ghost" icon="undo" onClick={() => run(onReset)}>
          {defaultAmount !== null ? `Reset to ${formatMoney(defaultAmount, currency)}` : 'Remove from this month'}
        </Button>
      )}
      {error && <p className="w-full text-right text-xs text-negative">{error}</p>}
    </form>
  );
}
