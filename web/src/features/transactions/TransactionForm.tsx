import { useState, type FormEvent } from 'react';
import { createTransaction, deleteTransaction, updateTransaction } from '../../api';
import type { Account, Transaction, TransactionType } from '../../types';
import { useRefresh } from '../../data/refresh';
import { currencySymbol, formatMoney, todayIso } from '../../lib/format';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput, Select } from '../../components/ui/Field';
import { Alert, SegmentedControl } from '../../components/ui/Bits';
import AccountSelect from '../accounts/AccountSelect';
import { expenseCategories, incomeCategories } from './categories';
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
export default function TransactionForm({ accounts, draft, transaction: t, onDone }: {
  accounts: Account[];
  draft?: TransactionDraft;
  transaction?: Transaction;
  onDone: () => void;
}) {
  const { refresh } = useRefresh();
  const firstCurrent = accounts.find((a) => a.type === 'Current') ?? accounts[0];
  const editing = t !== undefined;

  const [type, setType] = useState<TransactionType>(t?.type ?? draft?.type ?? 'Expense');
  const [amount, setAmount] = useState(t ? String(t.amount) : draft?.amount ? String(draft.amount) : '');
  const [description, setDescription] = useState(t?.description ?? draft?.description ?? '');
  const [category, setCategory] = useState(t && t.type !== 'Transfer' ? t.category : expenseCategories[0]);
  const [accountId, setAccountId] = useState<number | undefined>(t?.accountId ?? draft?.accountId ?? firstCurrent?.id);
  const [toAccountId, setToAccountId] = useState<number | undefined>(t?.toAccountId ?? draft?.toAccountId);
  const [toAmount, setToAmount] = useState(t?.toAmount ? String(t.toAmount) : '');
  // Keep the £ value an edited naira transaction already has, unless I change or clear it.
  const [gbpAmount, setGbpAmount] = useState(t && t.currency !== 'GBP' && t.toCurrency !== 'GBP' ? String(t.gbpAmount) : '');
  const [date, setDate] = useState(t?.date ?? todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isTransfer = type === 'Transfer';
  const from = accounts.find((a) => a.id === accountId);
  const to = isTransfer ? accounts.find((a) => a.id === toAccountId) : undefined;
  const fromCurrency = from?.currency ?? 'GBP';
  const crossesCurrencies = to !== undefined && to.currency !== fromCurrency;
  // A transfer into pounds already has an exact £ value; anything else not in pounds may need one.
  const asksForPounds = fromCurrency !== 'GBP' && to?.currency !== 'GBP';
  const baseCategories = type === 'Income' ? incomeCategories : expenseCategories;
  // An edited transaction may use a category that's not in the list (e.g. an old "Debt" expense).
  const categories = baseCategories.includes(category) ? baseCategories : [category, ...baseCategories];

  // £10 sent, ₦18,000 received: show the rate that implies, as a sanity check.
  const sent = Number(amount);
  const got = Number(toAmount);
  const rate = crossesCurrencies && sent > 0 && got > 0 ? got / sent : null;

  function changeType(next: TransactionType) {
    setType(next);
    setCategory(next === 'Income' ? incomeCategories[0] : expenseCategories[0]);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (accountId === undefined || (isTransfer && toAccountId === undefined)) return;
    setSaving(true);
    setError(null);
    const body = {
      type,
      amount: sent,
      // A transfer's description can be left blank: it's clear from the accounts.
      description: description.trim() || (to ? `${to.type === 'Current' ? 'Transfer' : 'Payment'} to ${to.name}` : ''),
      // Repaying a card or loan is filed under Debt; moving money between my accounts under Transfer.
      category: isTransfer ? (to && to.type !== 'Current' ? 'Debt' : 'Transfer') : category,
      date,
      accountId,
      toAccountId: isTransfer ? toAccountId : null,
      toAmount: crossesCurrencies ? got : null,
      gbpAmount: asksForPounds && gbpAmount !== '' ? Number(gbpAmount) : null,
    };
    try {
      if (t) await updateTransaction(t.id, body);
      else await createTransaction(body);
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
              onChange={(e) => {
                const next = Number(e.target.value);
                setAccountId(next);
                if (next === toAccountId) setToAccountId(undefined);   // can't transfer to the same account
              }} />
          )}
        </Field>
        {isTransfer ? (
          <Field label="To">
            {(id) => (
              <AccountSelect id={id} accounts={accounts.filter((a) => a.id !== accountId)} required
                placeholder="Choose an account" value={toAccountId ?? ''}
                onChange={(e) => setToAccountId(Number(e.target.value))} />
            )}
          </Field>
        ) : (
          <Field label="Category">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={crossesCurrencies ? `Sent (${fromCurrency})` : 'Amount'}>
          {(id) => (
            <MoneyInput id={id} symbol={currencySymbol(fromCurrency)} required autoFocus={!editing} placeholder="0.00"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        {crossesCurrencies ? (
          <Field label={`Received (${to!.currency})`}
            hint={rate ? `1 ${fromCurrency} = ${rate.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${to!.currency}` : 'What arrived, after the exchange rate'}>
            {(id) => (
              <MoneyInput id={id} symbol={currencySymbol(to!.currency)} required placeholder="0.00"
                value={toAmount} onChange={(e) => setToAmount(e.target.value)} />
            )}
          </Field>
        ) : (
          <Field label="Date">
            {(id) => <Input id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
      </div>

      {crossesCurrencies && (
        <Field label="Date">
          {(id) => <Input id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      )}

      <Field label="Description" hint={isTransfer ? 'Optional for transfers' : undefined}>
        {(id) => (
          <Input id={id} required={!isTransfer} maxLength={200} value={description}
            placeholder={isTransfer ? (to ? `Payment to ${to.name}` : 'e.g. Card repayment') : 'e.g. Tesco'}
            onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>

      {asksForPounds && (
        <Field label="Value in pounds"
          hint={editing ? 'Clear it to recalculate from your latest £ transfer rate.' : "Optional. Left blank, it's worked out from your latest £ transfer rate."}>
          {(id) => (
            <MoneyInput id={id} symbol="£" placeholder="Automatic" value={gbpAmount}
              onChange={(e) => setGbpAmount(e.target.value)} />
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
