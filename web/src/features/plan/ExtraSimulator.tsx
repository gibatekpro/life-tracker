import type { AvalanchePlan } from '@lifetracker/core';
import { extraOutcome } from '@lifetracker/core';
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
  const outcome = extraOutcome(extra, b, p);

  return (
    <Card title="Pay a bit more?" description="See what an extra amount each month would change.">
      <Field label="Extra per month">
        {(id) => <MoneyInput id={id} symbol="£" step="10" value={input} onChange={(e) => onInput(e.target.value)} />}
      </Field>
      <input type="range" min={0} max={500} step={10} aria-label="Extra per month"
        value={Math.min(500, Number(input) || 0)} onChange={(e) => onInput(e.target.value)}
        className="mt-4 w-full accent-accent" />
      <div className="mt-4 rounded-xl bg-surface-muted p-4 text-sm">
        {outcome.tone === 'muted' ? <p className="text-muted">{outcome.headline}</p>
          : !outcome.sub ? <p className="font-medium text-positive">{outcome.headline}</p>
          : (
            <>
              <p className="text-lg font-semibold text-positive">{outcome.headline}</p>
              <p className="text-muted">{outcome.sub}</p>
            </>
          )}
      </div>
    </Card>
  );
}
