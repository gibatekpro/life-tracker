import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { getAccounts, getDebts, getExchangeRates } from '../../api';
import type { Account, DebtWithProjection, ExchangeRate } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { formatMoney, formatMonthYear } from '../../lib/format';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { Alert, Badge, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../components/ui/Bits';
import { useQuickAdd } from '../transactions/quickAdd';
import AccountForm from './AccountForm';
import { payDraft, typeIcon, typeLabel } from './accountLabels';
import { ApproxPounds, RateNote } from './Converted';

function CurrentTile({ a, rates }: { a: Account; rates: ExchangeRate[] | undefined }) {
  return (
    <Link to={`/accounts/${a.id}`}
      className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:border-accent/40">
      <div className="flex items-center justify-between">
        <div className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><Icon name={typeIcon[a.type]} className="size-4" /></div>
        {a.currency !== 'GBP' && <Badge>{a.currency}</Badge>}
      </div>
      <p className="mt-4 text-sm text-muted">{a.name}</p>
      <p className={cn('mt-1 text-2xl font-semibold tracking-tight tabular-nums', a.balance < 0 && 'text-negative')}>
        {formatMoney(a.balance, a.currency)}
      </p>
      <ApproxPounds amount={a.balance} currency={a.currency} rates={rates} />
    </Link>
  );
}

function DebtTile({ item, rates, onPay }: { item: DebtWithProjection; rates: ExchangeRate[] | undefined; onPay: () => void }) {
  const { debt: d, projection: p } = item;
  const used = d.creditLimit ? d.balance / d.creditLimit : null;
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/accounts/${d.id}`} className="flex min-w-0 items-center gap-3 hover:underline">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-negative-soft text-negative"><Icon name={typeIcon[d.type]} className="size-4" /></div>
          <span className="truncate font-medium">{d.name}</span>
        </Link>
        <div className="flex gap-1.5">
          {d.currency !== 'GBP' && <Badge>{d.currency}</Badge>}
          <Badge>{typeLabel[d.type]}</Badge>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">Owed</p>
      <p className="text-2xl font-semibold tracking-tight text-negative tabular-nums">{formatMoney(d.balance, d.currency)}</p>
      <ApproxPounds amount={d.balance} currency={d.currency} rates={rates} />

      {used !== null && (
        <div className="mt-3">
          <ProgressBar label="Credit used" value={used} tone={used > 0.9 ? 'negative' : used > 0.75 ? 'warning' : 'accent'} />
          <p className="mt-1.5 text-xs text-muted">
            {formatMoney(d.availableCredit ?? 0, d.currency)} available of {formatMoney(d.creditLimit!, d.currency)}
          </p>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
        <div><dt className="text-xs text-muted">APR</dt><dd className="tabular-nums">{d.apr}%</dd></div>
        <div><dt className="text-xs text-muted">Paying</dt><dd className="tabular-nums">{formatMoney(d.monthlyPayment, d.currency)}</dd></div>
        <div>
          <dt className="text-xs text-muted">Paid off</dt>
          <dd className={cn(!p.canBePaidOff && 'text-negative')}>{p.canBePaidOff ? formatMonthYear(p.payoffDate) : 'Never'}</dd>
        </div>
      </dl>
      {!p.canBePaidOff && (
        <p className="mt-2 text-xs text-negative">The payment doesn't cover the interest, so this never shrinks.</p>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <Button variant="primary" size="sm" className="flex-1" onClick={onPay}>Pay</Button>
        <Link to={`/accounts/${d.id}`} className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-line text-sm font-medium hover:bg-surface-muted">
          Details
        </Link>
      </div>
    </div>
  );
}

// All my accounts: what I have, then what I owe, with the totals that matter on top.
export default function AccountsPage() {
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const rates = useData('rates', getExchangeRates);
  const openQuickAdd = useQuickAdd();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const current = (accounts.data ?? []).filter((a) => a.type === 'Current');
  const o = debts.data;
  const foreign = [...new Set((accounts.data ?? []).map((a) => a.currency).filter((c) => c !== 'GBP'))];

  return (
    <>
      <PageHeader title="Accounts" description="Bank accounts, credit cards and loans."
        actions={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add account</Button>} />

      {(accounts.error || debts.error) && <Alert tone="negative" className="mb-6">{accounts.error ?? debts.error}</Alert>}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>{o ? <Stat label="Total owed" value={formatMoney(o.totalBalance)} valueClassName="text-negative" /> : <Skeleton className="h-16" />}</Card>
        <Card>{o ? <Stat label="Paying each month" value={formatMoney(o.totalMonthlyPayment)} /> : <Skeleton className="h-16" />}</Card>
        <Card>{o ? <Stat label="Interest still to pay" value={formatMoney(o.totalInterest)} /> : <Skeleton className="h-16" />}</Card>
        <Card>{o ? <Stat label="Debt-free" value={o.debts.length ? formatMonthYear(o.debtFreeDate) : 'Already'} valueClassName="text-positive" /> : <Skeleton className="h-16" />}</Card>
      </div>

      {foreign.length > 0 && (
        <div className="-mt-4 mb-6 grid gap-1">
          {foreign.map((c) => <RateNote key={c} currency={c} rates={rates.data} />)}
        </div>
      )}

      {o && o.currenciesWithoutRate.length > 0 && (
        <Alert tone="warning" className="mb-6">
          {o.currenciesWithoutRate.join(', ')} debts aren't in these £ totals yet. Record a transfer between pounds and
          {' '}{o.currenciesWithoutRate.join('/')} and they'll be converted at that rate.
        </Alert>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Money</h2>
        {!accounts.data ? <Skeleton className="h-32" /> : current.length === 0 ? (
          <Card><EmptyState icon="bank" title="No bank accounts yet" action={<Button onClick={() => setAdding(true)}>Add one</Button>} /></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((a) => <CurrentTile key={a.id} a={a} rates={rates.data} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Debts</h2>
        {!o ? <Skeleton className="h-48" /> : o.debts.length === 0 ? (
          <Card><EmptyState icon="card" title="No debts">Credit cards and loans you add appear here with their payoff dates.</EmptyState></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {o.debts.map((item) => (
              <DebtTile key={item.debt.id} item={item} rates={rates.data} onPay={() => openQuickAdd(payDraft(item.debt, accounts.data ?? []))} />
            ))}
          </div>
        )}
      </section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add account"
        description="A bank account, a credit card, or a loan.">
        <AccountForm onDone={(created) => { setAdding(false); if (created) navigate(`/accounts/${created.id}`); }} />
      </Modal>
    </>
  );
}
