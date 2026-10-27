import { useState, type FormEvent } from 'react';
import { clearExchangeRate, getExchangeRates, getSettings, setExchangeRate, updateSettings } from '../../api';
import type { ExchangeRate } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import { currencySymbol, describeSource, formatRate } from '@lifetracker/core';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Input } from '../../components/ui/Field';
import { Alert, Badge, EmptyState, Skeleton } from '../../components/ui/Bits';

// One direction: "£1 = ₦1,850", where it comes from, and editing my own rate in place.
function RateRow({ r }: { r: ExchangeRate }) {
  const { refresh } = useRefresh();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      setEditing(false);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => setExchangeRate(r.from, r.to, Number(value)));
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium tabular-nums">
          {currencySymbol(r.from)}1 = {r.rate !== null ? `${currencySymbol(r.to)}${formatRate(r.rate)}` : '—'}
          <span className="ml-2 text-xs font-normal text-muted">{r.from} → {r.to}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {r.source === 'Manual' && <Badge tone="accent">Yours</Badge>}
          {describeSource(r)}
        </p>
      </div>

      {editing ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <Input type="number" step="any" min="0" inputMode="decimal" autoFocus required className="w-32 tabular-nums"
            aria-label={`${r.from} to ${r.to} rate`} value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} />
          <Button size="sm" type="submit" variant="primary">Save</Button>
          <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </form>
      ) : (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon="pencil" onClick={() => { setValue(String(r.manualRate ?? r.rate ?? '')); setEditing(true); }}>
            {r.manualRate !== null ? 'Change' : 'Set my rate'}
          </Button>
          {r.manualRate !== null && (
            <Button size="sm" variant="ghost" icon="undo" onClick={() => run(() => clearExchangeRate(r.from, r.to))}>Clear</Button>
          )}
        </div>
      )}
      {error && <p className="w-full text-xs text-negative">{error}</p>}
    </li>
  );
}

// The exchange rates used to value other currencies in pounds (and to pre-fill transfers),
// one per direction, since sending money and converting it back are usually at different rates.
export default function CurrenciesCard() {
  const rates = useData('rates', getExchangeRates);
  const settings = useData('settings', getSettings);
  const { refresh } = useRefresh();
  const [error, setError] = useState<string | null>(null);

  const currencies = [...new Set((rates.data ?? []).map((r) => (r.from === 'GBP' ? r.to : r.from)))];
  const s = settings.data;

  async function toggleTransferRates(useTransferRates: boolean) {
    if (!s) return;
    setError(null);
    try {
      await updateSettings({ monthlyIncome: s.monthlyIncome, monthlyDebtBudget: s.monthlyDebtBudget, useTransferRates });
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card title="Currencies"
      description="Rates for valuing other currencies in pounds and pre-filling transfers. Each direction can differ; set one and the other uses its inverse.">
      {!rates.data ? <Skeleton className="h-32" /> : currencies.length === 0 ? (
        <EmptyState icon="swap" title="Only pounds so far">Add an account in another currency to set its rates.</EmptyState>
      ) : (
        <div className="grid gap-4">
          {currencies.map((c) => (
            <section key={c}>
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{c}</h3>
              <ul className="divide-y divide-line">
                {rates.data!.filter((r) => r.from === c || r.to === c).map((r) => <RateRow key={`${r.from}-${r.to}`} r={r} />)}
              </ul>
            </section>
          ))}
        </div>
      )}

      {s && (
        <label className="mt-4 flex items-start gap-3 rounded-xl bg-surface-muted p-3 text-sm">
          <input type="checkbox" className="mt-0.5 accent-accent" checked={s.useTransferRates}
            onChange={(e) => toggleTransferRates(e.target.checked)} />
          <span>
            <span className="font-medium">Always use my latest transfer's rate</span>
            <span className="block text-xs text-muted">Your own rates are then only used until there's a transfer to take a rate from.</span>
          </span>
        </label>
      )}
      {error && <Alert tone="negative" className="mt-3">{error}</Alert>}
      <p className="mt-3 text-xs text-muted">Changing a rate never changes the £ value already stored on past transactions.</p>
    </Card>
  );
}
