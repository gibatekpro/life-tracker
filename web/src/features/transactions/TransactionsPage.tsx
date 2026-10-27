import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getAccounts, getMonthlySummary, getTransactions } from '../../api';
import type { TypeFilter } from '@lifetracker/core';
import { useData } from '../../data/useData';
import {
  filterTransactions, formatDayHeading, formatMoney, groupByDay, inPeriod, periodLabel, shiftMonth, toYm, transactionTotals,
} from '@lifetracker/core';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import { Input, Select } from '../../components/ui/Field';
import { Alert, EmptyState, PageHeader, SegmentedControl, Skeleton, Stat } from '../../components/ui/Bits';
import AccountSelect from '../accounts/AccountSelect';
import TransactionRow from './TransactionRow';
import { useQuickAdd } from './quickAdd';

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Expense', label: 'Spending' },
  { value: 'Income', label: 'Income' },
  { value: 'Transfer', label: 'Transfers' },
];

// Every transaction, a budget month at a time, with filters. Tapping one opens it to edit or delete.
// The month, account and type live in the URL, so back/forward and refresh keep the view.
// The month's dates come from the API's summary, so they follow payday exactly as the summary does.
export default function TransactionsPage() {
  const transactions = useData('transactions', getTransactions);
  const accounts = useData('accounts', getAccounts);
  const openQuickAdd = useQuickAdd();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');

  // The month I'm in now (it may still be last month's, if payday hasn't come yet).
  const current = useData('summary', () => getMonthlySummary());
  const currentYm = current.data ? toYm(current.data.year, current.data.month) : null;
  const month = params.get('month') ?? currentYm;
  const period = useData(`summary-${month}`, () => {
    const [y, m] = (month ?? '').split('-').map(Number);
    return getMonthlySummary(y, m);
  }, month !== null);
  const p = period.data && toYm(period.data.year, period.data.month) === month ? period.data : undefined;

  const accountId = params.get('account') ? Number(params.get('account')) : null;
  const type = (params.get('type') as TypeFilter | null) ?? 'All';

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }

  const inMonth = useMemo(() => (p ? inPeriod(transactions.data ?? [], p) : []), [transactions.data, p]);
  const shown = useMemo(() => filterTransactions(inMonth, { accountId, type, search }), [inMonth, accountId, type, search]);
  // The list grouped by day, newest first.
  const byDay = useMemo(() => groupByDay(shown), [shown]);
  const { spent, received, transfers } = transactionTotals(inMonth);

  return (
    <>
      <PageHeader title="Transactions" description="Everything you've spent, received and moved between accounts."
        // Phones already have "New" in the top bar.
        actions={<span className="hidden sm:block"><Button variant="primary" icon="plus" onClick={() => openQuickAdd()}>New transaction</Button></span>} />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => month && setParam('month', shiftMonth(month, -1))}
          aria-label="Previous month" disabled={!month} />
        <h2 className="text-lg font-semibold">{p ? periodLabel(p) : '…'}</h2>
        <Button variant="ghost" size="sm" icon="chevronRight" onClick={() => month && setParam('month', shiftMonth(month, 1))}
          aria-label="Next month" disabled={!month || !currentYm || month >= currentYm} />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Card><Stat label="Spent" value={formatMoney(spent)} /></Card>
        <Card><Stat label="Money in" value={formatMoney(received)} valueClassName="text-positive" /></Card>
        <Card><Stat label="Transfers" value={transfers} sub="not counted as spending" /></Card>
      </div>

      <Card flush>
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[1fr_200px_auto]">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input aria-label="Search" placeholder="Search description or category" className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {accounts.data ? (
            <AccountSelect aria-label="Account" accounts={accounts.data} value={accountId ?? ''}
              onChange={(e) => setParam('account', e.target.value || null)} allLabel="All accounts" />
          ) : <Select disabled aria-label="Account"><option>All accounts</option></Select>}
          <SegmentedControl label="Type" options={typeOptions} value={type}
            onChange={(v) => setParam('type', v === 'All' ? null : v)} />
        </div>

        {transactions.error && <Alert tone="negative" className="m-4">{transactions.error}</Alert>}

        {!transactions.data || !p ? (
          <div className="grid gap-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon="list" title={inMonth.length === 0 ? 'Nothing recorded this month' : 'No transactions match'}
            action={inMonth.length === 0 ? <Button variant="primary" icon="plus" onClick={() => openQuickAdd()}>New transaction</Button> : undefined}>
            {inMonth.length === 0 ? 'Use the button to add one, or pick another month.' : 'Try a different search or filter.'}
          </EmptyState>
        ) : (
          <div className="px-4 pb-2">
            {byDay.map(({ date: day, data: items }) => (
              <section key={day}>
                <h3 className="sticky top-14 z-[1] -mx-4 bg-surface/95 px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur lg:top-0">
                  {formatDayHeading(day)}
                </h3>
                <ul className="divide-y divide-line">
                  {items.map((t) => (
                    <TransactionRow key={t.id} t={t} showDate={false} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>

    </>
  );
}
