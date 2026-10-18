import { useEffect, useState } from 'react';
import { getAvalanchePlan } from '../api';
import type { AvalanchePlan } from '../types';
import { useDebounce } from '../hooks/useDebounce';

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

const monthYear = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

export default function AvalancheCard() {
  const [extraInput, setExtraInput] = useState('0');
  const extra = useDebounce(Math.max(0, Number(extraInput) || 0));

  const [baseline, setBaseline] = useState<AvalanchePlan | null>(null);
  const [plan, setPlan] = useState<AvalanchePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The plan with no extra, to compare against.
  useEffect(() => {
    getAvalanchePlan(0).then(setBaseline).catch((e) => setError(e.message));
  }, []);

  // The plan with the extra amount, refetched when it changes.
  useEffect(() => {
    let cancelled = false;
    getAvalanchePlan(extra)
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; }; // ignore a response that arrives too late
  }, [extra]);

  if (error) return <p style={{ color: 'crimson' }}>{error}</p>;
  if (!plan || !baseline) return null;

  const monthsSaved = baseline.months - plan.months;
  const interestSaved = baseline.totalInterest - plan.totalInterest;

  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Avalanche plan</h2>

      <label style={{ display: 'block', marginBottom: 12 }}>
        Extra per month (£){' '}
        <input
          type="number"
          min="0"
          step="10"
          value={extraInput}
          onChange={(e) => setExtraInput(e.target.value)}
          style={{ width: 100 }}
        />
      </label>

      {plan.canBePaidOff ? (
        <>
          <p>
            Paying {gbp(plan.monthlyBudget)}/month, you're debt-free by{' '}
            <strong>{monthYear(plan.debtFreeDate)}</strong> ({plan.months} months),
            with {gbp(plan.totalInterest)} interest.
          </p>

          {extra > 0 && monthsSaved >= 0 && (
            <p style={{ color: 'seagreen' }}>
              That's <strong>{monthsSaved} months sooner</strong> and{' '}
              <strong>{gbp(interestSaved)} less interest</strong> than with no extra.
            </p>
          )}

          <ol>
            {plan.payoffs.map((p) => (
              <li key={p.id}>
                {p.name}: cleared {monthYear(p.payoffDate)}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p style={{ color: 'crimson' }}>
          At this budget, the debts can't be cleared within 50 years. Try a higher amount.
        </p>
      )}
    </section>
  );
}