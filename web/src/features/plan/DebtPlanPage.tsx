import { useState } from 'react';
import { Link } from 'react-router';
import { getAvalanchePlan, getDebts, getExchangeRates } from '../../api';
import { useData } from '../../data/useData';
import { useDebounce } from '../../hooks/useDebounce';
import {
  foreignCurrencies, foreignOwed, formatMoney, monthlyBudgetNote, payoffChartDescription, payoffNote, planHeadline, planMissingRates,
} from '@lifetracker/core';
import Card from '../../components/ui/Card';
import { Alert, EmptyState, PageHeader, Skeleton } from '../../components/ui/Bits';
import ExtraSimulator from './ExtraSimulator';
import PayoffChart from './PayoffChart';
import { RateNote } from '../accounts/Converted';

// The plan for getting out of debt, using the avalanche method: every debt gets its normal
// payment, and anything extra goes to the highest interest rate first. When a debt is cleared,
// its payment rolls on to the next. The simulator shows what an extra amount each month would do.
export default function DebtPlanPage() {
  const [extraInput, setExtraInput] = useState('0');
  const extra = useDebounce(Math.max(0, Number(extraInput) || 0));
  const baseline = useData('plan-0', () => getAvalanchePlan(0));
  const plan = useData(`plan-${extra}`, () => getAvalanchePlan(extra));
  const debts = useData('debts', getDebts);
  const rates = useData('rates', getExchangeRates);
  const debtAccount = (id: number) => debts.data?.debts.find((d) => d.debt.id === id)?.debt;
  const foreign = foreignCurrencies((debts.data?.debts ?? []).map((d) => d.debt));
  const missingRates = debts.data ? planMissingRates(debts.data.currenciesWithoutRate) : null;

  const b = baseline.data;
  const p = plan.data;
  const error = baseline.error ?? plan.error;

  // Beside the plan on wide screens, straight after the debt-free date on phones.
  const simulator = b && p && (
    <ExtraSimulator input={extraInput} onInput={setExtraInput} extra={extra} baseline={b} plan={p} />
  );

  return (
    <>
      <PageHeader title="Debt plan"
        description="Pay every debt its normal payment, and put anything extra on the highest interest rate first." />

      {error && <Alert tone="negative" className="mb-6">{error}</Alert>}
      {missingRates && <Alert tone="warning" className="mb-6">{missingRates}</Alert>}

      {!p || !b ? <Skeleton className="h-64" /> : b.payoffs.length === 0 && b.canBePaidOff ? (
        <Card><EmptyState icon="target" title="Nothing to pay off">Add a credit card or loan on the Accounts page to plan its payoff.</EmptyState></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-2">
            <Card>
              {(() => {
                const h = planHeadline(p);
                return h.clears ? (
                  <>
                    <p className="text-sm text-muted">Debt-free by</p>
                    <p className="mt-1 text-4xl font-semibold tracking-tight text-positive">{h.date}</p>
                    <p className="mt-2 text-sm text-muted">{h.note}</p>
                  </>
                ) : <Alert tone="negative">{h.message}</Alert>;
              })()}
            </Card>

            <div className="lg:hidden">{simulator}</div>

            {p.canBePaidOff && b.canBePaidOff && (
              <Card title="When each debt is cleared" description={payoffChartDescription(extra)}>
                <PayoffChart baseline={b} plan={p} showExtra={extra > 0} />
              </Card>
            )}

            {p.canBePaidOff && (
              <Card title="Payoff order" description="Highest interest first. Each cleared payment rolls on to the next.">
                <ol className="relative grid gap-5">
                  {p.payoffs.map((x, i) => (
                    <li key={x.id} className="flex gap-4">
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</div>
                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
                        <div>
                          <Link to={`/accounts/${x.id}`} className="font-medium hover:underline">{x.name}</Link>
                          <p className="text-sm text-muted">{payoffNote(x)}</p>
                          {foreignOwed(debtAccount(x.id), rates.data) && (
                            <p className="text-sm tabular-nums">{foreignOwed(debtAccount(x.id), rates.data)}</p>
                          )}
                        </div>
                        <p className="text-sm text-muted tabular-nums">{formatMoney(x.interestPaid)} interest</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {foreign.length > 0 && (
                  <div className="mt-4 grid gap-1 border-t border-line pt-3">
                    {foreign.map((c) => <RateNote key={c} currency={c} rates={rates.data} />)}
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="grid content-start gap-6">
            <div className="hidden lg:block">{simulator}</div>

            <Card title="Monthly budget">
              <p className="text-sm text-muted">{monthlyBudgetNote(b)}</p>
              <Link to="/settings" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">Set the debt budget</Link>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
