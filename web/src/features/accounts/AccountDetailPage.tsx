import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteAccount, getAccount, getAccountPayments, getAccounts, getDebts, getExchangeRates, getTransactions } from '../../api';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import { formatDate, formatMoney, formatMonthYear } from '../../lib/format';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { Alert, Badge, EmptyState, ProgressBar, Skeleton, Stat } from '../../components/ui/Bits';
import TransactionRow from '../transactions/TransactionRow';
import { useQuickAdd } from '../transactions/quickAdd';
import AccountForm from './AccountForm';
import AliasesCard from './AliasesCard';
import WhatIfCard from './WhatIfCard';
import { isDebt, payDraft, typeIcon, typeLabel } from './accountLabels';
import { ApproxPounds, RateNote } from './Converted';

// One account in full: its balance, and for a card or loan the payoff picture, a what-if,
// and payment history. Also its Apple Pay names, recent transactions, edit and delete.
export default function AccountDetailPage() {
  const id = Number(useParams().id);
  // Once deleted, stop loading it: the refresh after deleting would otherwise ask for it again.
  const [deleted, setDeleted] = useState(false);
  const account = useData(`account-${id}`, () => getAccount(id), !deleted);
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const transactions = useData('transactions', getTransactions);
  const payments = useData(`payments-${id}`, () => getAccountPayments(id), !deleted);
  const rates = useData('rates', getExchangeRates);
  const openQuickAdd = useQuickAdd();
  const { refresh } = useRefresh();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Data for a different account may still be on screen for a moment after navigating.
  const a = account.data?.id === id ? account.data : undefined;
  if (account.error && !a) {
    return <EmptyState icon="wallet" title="Account not found" action={<Link to="/accounts" className="text-accent">Back to accounts</Link>}>{account.error}</EmptyState>;
  }
  if (!a) return <Skeleton className="h-64" />;

  const debt = isDebt(a);
  const projection = debts.data?.debts.find((d) => d.debt.id === id)?.projection;
  const mine = (transactions.data ?? []).filter((t) => t.accountId === id || t.toAccountId === id);
  const used = a.creditLimit ? a.balance / a.creditLimit : null;

  async function remove() {
    setDeleteError(null);
    try {
      await deleteAccount(id);
      setDeleted(true);
      refresh();
      navigate('/accounts');
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <>
      <Link to="/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="size-4" /> Accounts
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={cn('grid size-12 place-items-center rounded-2xl', debt ? 'bg-negative-soft text-negative' : 'bg-accent-soft text-accent')}>
            <Icon name={typeIcon[a.type]} className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
            <div className="mt-1 flex gap-1.5"><Badge>{typeLabel[a.type]}</Badge><Badge>{a.currency}</Badge></div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button icon="pencil" onClick={() => setEditing(true)}>Edit</Button>
          {debt
            ? <Button variant="primary" onClick={() => openQuickAdd(payDraft(a, accounts.data ?? []))}>Pay</Button>
            : <Button variant="primary" icon="plus" onClick={() => openQuickAdd({ accountId: a.id })}>New transaction</Button>}
        </div>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat label={debt ? 'Owed' : 'Balance'} value={formatMoney(a.balance, a.currency)}
            valueClassName={debt || a.balance < 0 ? 'text-negative' : undefined}
            sub={a.currency !== 'GBP' ? <ApproxPounds amount={a.balance} currency={a.currency} rates={rates.data} className="tabular-nums" /> : undefined} />
          {debt && <Stat label="APR" value={`${a.apr}%`} sub={a.apr === 0 ? 'Interest included in the total' : undefined} />}
          {debt && <Stat label="Monthly payment" value={formatMoney(a.monthlyPayment, a.currency)}
            sub={a.minimumPayment > 0 ? `Minimum ${formatMoney(a.minimumPayment, a.currency)}` : undefined} />}
          {debt && projection && (
            <Stat label="Paid off" value={projection.canBePaidOff ? formatMonthYear(projection.payoffDate) : 'Never'}
              valueClassName={projection.canBePaidOff ? 'text-positive' : 'text-negative'}
              sub={projection.canBePaidOff ? `${projection.months} months · ${formatMoney(projection.totalInterest, a.currency)} interest` : 'Payment is below the interest'} />
          )}
        </div>
        {a.currency !== 'GBP' && <div className="mt-4"><RateNote currency={a.currency} rates={rates.data} /></div>}
        {used !== null && (
          <div className="mt-6">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted">Credit used</span>
              <span className="tabular-nums">{formatMoney(a.availableCredit ?? 0, a.currency)} available of {formatMoney(a.creditLimit!, a.currency)}</span>
            </div>
            <ProgressBar label="Credit used" value={used} tone={used > 0.9 ? 'negative' : used > 0.75 ? 'warning' : 'accent'} />
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          {debt && a.balance > 0 && <WhatIfCard debt={a} />}

          <Card title={debt ? 'Activity' : 'Transactions'}
            action={<Link to={`/transactions?account=${id}`} className="text-sm font-medium text-accent hover:underline">View all</Link>}>
            {!transactions.data ? <Skeleton className="h-32" /> : mine.length === 0 ? (
              <EmptyState icon="list" title="No transactions yet" />
            ) : (
              <ul className="-my-3 divide-y divide-line">{mine.slice(0, 8).map((t) => <TransactionRow key={t.id} t={t} />)}</ul>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {debt && (
            <Card title="Payments">
              {!payments.data ? <Skeleton className="h-24" /> : payments.data.length === 0 ? (
                <p className="text-sm text-muted">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {payments.data.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="tabular-nums font-medium text-positive">{formatMoney(p.amount, a.currency)}</p>
                        <p className="text-xs text-muted">from {p.fromAccountName}</p>
                      </div>
                      <span className="text-muted">{formatDate(p.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <AliasesCard account={a} />

          <Card title="Delete account">
            <p className="mb-4 text-sm text-muted">Only possible while it has no transactions.</p>
            <Button variant="danger" icon="trash" onClick={() => setDeleting(true)}>Delete {a.name}</Button>
          </Card>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${a.name}`}>
        <AccountForm account={a} onDone={() => setEditing(false)} />
      </Modal>

      <Modal open={deleting} onClose={() => { setDeleting(false); setDeleteError(null); }} title={`Delete ${a.name}?`}
        description="This can't be undone.">
        {deleteError && <Alert tone="negative" className="mb-4">{deleteError}</Alert>}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
          <Button variant="destructive" icon="trash" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
