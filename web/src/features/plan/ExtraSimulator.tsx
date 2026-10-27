import type { AvalanchePlan } from '@lifetracker/core';
import { formatMoney } from '../../lib/format';
import Card from '../../components/ui/Card';
import { Field, MoneyInput } from '../../components/ui/Field';

// "What if I paid a bit more each month?" Compares the plan with the extra against the plan without.
export default function ExtraSimulator({ input, onInput, extra, baseline: b, plan: p }: {
  input: string;
  onInput: (value: string) => void;
  extra: number;
  baseline: AvalanchePlan;
  plan: AvalanchePlan;
}) {
  const monthsSaved = b.months - p.months;
  const interestSaved = b.totalInterest - p.totalInterest;

  return (
    <Card title="Pay a bit more?" description="See what an extra amount each month would change.">
      <Field label="Extra per month">
        {(id) => <MoneyInput id={id} symbol="£" step="10" value={input} onChange={(e) => onInput(e.target.value)} />}
      </Field>
      <input type="range" min={0} max={500} step={10} aria-label="Extra per month"
        value={Math.min(500, Number(input) || 0)} onChange={(e) => onInput(e.target.value)}
        className="mt-4 w-full accent-accent" />
      <div className="mt-4 rounded-xl bg-surface-muted p-4 text-sm">
        {extra === 0 ? (
          <p className="text-muted">Drag the slider or type an amount.</p>
        ) : !p.canBePaidOff ? (
          <p className="text-muted">Still not enough to clear the debts.</p>
        ) : !b.canBePaidOff ? (
          <p className="font-medium text-positive">With the extra, the debts can be cleared.</p>
        ) : monthsSaved > 0 ? (
          <>
            <p className="text-lg font-semibold text-positive">{monthsSaved} {monthsSaved === 1 ? 'month' : 'months'} sooner</p>
            <p className="text-muted">and {formatMoney(interestSaved)} less interest</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-positive">{formatMoney(interestSaved)} less interest</p>
            <p className="text-muted">Same debt-free month, but cheaper.</p>
          </>
        )}
      </div>
    </Card>
  );
}
