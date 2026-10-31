import { useState, type FormEvent } from 'react';
import { createAccount, updateAccount } from '../../api';
import type { Account, AccountType } from '@lifetracker/core';
import { useRefresh } from '../../data/refresh';
import {
  accountFormValues, accountNamePlaceholder, balanceField, buildAccountRequest, currencyChoices, currencySymbol, isDebtType,
  showsLoanAppHint,
} from '@lifetracker/core';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput, Select } from '../../components/ui/Field';
import { Alert, SegmentedControl } from '../../components/ui/Bits';

const types: { value: AccountType; label: string }[] = [
  { value: 'Current', label: 'Current' },
  { value: 'Savings', label: 'Savings' },
  { value: 'CreditCard', label: 'Credit card' },
  { value: 'Loan', label: 'Loan' },
];

// Adding or editing an account. The same form covers a bank account (just a balance), a credit
// card (what's owed, APR, payments, limit) and a loan, including Nigerian loan apps. Its rules are
// core's accountForm.ts, shared with the phone.
export default function AccountForm({ account, onDone }: { account?: Account; onDone: (created?: Account) => void }) {
  const { refresh } = useRefresh();
  const [values, setValues] = useState(() => accountFormValues(account));
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const { name, type, currency, balance, apr, minimumPayment, monthlyPayment, creditLimit } = values;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDebt = isDebtType(type);
  const balanceAs = balanceField(type);
  const symbol = currencySymbol(currency);
  const loanAppHint = showsLoanAppHint(values);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const built = buildAccountRequest(values);
    if (built.error !== undefined) { setError(built.error); return; }
    const body = built.request;
    setSaving(true);
    setError(null);
    try {
      if (account) {
        await updateAccount(account.id, body);
        refresh();
        onDone();
      } else {
        const created = await createAccount(body);
        refresh();
        onDone(created);
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <SegmentedControl label="Account type" options={types} value={type} onChange={(t) => set({ type: t })} />

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Name">
          {(id) => (
            <Input id={id} required maxLength={100} autoFocus value={name} onChange={(e) => set({ name: e.target.value })}
              placeholder={accountNamePlaceholder(type)} />
          )}
        </Field>
        <Field label="Currency">
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => set({ currency: e.target.value })}>
              {currencyChoices.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          )}
        </Field>
      </div>

      {loanAppHint && (
        <Alert tone="info">
          For a loan app, enter the <strong>total repayable</strong> the app shows as the amount owed,
          an APR of <strong>0</strong>, and the <strong>instalment</strong> as the monthly payment. Its fees
          and interest are already in the total.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={balanceAs.label} hint={balanceAs.hint}>
          {(id) => (
            <MoneyInput id={id} symbol={symbol} required placeholder="0.00" min={balanceAs.allowNegative ? undefined : 0}
              value={balance} onChange={(e) => set({ balance: e.target.value })} />
          )}
        </Field>
        {isDebt && (
          <Field label="APR" hint="Yearly interest rate, e.g. 24.9">
            {(id) => (
              <div className="relative">
                <Input id={id} type="number" step="0.01" min="0" inputMode="decimal" className="pr-8 tabular-nums"
                  placeholder="0" value={apr} onChange={(e) => set({ apr: e.target.value })} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-subtle">%</span>
              </div>
            )}
          </Field>
        )}
      </div>

      {isDebt && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly payment" hint="What you plan to pay each month">
            {(id) => (
              <MoneyInput id={id} symbol={symbol} required placeholder="0.00"
                value={monthlyPayment} onChange={(e) => set({ monthlyPayment: e.target.value })} />
            )}
          </Field>
          <Field label="Minimum payment">
            {(id) => (
              <MoneyInput id={id} symbol={symbol} placeholder="0.00"
                value={minimumPayment} onChange={(e) => set({ minimumPayment: e.target.value })} />
            )}
          </Field>
        </div>
      )}

      {type === 'CreditCard' && (
        <Field label="Credit limit" hint="Optional. Shows how much credit is left.">
          {(id) => (
            <MoneyInput id={id} symbol={symbol} placeholder="0.00"
              value={creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} />
          )}
        </Field>
      )}

      {account && (
        <p className="text-xs text-muted">
          Changing the balance here sets it directly; it isn't recorded as a transaction.
          Type and currency can't change once the account has transactions.
        </p>
      )}

      {error && <Alert tone="negative">{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button onClick={() => onDone()}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : account ? 'Save changes' : 'Add account'}
        </Button>
      </div>
    </form>
  );
}
