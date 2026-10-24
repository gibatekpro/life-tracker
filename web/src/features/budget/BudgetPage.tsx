import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { copyPreviousBudget, getBudgetMonth, getCategories, resetBudgetAmount, setBudgetAmount } from '../../api';
import type { BudgetLine, BudgetLineKey } from '../../types';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import { formatMoney, monthName, periodLabel } from '../../lib/format';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Alert, EmptyState, PageHeader, ProgressBar, Skeleton, Stat } from '../../components/ui/Bits';
import AddLineForm from './AddLineForm';
import CollapsibleTree from '../../components/tree/CollapsibleTree';
import type { TreeNode } from '../../components/tree/tree';
import { useIsSmallScreen } from '../../hooks/useIsSmallScreen';
import BudgetLineRow from './BudgetLineRow';
import DebtLineRow from './DebtLineRow';

// The budget's lines (already a tree) as CollapsibleTree nodes.
const toNodes = (lines: BudgetLine[]): TreeNode<BudgetLine>[] =>
  lines.map((l) => ({ id: l.categoryId, item: l, children: toNodes(l.children) }));

function shiftMonth(ym: string, by: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// My budget for a month: what I plan to spend in each category and pay on each debt, against
// what's gone so far, what's unallocated, and what's safe to spend per day. Amounts can be changed
// for one month in place; the month (?month=2026-11) is in the URL, and next month can be planned ahead.
export default function BudgetPage() {
  const [params, setParams] = useSearchParams();
  const param = params.get('month');
  const view = useData(`budget-${param ?? 'now'}`, () => {
    const [y, m] = (param ?? '').split('-').map(Number);
    return param ? getBudgetMonth(y, m) : getBudgetMonth();
  });
  const categories = useData('categories', getCategories);
  const { refresh } = useRefresh();
  // On small screens only the top-level categories show until opened; larger screens show everything.
  const small = useIsSmallScreen();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const v = view.data;
  const b = v?.budget;
  const ym = b ? `${b.year}-${String(b.month).padStart(2, '0')}` : null;

  async function save(key: BudgetLineKey, amount: number) {
    await setBudgetAmount(b!.year, b!.month, key, amount);
    refresh();
  }

  async function reset(key: BudgetLineKey) {
    await resetBudgetAmount(b!.year, b!.month, key);
    refresh();
  }

  async function copyPrevious() {
    setNotice(null);
    try {
      const { copied } = await copyPreviousBudget(b!.year, b!.month);
      setNotice({ ok: true, text: copied === 0 ? 'Last month had no figures of its own to copy.' : `Copied ${copied} figure${copied === 1 ? '' : 's'} from last month.` });
      refresh();
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <>
      <PageHeader title="Budget" description="Plan each month's spending and debt payments, and see how it's going."
        actions={b && (
          <>
            <Button icon="copy" onClick={copyPrevious}>Copy last month</Button>
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add line</Button>
          </>
        )} />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" icon="chevronLeft" aria-label="Previous month" disabled={!ym}
          onClick={() => ym && setParams({ month: shiftMonth(ym, -1) }, { replace: true })} />
        <div className="text-center">
          <h2 className="text-lg font-semibold">{b ? periodLabel(b) : '…'}</h2>
          {b && <p className="text-xs text-muted">
            {b.daysLeft === 0 ? 'Finished' : b.daysElapsed === 0 ? 'Not started yet' : `${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left`}
          </p>}
        </div>
        <Button variant="ghost" size="sm" icon="chevronRight" aria-label="Next month" disabled={!ym}
          onClick={() => ym && setParams({ month: shiftMonth(ym, 1) }, { replace: true })} />
      </div>

      {view.error && <Alert tone="negative" className="mb-6">{view.error}</Alert>}
      {notice && <Alert tone={notice.ok ? 'info' : 'negative'} className="mb-6">{notice.text}</Alert>}

      {!b || !v ? <Skeleton className="h-96" /> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Card><Stat label="Income" value={formatMoney(b.income)}
              sub={v.incomeMode === 'Fixed' ? 'Take-home pay' : 'Recorded this month'} /></Card>
            <Card><Stat label="Planned" value={formatMoney(b.totalPlanned)}
              sub={`${formatMoney(b.plannedSpending)} spending · ${formatMoney(b.plannedDebts)} debts`} /></Card>
            <Card><Stat label="Unallocated" value={formatMoney(b.unallocated)}
              valueClassName={b.unallocated < 0 ? 'text-negative' : 'text-positive'}
              sub={b.unallocated < 0 ? 'Planned more than income' : 'Income not yet budgeted'} /></Card>
            <Card><Stat label="Safe to spend" value={b.daysLeft > 0 ? `${formatMoney(b.safeToSpendPerDay)}/day` : '—'}
              valueClassName={b.safeToSpend < 0 ? 'text-negative' : undefined}
              sub={b.safeToSpend < 0 ? `${formatMoney(-b.safeToSpend)} over-committed` : `${formatMoney(b.safeToSpend)} not spent or set aside`} /></Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card title="Spending" description={`${formatMoney(b.spent)} spent of ${formatMoney(b.plannedSpending)} planned`}
              className="lg:col-span-3">
              {b.lines.length === 0 ? (
                <EmptyState icon="budget" title="Nothing budgeted yet"
                  action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add a line</Button>}>
                  Give categories a default in Settings to have them every month, or add a line for just this month.
                </EmptyState>
              ) : (
                <CollapsibleTree className="-my-3" page="budget" collapsible={small} nodes={toNodes(b.lines)}
                  renderRow={(node, context) => (
                    <BudgetLineRow line={node.item} context={context} daysLeft={b.daysLeft}
                      onSave={(categoryId, amount) => save({ categoryId }, amount)}
                      onReset={(categoryId) => reset({ categoryId })} />
                  )} />
              )}
            </Card>

            <div className="grid content-start gap-6 lg:col-span-2">
              <Card title="Debt payments" description={`${formatMoney(b.debtPaid)} paid of ${formatMoney(b.plannedDebts)} planned`}>
                {b.debts.length === 0 ? <p className="text-sm text-muted">No cards or loans to pay.</p> : (
                  <ul className="-my-3 divide-y divide-line">
                    {b.debts.map((d) => (
                      <DebtLineRow key={d.accountId} debt={d}
                        onSave={(accountId, amount) => save({ accountId }, amount)}
                        onReset={(accountId) => reset({ accountId })} />
                    ))}
                    {b.avalancheExtra > 0 && (
                      // What the avalanche plan pays beyond the debt lines, so the month's debt total
                      // (and so unallocated and safe-to-spend) is what the plan actually pays.
                      <li className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                          <p className="font-semibold">Extra for the avalanche</p>
                          <p className="tabular-nums">{formatMoney(b.avalancheExtraPaid)} <span className="text-muted">paid of</span> {formatMoney(b.avalancheExtra)}</p>
                        </div>
                        <div className="mt-2"><ProgressBar label="Avalanche extra paid" value={b.avalancheExtraPaid / b.avalancheExtra} /></div>
                        <p className="mt-1.5 text-xs text-muted">
                          The plan pays {formatMoney(b.plannedDebts)} a month; your debt lines add up to {formatMoney(b.plannedDebts - b.avalancheExtra)}.
                          Paying more than a line's figure counts here.
                        </p>
                      </li>
                    )}
                  </ul>
                )}
                <p className="mt-4 rounded-xl bg-surface-muted p-3 text-xs text-muted">
                  {b.hasMonthDebtAmounts
                    ? <>This month's debt lines ({formatMoney(b.plannedDebts)}) are the <Link to="/plan" className="text-accent hover:underline">avalanche plan</Link>'s budget.</>
                    : <>The <Link to="/plan" className="text-accent hover:underline">avalanche plan</Link> uses your debt budget from Settings
                      {v.settingsDebtBudget !== null ? ` (${formatMoney(v.settingsDebtBudget)})` : ''} until you set a debt amount for this month.</>}
                </p>
              </Card>

              {b.unallocated > 0 && b.debts.length > 0 && (
                <Alert tone="info">
                  {formatMoney(b.unallocated)} of income isn't budgeted. Raising a debt payment here moves the avalanche plan's
                  debt-free date; see the effect on the <Link to="/plan" className="font-medium text-accent hover:underline">Debt plan</Link>.
                </Alert>
              )}
            </div>
          </div>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a budget line"
        description={b ? `For ${monthName(b.year, b.month)}.` : undefined}>
        {b && categories.data && (
          <AddLineForm categories={categories.data} monthName={monthName(b.year, b.month)}
            onSave={(categoryId, amount) => save({ categoryId }, amount)} onDone={() => setAdding(false)} />
        )}
      </Modal>
    </>
  );
}
