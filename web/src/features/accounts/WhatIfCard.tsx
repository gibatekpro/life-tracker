import { useState } from 'react';
import { getWhatIf } from '../../api';
import type { Account } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useDebounce } from '../../hooks/useDebounce';
import { currencySymbol, formatMoney, formatMonthYear } from '../../lib/format';
import Card from '../../components/ui/Card';
import { Field, MoneyInput } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Bits';

// "What if I paid more on this one?" Try a monthly payment and see the payoff date and
// interest change, compared with the payment I've planned.
export default function WhatIfCard({ debt }: { debt: Account }) {
  const [input, setInput] = useState(String(Math.round(debt.monthlyPayment * 1.5)));
  const payment = useDebounce(Math.max(0, Number(input) || 0));
  const result = useData(`whatif-${debt.id}-${payment}`, () => getWhatIf(debt.id, payment));
  const r = result.data;
  const c = debt.currency;

  return (
    <Card title="What if I paid more?" description={`Currently paying ${formatMoney(debt.monthlyPayment, c)} a month.`}>
      <Field label="Monthly payment" className="max-w-xs">
        {(id) => <MoneyInput id={id} symbol={currencySymbol(c)} value={input} onChange={(e) => setInput(e.target.value)} />}
      </Field>

      <div className="mt-5">
        {!r ? <Skeleton className="h-16" /> : !r.whatIf.canBePaidOff ? (
          <p className="text-sm text-negative">At {formatMoney(payment, c)} a month the interest outpaces the payment, so it never clears.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Cleared</p>
              <p className="text-lg font-semibold">{formatMonthYear(r.whatIf.payoffDate)}</p>
              <p className="text-xs text-muted">{r.whatIf.months} months</p>
            </div>
            <div>
              <p className="text-xs text-muted">Interest</p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(r.whatIf.totalInterest, c)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Compared with now</p>
              {r.current.canBePaidOff ? (
                <p className={r.monthsSaved > 0 ? 'text-lg font-semibold text-positive' : 'text-lg font-semibold'}>
                  {r.monthsSaved > 0 ? `${r.monthsSaved} months sooner` : r.monthsSaved < 0 ? `${-r.monthsSaved} months later` : 'Same time'}
                </p>
              ) : <p className="text-lg font-semibold text-positive">Clears it at all</p>}
              {r.interestSaved > 0 && <p className="text-xs text-positive">{formatMoney(r.interestSaved, c)} less interest</p>}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
