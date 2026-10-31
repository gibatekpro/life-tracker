import { Link } from 'react-router';
import { getAccounts, getDebts, getMonthlySummary, getTransactions } from '../../api';
import { useData } from '../../data/useData';
import {
  categoryShares, earlierMonths, formatMoney, isDebt, leftNote, moneyHeld, owedNote, periodLabel, spentNote, spentShare, spentShareTone,
} from '@lifetracker/core';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Alert, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../components/ui/Bits';
import TransactionRow from '../transactions/TransactionRow';
import { useQuickAdd } from '../transactions/quickAdd';
import SpendingTrendChart from './SpendingTrendChart';
import SafeToSpendCard from './SafeToSpendCard';

// The last six budget months' summaries, oldest first, ending with the one I'm in now
// (which, before payday, is still last month's).
async function lastSixMonths() {
  const current = await getMonthlySummary();
  const earlier = await Promise.all(earlierMonths(current.year, current.month, 5).map((m) => getMonthlySummary(m.year, m.month)));
  return [...earlier, current];
}

// "How am I doing?" at a glance: this month's spending against income, what I have,
// what I owe and when it's gone, where the money went, and the latest transactions.
export default function OverviewPage() {
  const summary = useData('summary', () => getMonthlySummary());
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const transactions = useData('transactions', getTransactions);
  const trend = useData('trend', lastSixMonths);
  const openQuickAdd = useQuickAdd();

  const s = summary.data;
  const share = s ? spentShare(s) : 0;
  const held = accounts.data ? moneyHeld(accounts.data) : undefined;
  const error = summary.error ?? accounts.error ?? debts.error ?? transactions.error;

  return (
    <>
      <PageHeader
        title="Overview"
        description={s ? `${periodLabel(s)} at a glance` : 'This month at a glance'}
        // Phones already have "New" in the top bar.
        actions={<span className="hidden sm:block"><Button variant="primary" icon="plus" onClick={() => openQuickAdd()}>New transaction</Button></span>}
      />

      {error && <Alert tone="negative" className="mb-6">Couldn't load everything: {error}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card>
          {s ? (
            <>
              <Stat label="Spent this month" value={formatMoney(s.totalSpent)} sub={spentNote(s)} />
              <div className="mt-4">
                <ProgressBar label="Share of income spent" value={share} tone={spentShareTone(share)} />
              </div>
            </>
          ) : <Skeleton className="h-24" />}
        </Card>
        <Card>
          {s ? (
            <Stat label="Left this month" value={formatMoney(s.remaining)}
              valueClassName={s.remaining < 0 ? 'text-negative' : 'text-positive'}
              sub={leftNote(s)} />
          ) : <Skeleton className="h-24" />}
        </Card>
        <Card>
          {held ? (
            <Stat label="Money held" value={held.value} valueClassName={held.negative ? 'text-negative' : undefined} sub={held.sub} />
          ) : <Skeleton className="h-24" />}
        </Card>
        <Card>
          {debts.data ? (
            <Stat label="Total owed" value={formatMoney(debts.data.totalBalance)}
              valueClassName="text-negative"
              sub={owedNote(debts.data)} />
          ) : <Skeleton className="h-24" />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Card title="Spending trend" description="What you spent in each of the last six budget months">
            {trend.data ? <SpendingTrendChart months={trend.data} /> : <Skeleton className="h-56" />}
          </Card>

          <Card title="Where the money went" description="Spending by category this month">
            {!s ? <Skeleton className="h-48" /> : s.byCategory.length === 0 ? (
              <EmptyState icon="tag" title="No spending yet this month">Expenses you record show up here by category.</EmptyState>
            ) : (
              <ul className="grid gap-4">
                {categoryShares(s).map((c) => (
                  <li key={c.category}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                      <span className="font-medium">{c.category}</span>
                      <span className="tabular-nums">
                        {formatMoney(c.total)}
                        <span className="ml-2 text-muted">{c.percent}%</span>
                      </span>
                    </div>
                    <ProgressBar label={`${c.category} share of spending`} value={c.bar} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <SafeToSpendCard />

          <Card title="Accounts" action={<Link to="/accounts" className="text-sm font-medium text-accent hover:underline">Manage</Link>}>
            {!accounts.data ? <Skeleton className="h-48" /> : (
              <ul className="divide-y divide-line">
                {accounts.data.map((a) => (
                  <li key={a.id}>
                    <Link to={`/accounts/${a.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-muted">
                      <span className="truncate text-sm">{a.name}</span>
                      <span className={cn('text-sm font-medium tabular-nums', isDebt(a) ? 'text-negative' : 'text-ink')}>
                        {isDebt(a) ? '−' : ''}{formatMoney(a.balance, a.currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {debts.data && debts.data.currenciesWithoutRate.length > 0 && (
              <Alert tone="warning" className="mt-4">
                {debts.data.currenciesWithoutRate.join(', ')} debts aren't in the £ total until you record a transfer in that currency.
              </Alert>
            )}
          </Card>
        </div>
      </div>

      <Card title="Recent transactions" className="mt-6"
        action={<Link to="/transactions" className="text-sm font-medium text-accent hover:underline">View all</Link>}>
        {!transactions.data ? <Skeleton className="h-40" /> : transactions.data.length === 0 ? (
          <EmptyState icon="list" title="No transactions yet"
            action={<Button variant="primary" icon="plus" onClick={() => openQuickAdd()}>Add your first</Button>}>
            Record spending, income and card repayments, or let Apple Pay add them for you.
          </EmptyState>
        ) : (
          <ul className="-my-3 divide-y divide-line">
            {transactions.data.slice(0, 6).map((t) => <TransactionRow key={t.id} t={t} />)}
          </ul>
        )}
      </Card>
    </>
  );
}
