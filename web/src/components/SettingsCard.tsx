import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { getSettings, updateSettings } from '../api';

export default function SettingsCard({ onSaved }: { onSaved: () => void }) {
  const [income, setIncome] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setIncome(String(s.monthlyIncome));
        setBudget(s.monthlyDebtBudget?.toString() ?? '');
      })
      .catch((e) => setStatus(e.message));
  }, []);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    try {
      await updateSettings({
        monthlyIncome: Number(income),
        monthlyDebtBudget: budget === '' ? null : Number(budget),
      });
      setStatus('Saved');
      onSaved();
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8 }}>
        <label>
          Monthly take-home pay (£){' '}
          <input type="number" step="0.01" min="0" value={income}
            onChange={(e) => setIncome(e.target.value)} required />
        </label>
        <label>
          Monthly debt budget (£){' '}
          <input type="number" step="0.01" min="0" value={budget} placeholder="optional"
            onChange={(e) => setBudget(e.target.value)} />
        </label>
        <button type="submit">Save</button>
        {status && <span>{status}</span>}
      </form>
    </section>
  );
}