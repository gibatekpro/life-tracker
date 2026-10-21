import { useState, type FormEvent } from 'react';
import { correctTransaction } from '../../api';
import type { Account, Transaction, TransactionType } from '../../types';
import { useRefresh } from '../../data/refresh';
import { currencySymbol, formatDate, formatMoney } from '../../lib/format';
import Button from '../../components/ui/Button';
import { Field, MoneyInput } from '../../components/ui/Field';
import { Alert, SegmentedControl } from '../../components/ui/Bits';
import AccountSelect from '../accounts/AccountSelect';

const types: { value: TransactionType; label: string }[] = [
  { value: 'Expense', label: 'Expense' },
  { value: 'Income', label: 'Income' },
  { value: 'Transfer', label: 'Transfer' },
];

// Fixing a transaction that landed in the wrong place, e.g. an Apple Pay capture that went to
// Lloyds but was really on Aqua, or a card repayment logged as an expense. The API undoes its
// effect on the old balances and applies it to the new ones.
export default function CorrectTransactionForm({ transaction: t, accounts, onDone }: {
  transaction: Transaction;
  accounts: Account[];
  onDone: () => void;
}) {
  const { refresh } = useRefresh();
  const [type, setType] = useState<TransactionType>(t.type);
  const [accountId, setAccountId] = useState(t.accountId);
  const [toAccountId, setToAccountId] = useState<number | undefined>(t.toAccountId ?? undefined);
  const [toAmount, setToAmount] = useState(t.toAmount ? String(t.toAmount) : '');
  const [gbpAmount, setGbpAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The amount is in the transaction's currency, so it can only move to an account in that currency.
  const sameCurrency = accounts.filter((a) => a.currency === t.currency);
  const isTransfer = type === 'Transfer';
  const to = isTransfer ? accounts.find((a) => a.id === toAccountId) : undefined;
  const crossesCurrencies = to !== undefined && to.currency !== t.currency;
  const asksForPounds = t.currency !== 'GBP' && to?.currency !== 'GBP';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await correctTransaction(t.id, {
        type,
        accountId,
        toAccountId: isTransfer ? toAccountId : null,
        toAmount: crossesCurrencies ? Number(toAmount) : null,
        gbpAmount: asksForPounds && gbpAmount !== '' ? Number(gbpAmount) : null,
      });
      refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm">
        <p className="font-medium">{t.description || '—'}</p>
        <p className="text-muted">{formatMoney(t.amount, t.currency)} · {formatDate(t.date)} · {t.category}</p>
      </div>

      <SegmentedControl label="Type" options={types} value={type} onChange={setType} />

      <div className={isTransfer ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
        <Field label={isTransfer ? 'From' : 'Account'}
          hint={sameCurrency.length < accounts.length ? `Only ${t.currency} accounts, as the amount is in ${t.currency}.` : undefined}>
          {(id) => (
            <AccountSelect id={id} accounts={sameCurrency} value={accountId}
              onChange={(e) => {
                const next = Number(e.target.value);
                setAccountId(next);
                if (next === toAccountId) setToAccountId(undefined);
              }} />
          )}
        </Field>
        {isTransfer && (
          <Field label="To">
            {(id) => (
              <AccountSelect id={id} accounts={accounts.filter((a) => a.id !== accountId)} required
                placeholder="Choose an account" value={toAccountId ?? ''}
                onChange={(e) => setToAccountId(Number(e.target.value))} />
            )}
          </Field>
        )}
      </div>

      {crossesCurrencies && (
        <Field label={`Received (${to!.currency})`}>
          {(id) => (
            <MoneyInput id={id} symbol={currencySymbol(to!.currency)} required value={toAmount}
              onChange={(e) => setToAmount(e.target.value)} />
          )}
        </Field>
      )}

      {asksForPounds && (
        <Field label="Value in pounds" hint="Optional. Left blank, it's worked out from your latest £ transfer rate.">
          {(id) => (
            <MoneyInput id={id} symbol="£" placeholder="Automatic" value={gbpAmount}
              onChange={(e) => setGbpAmount(e.target.value)} />
          )}
        </Field>
      )}

      <p className="text-xs text-muted">The amount, date and category stay as they are; both accounts' balances are corrected.</p>

      {error && <Alert tone="negative">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  );
}
