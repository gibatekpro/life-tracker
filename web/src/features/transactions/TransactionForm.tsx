import { useState, type FormEvent } from 'react';
import { createTransaction, deleteTransaction, updateTransaction } from '../../api';
import type { Account, Category, ExchangeRate, Transaction, TransactionType } from '@lifetracker/core';
import { useRefresh } from '../../data/refresh';
import {
  buildTransactionRequest, currencySymbol, describeForm, formatMoney, initialFormValues, todayIso, withAccount, withType,
} from '@lifetracker/core';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput } from '../../components/ui/Field';
import { Alert, SegmentedControl } from '../../components/ui/Bits';
import AccountSelect from '../accounts/AccountSelect';
import CategorySelect from '../categories/CategorySelect';
import CascadingCategoryPicker from '../categories/CascadingCategoryPicker';
import { useIsSmallScreen } from '../../hooks/useIsSmallScreen';
import type { TransactionDraft } from './quickAdd';

const types: { value: TransactionType; label: string }[] = [
  { value: 'Expense', label: 'Expense' },
  { value: 'Income', label: 'Income' },
  { value: 'Transfer', label: 'Transfer' },
];

// Recording money moving: spending, money coming in, or a transfer between my own accounts
// (which includes paying off a card or loan). The fields adapt to what's being recorded:
// a transfer between currencies asks what arrived, and anything not in pounds can take a £ value.
//
// With `transaction`, the same form edits it (and can delete it); the API moves the balances to match.
// The rules (what it starts with, the received amount from the rate, the request) are core's
// transactionForm.ts, shared with the phone; this draws them.
export default function TransactionForm({ accounts, categories: allCategories, rates, draft, transaction: t, onDone }: {
  accounts: Account[];
  categories: Category[];
  rates: ExchangeRate[];
  draft?: TransactionDraft;
  transaction?: Transaction;
  onDone: () => void;
}) {
  const { refresh } = useRefresh();
  const editing = t !== undefined;
  // On small screens the category is picked one level at a time; larger screens list the whole tree.
  const small = useIsSmallScreen();

  const [values, setValues] = useState(() =>
    initialFormValues({ accounts, categories: allCategories, draft, transaction: t, today: todayIso() }));
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { type, amount, description, accountId, toAccountId, gbpAmount, date } = values;
  const view = describeForm(values, { accounts, categories: allCategories, rates });
  const { isTransfer, to, fromCurrency, crossesCurrencies, asksForPounds, receivedShown, estimatedPounds } = view;
  const chosenCategory = view.chosenCategoryId;

  function changeType(next: TransactionType) {
    setValues((v) => withType(v, next, allCategories));
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const built = buildTransactionRequest(values, view);
    if (built.error !== undefined) { setError(built.error); return; }
    setSaving(true);
    setError(null);
    try {
      if (t) await updateTransaction(t.id, built.request);
      else await createTransaction(built.request);
      refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!t) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTransaction(t.id);
      refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <SegmentedControl label="Type" options={types} value={type} onChange={changeType} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isTransfer ? 'From' : 'Account'}>
          {(id) => (
            <AccountSelect id={id} accounts={accounts} required value={accountId ?? ''}
              // Can't transfer to the same account: choosing it clears the destination.
              onChange={(e) => setValues((v) => withAccount(v, Number(e.target.value)))} />
          )}
        </Field>
        {isTransfer ? (
          <Field label="To">
            {(id) => (
              <AccountSelect id={id} accounts={accounts.filter((a) => a.id !== accountId)} required
                placeholder="Choose an account" value={toAccountId ?? ''}
                onChange={(e) => set({ toAccountId: Number(e.target.value) })} />
            )}
          </Field>
        ) : (
          <Field label="Category">
            {(id) => small ? (
              <CascadingCategoryPicker id={id} categories={allCategories} kind={type === 'Income' ? 'Income' : 'Expense'}
                value={chosenCategory} onChange={(categoryId) => set({ categoryId })} />
            ) : (
              <CategorySelect id={id} required categories={allCategories} kind={type === 'Income' ? 'Income' : 'Expense'}
                value={chosenCategory} onChange={(e) => set({ categoryId: Number(e.target.value) })} />
            )}
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={crossesCurrencies ? `Sent (${fromCurrency})` : 'Amount'}>
          {(id) => (
            <MoneyInput id={id} symbol={currencySymbol(fromCurrency)} required autoFocus={!editing} placeholder="0.00"
              value={amount} onChange={(e) => set({ amount: e.target.value })} />
          )}
        </Field>
        {crossesCurrencies ? (
          <Field label={`Received (${to!.currency})`} hint={view.receivedHint}>
            {(id) => (
              <MoneyInput id={id} symbol={currencySymbol(to!.currency)} required placeholder="0.00"
                value={receivedShown} onChange={(e) => set({ toAmount: e.target.value, toAmountTyped: true })} />
            )}
          </Field>
        ) : (
          <Field label="Date">
            {(id) => <Input id={id} type="date" required value={date} onChange={(e) => set({ date: e.target.value })} />}
          </Field>
        )}
      </div>

      {crossesCurrencies && (
        <Field label="Date">
          {(id) => <Input id={id} type="date" required value={date} onChange={(e) => set({ date: e.target.value })} />}
        </Field>
      )}

      <Field label="Description" hint={isTransfer ? 'Optional for transfers' : undefined}>
        {(id) => (
          <Input id={id} required={!isTransfer} maxLength={200} value={description}
            placeholder={isTransfer ? (to ? `Payment to ${to.name}` : 'e.g. Card repayment') : 'e.g. Tesco'}
            onChange={(e) => set({ description: e.target.value })} />
        )}
      </Field>

      {asksForPounds && (
        <Field label="Value in pounds"
          hint={editing ? 'Clear it to recalculate at the exchange rate.' : "Optional. Left blank, it's worked out at the exchange rate (Settings → Currencies)."}>
          {(id) => (
            <MoneyInput id={id} symbol="£" placeholder={estimatedPounds ? `Automatic: ≈ ${estimatedPounds}` : 'Automatic'} value={gbpAmount}
              onChange={(e) => set({ gbpAmount: e.target.value })} />
          )}
        </Field>
      )}

      {error && <Alert tone="negative">{error}</Alert>}

      {/* Keyed, so React builds new buttons rather than reusing "Save changes" as "Delete". */}
      {confirmingDelete ? (
        <div key="confirm-delete" className="flex flex-col gap-3 rounded-xl bg-negative-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Delete {t!.description || 'this transaction'} ({formatMoney(t!.amount, t!.currency)})? Balances go back as if it never happened.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => setConfirmingDelete(false)}>Keep it</Button>
            <Button size="sm" variant="destructive" icon="trash" onClick={remove} disabled={saving}>Delete</Button>
          </div>
        </div>
      ) : (
        <div key="actions" className="flex items-center justify-between gap-2 pt-1">
          {editing
            ? <Button variant="danger" icon="trash" onClick={() => setConfirmingDelete(true)}>Delete</Button>
            : <span />}
          <div className="flex gap-2">
            <Button onClick={onDone}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || accounts.length === 0}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save transaction'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
