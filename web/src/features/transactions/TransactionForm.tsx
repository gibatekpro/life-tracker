import { useState, type FormEvent } from 'react';
import { createTransaction } from '../../api';
import type { Account, TransactionType } from '../../types';
import { useRefresh } from '../../data/refresh';
import { currencySymbol, todayIso } from '../../lib/format';
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
export default function TransactionForm({ accounts, draft, onDone }: {
  accounts: Account[];
  draft?: TransactionDraft;
  onDone: () => void;
}) {
  const { refresh } = useRefresh();
  const firstCurrent = accounts.find((a) => a.type === 'Current') ?? accounts[0];

  const [type, setType] = useState<TransactionType>(draft?.type ?? 'Expense');
  const [amount, setAmount] = useState(draft?.amount ? String(draft.amount) : '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [category, setCategory] = useState(expenseCategories[0]);
  const [accountId, setAccountId] = useState<number | undefined>(draft?.accountId ?? firstCurrent?.id);
  const [toAccountId, setToAccountId] = useState<number | undefined>(draft?.toAccountId);
  const [toAmount, setToAmount] = useState('');
  const [gbpAmount, setGbpAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isTransfer = type === 'Transfer';
  const from = accounts.find((a) => a.id === accountId);
  const to = isTransfer ? accounts.find((a) => a.id === toAccountId) : undefined;
  const fromCurrency = from?.currency ?? 'GBP';
  const crossesCurrencies = to !== undefined && to.currency !== fromCurrency;
  // A transfer into pounds already has an exact £ value; anything else not in pounds may need one.
  const asksForPounds = fromCurrency !== 'GBP' && to?.currency !== 'GBP';
  const categories = type === 'Income' ? incomeCategories : expenseCategories;

  // £10 sent, ₦18,000 received: show the rate that implies, as a sanity check.
  const sent = Number(amount);
  const got = Number(toAmount);
  const rate = crossesCurrencies && sent > 0 && got > 0 ? got / sent : null;

  function changeType(t: TransactionType) {
    setType(t);
    setCategory(t === 'Income' ? incomeCategories[0] : expenseCategories[0]);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (accountId === undefined || (isTransfer && toAccountId === undefined)) return;
    setSaving(true);
    setError(null);
    try {
      await createTransaction({
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
            <MoneyInput id={id} symbol={currencySymbol(fromCurrency)} required autoFocus placeholder="0.00"
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
        <Field label="Value in pounds" hint="Optional. Left blank, it's worked out from your latest £ transfer rate.">
          {(id) => (
            <MoneyInput id={id} symbol="£" placeholder="Automatic" value={gbpAmount}
              onChange={(e) => setGbpAmount(e.target.value)} />
          )}
        </Field>
      )}

      {error && <Alert tone="negative">{error}</Alert>}

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving || accounts.length === 0}>
          {saving ? 'Saving…' : 'Save transaction'}
        </Button>
      </div>
    </form>
  );
}
