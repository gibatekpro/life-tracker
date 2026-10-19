import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { getTransactions, createTransaction, getMonthlySummary, getDebts, setCountsAsSpending } from './api';
import type { Transaction, MonthlySummary, DebtsOverview } from './types';
import SummaryCard from './components/SummaryCard';
import DebtsCard from './components/DebtsCard';
import AvalancheCard from './components/AvalancheCard';
import SettingsCard from './components/SettingsCard';


const categories = ['Food', 'Transport', 'Bills', 'Rent', 'Shopping', 'Entertainment', 'Debt', 'Transfer', 'Other'];

const today = () => new Date().toLocaleDateString('en-CA');

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [debts, setDebts] = useState<DebtsOverview | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);


  useEffect(() => {
    getTransactions().then(setTransactions).catch((e) => setError(e.message));
    getMonthlySummary().then(setSummary).catch((e) => setError(e.message));
    getDebts().then(setDebts).catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const created = await createTransaction({
        amount: Number(amount),
        description,
        category,
        date,
      });
      setTransactions((prev) => [created, ...prev]);
      setSummary(await getMonthlySummary());
      setAmount('');
      setDescription('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSettingsSaved() {
    setSummary(await getMonthlySummary());
    setRefreshKey((k) => k + 1);
  }

  async function refreshAll() {
    const [t, s, d] = await Promise.all([getTransactions(), getMonthlySummary(), getDebts()]);
    setTransactions(t);
    setSummary(s);
    setDebts(d);
    setRefreshKey((k) => k + 1);
  }

  async function toggleSpending(t: Transaction) {
    try {
      await setCountsAsSpending(t.id, !t.countsAsSpending);
      await refreshAll();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 16px' }}>
      <h1>Life Tracker</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <input type="number" step="0.01" placeholder="Amount (£)" value={amount}
          onChange={(e) => setAmount(e.target.value)} required />
        <input placeholder="Description" value={description}
          onChange={(e) => setDescription(e.target.value)} required />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button type="submit">Add transaction</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {summary && <SummaryCard summary={summary} />}

      <section style={{ marginBottom: 24 }}>
        <h2>Transactions</h2>
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <ul>
            {transactions.map((t) => (
              <li key={t.id} style={{ opacity: t.countsAsSpending ? 1 : 0.5 }}>
                {t.date} · {t.category} · {t.description} · £{t.amount.toFixed(2)}
                {!t.countsAsSpending && ' (not counted)'}{' '}
                <button onClick={() => toggleSpending(t)}>
                  {t.countsAsSpending ? 'Exclude' : 'Include'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {debts && <DebtsCard overview={debts} onChanged={refreshAll} />}

      <AvalancheCard key={refreshKey} />

      <SettingsCard onSaved={handleSettingsSaved} />
    </main>
  );
}