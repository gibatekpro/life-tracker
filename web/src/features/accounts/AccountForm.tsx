import { useState, type FormEvent } from 'react';
import { createAccount, updateAccount } from '../../api';
import type { Account, AccountType } from '@lifetracker/core';
import { useRefresh } from '../../data/refresh';
import { currencySymbol } from '../../lib/format';
import Button from '../../components/ui/Button';
import { Field, Input, MoneyInput, Select } from '../../components/ui/Field';
import { Alert, SegmentedControl } from '../../components/ui/Bits';

const types: { value: AccountType; label: string }[] = [
  { value: 'Current', label: 'Current' },
  { value: 'CreditCard', label: 'Credit card' },
  { value: 'Loan', label: 'Loan' },
];

const currencies = [
  { code: 'GBP', label: 'GBP · British pound' },
  { code: 'NGN', label: 'NGN · Nigerian naira' },
  { code: 'EUR', label: 'EUR · Euro' },
  { code: 'USD', label: 'USD · US dollar' },
];

// Adding or editing an account. The same form covers a bank account (just a balance), a credit
// card (what's owed, APR, payments, limit) and a loan, including Nigerian loan apps.
export default function AccountForm({ account, onDone }: { account?: Account; onDone: (created?: Account) => void }) {
  const { refresh } = useRefresh();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'Current');
  const [currency, setCurrency] = useState(account?.currency ?? 'GBP');
  const [balance, setBalance] = useState(account ? String(account.balance) : '');
  const [apr, setApr] = useState(account ? String(account.apr) : '');
  const [minimumPayment, setMinimumPayment] = useState(account ? String(account.minimumPayment) : '');
  const [monthlyPayment, setMonthlyPayment] = useState(account ? String(account.monthlyPayment) : '');
  const [creditLimit, setCreditLimit] = useState(account?.creditLimit != null ? String(account.creditLimit) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDebt = type !== 'Current';
  const symbol = currencySymbol(currency);
  // Loan apps quote interest per month and add fees up front, so the total repayable already
  // includes the interest; entering an APR as well would count it twice.
  const loanAppHint = type === 'Loan' && currency !== 'GBP';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      type,
      currency,
      balance: Number(balance || 0),
      apr: isDebt ? Number(apr || 0) : 0,
      minimumPayment: isDebt ? Number(minimumPayment || 0) : 0,
      monthlyPayment: isDebt ? Number(monthlyPayment || 0) : 0,
      creditLimit: type === 'CreditCard' && creditLimit !== '' ? Number(creditLimit) : null,
    };
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
      <SegmentedControl label="Account type" options={types} value={type} onChange={setType} />

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Name">
          {(id) => (
            <Input id={id} required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder={type === 'Current' ? 'e.g. Lloyds Current' : type === 'CreditCard' ? 'e.g. Aqua' : 'e.g. FairMoney'} />
          )}
        </Field>
        <Field label="Currency">
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
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
        <Field label={isDebt ? 'Amount owed' : 'Balance'} hint={isDebt ? undefined : 'Can be negative if overdrawn'}>
          {(id) => (
            <MoneyInput id={id} symbol={symbol} required placeholder="0.00" min={isDebt ? 0 : undefined}
              value={balance} onChange={(e) => setBalance(e.target.value)} />
          )}
        </Field>
        {isDebt && (
          <Field label="APR" hint="Yearly interest rate, e.g. 24.9">
            {(id) => (
              <div className="relative">
                <Input id={id} type="number" step="0.01" min="0" inputMode="decimal" className="pr-8 tabular-nums"
                  placeholder="0" value={apr} onChange={(e) => setApr(e.target.value)} />
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
                value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} />
            )}
          </Field>
          <Field label="Minimum payment">
            {(id) => (
              <MoneyInput id={id} symbol={symbol} placeholder="0.00"
                value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} />
            )}
          </Field>
        </div>
      )}

      {type === 'CreditCard' && (
        <Field label="Credit limit" hint="Optional. Shows how much credit is left.">
          {(id) => (
            <MoneyInput id={id} symbol={symbol} placeholder="0.00"
              value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
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
