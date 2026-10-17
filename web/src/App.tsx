import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { getTransactions, createTransaction, getMonthlySummary, getDebts } from './api';
import type { Transaction, MonthlySummary, DebtsOverview } from './types';
import SummaryCard from './components/SummaryCard';
import DebtsCard from './components/DebtsCard';

const categories = ['Food', 'Transport', 'Bills', 'Rent', 'Shopping', 'Entertainment', 'Other'];
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

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

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

      {debts && <DebtsCard overview={debts} />}
    </main>
  );
}