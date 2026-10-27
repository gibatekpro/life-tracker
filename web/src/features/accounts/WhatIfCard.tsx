import { useState } from 'react';
import { getWhatIf } from '../../api';
import type { Account } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useDebounce } from '../../hooks/useDebounce';
import { currencySymbol, defaultWhatIfPayment, formatMoney, whatIfSummary } from '@lifetracker/core';
import Card from '../../components/ui/Card';
import { Field, MoneyInput } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Bits';

// "What if I paid more on this one?" Try a monthly payment and see the payoff date and
// interest change, compared with the payment I've planned.
export default function WhatIfCard({ debt }: { debt: Account }) {
  const [input, setInput] = useState(String(defaultWhatIfPayment(debt)));
  const payment = useDebounce(Math.max(0, Number(input) || 0));
  const result = useData(`whatif-${debt.id}-${payment}`, () => getWhatIf(debt.id, payment));
  const c = debt.currency;
  const r = result.data && whatIfSummary(result.data, payment, c);

  return (
    <Card title="What if I paid more?" description={`Currently paying ${formatMoney(debt.monthlyPayment, c)} a month.`}>
      <Field label="Monthly payment" className="max-w-xs">
        {(id) => <MoneyInput id={id} symbol={currencySymbol(c)} value={input} onChange={(e) => setInput(e.target.value)} />}
      </Field>

      <div className="mt-5">
        {!r ? <Skeleton className="h-16" /> : !r.clears ? (
          <p className="text-sm text-negative">{r.message}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Cleared</p>
              <p className="text-lg font-semibold">{r.cleared}</p>
              <p className="text-xs text-muted">{r.months}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Interest</p>
              <p className="text-lg font-semibold tabular-nums">{r.interest}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Compared with now</p>
              <p className={r.better ? 'text-lg font-semibold text-positive' : 'text-lg font-semibold'}>{r.compared}</p>
              {r.interestSaved && <p className="text-xs text-positive">{r.interestSaved}</p>}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
