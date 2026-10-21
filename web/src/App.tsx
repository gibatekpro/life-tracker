import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { getTransactions, createTransaction, getMonthlySummary, getDebts, getAccounts } from './api';
import type { Transaction, MonthlySummary, DebtsOverview, Account, TransactionType } from './types';
import SummaryCard from './components/SummaryCard';
import AccountsCard from './components/AccountsCard';
import AvalancheCard from './components/AvalancheCard';
import SettingsCard from './components/SettingsCard';
import { formatMoney } from './lib/format';


const categories = ['Food', 'Transport', 'Bills', 'Rent', 'Shopping', 'Entertainment', 'Debt', 'Transfer', 'Other'];
const types: TransactionType[] = ['Expense', 'Income', 'Transfer'];

const today = () => new Date().toLocaleDateString('en-CA');

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [type, setType] = useState<TransactionType>('Expense');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [toAmount, setToAmount] = useState('');
  const [gbpAmount, setGbpAmount] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [debts, setDebts] = useState<DebtsOverview | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);


  useEffect(() => {
    getTransactions().then(setTransactions).catch((e) => setError(e.message));
    getMonthlySummary().then(setSummary).catch((e) => setError(e.message));
    getDebts().then(setDebts).catch((e) => setError(e.message));
    getAccounts()
      .then((a) => {
        setAccounts(a);
        setAccountId(a.find((x) => x.type === 'Current')?.id ?? a[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const isTransfer = type === 'Transfer';
  const toOptions = accounts.filter((a) => a.id !== accountId);

  const fromCurrency = accounts.find((a) => a.id === accountId)?.currency ?? 'GBP';
  const toCurrency = isTransfer ? accounts.find((a) => a.id === toAccountId)?.currency : undefined;
  // £10 out of Lloyds, ₦18,000 into PalmPay: between currencies I enter both amounts.
  const crossesCurrencies = toCurrency !== undefined && toCurrency !== fromCurrency;
  // Anything not in pounds gets a £ value for the summary. It's worked out from my latest
  // transfer rate unless I type one; a transfer into pounds already has an exact one.
  const asksForPounds = fromCurrency !== 'GBP' && toCurrency !== 'GBP';

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (accountId === null) return;
    setError(null);
    try {
      await createTransaction({
        amount: Number(amount),
        description,
        category: isTransfer ? 'Transfer' : category,
        date,
        type,
        accountId,
        toAccountId: isTransfer ? toAccountId : null,
        toAmount: crossesCurrencies ? Number(toAmount) : null,
        gbpAmount: asksForPounds && gbpAmount !== '' ? Number(gbpAmount) : null,
      });
      await refreshAll(); // balances changed too, not just the list
      setAmount('');
      setDescription('');
      setToAmount('');
      setGbpAmount('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSettingsSaved() {
    setSummary(await getMonthlySummary());
    setRefreshKey((k) => k + 1);
  }

  async function refreshAll() {
    const [t, s, d, a] = await Promise.all([getTransactions(), getMonthlySummary(), getDebts(), getAccounts()]);
    setTransactions(t);
    setSummary(s);
    setDebts(d);
    setAccounts(a);
    setRefreshKey((k) => k + 1);
  }

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 16px' }}>
      <h1>Life Tracker</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        <select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input type="number" step="0.01" placeholder={`Amount (${fromCurrency})`} value={amount}
          onChange={(e) => setAmount(e.target.value)} required />
        <input placeholder="Description" value={description}
          onChange={(e) => setDescription(e.target.value)} required />
        {!isTransfer && (
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <label>
          {isTransfer ? 'From ' : 'Account '}
          <select value={accountId ?? ''} required onChange={(e) => {
            const id = Number(e.target.value);
            setAccountId(id);
            if (id === toAccountId) setToAccountId(null); // can't transfer to the same account
          }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        {isTransfer && (
          <label>
            To{' '}
            <select value={toAccountId ?? ''} onChange={(e) => setToAccountId(Number(e.target.value))} required>
              <option value="" disabled>Choose an account</option>
              {toOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {crossesCurrencies && (
          <input type="number" step="0.01" placeholder={`Received (${toCurrency})`} value={toAmount}
            onChange={(e) => setToAmount(e.target.value)} required />
        )}
        {asksForPounds && (
          <input type="number" step="0.01" placeholder="£ value (optional, else from latest transfer rate)"
            value={gbpAmount} onChange={(e) => setGbpAmount(e.target.value)} />
        )}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button type="submit" disabled={accountId === null}>Add transaction</button>
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
              <li key={t.id} style={{ opacity: t.type === 'Transfer' ? 0.6 : 1 }}>
                {t.date} ·{' '}
                {t.type === 'Transfer'
                  ? `${t.accountName} → ${t.toAccountName}`
                  : `${t.category} · ${t.accountName}`}
                {' '}· {t.description} · {t.type === 'Income' ? '+' : ''}{formatMoney(t.amount, t.currency)}
                {t.toAmount !== null && t.toCurrency && ` → ${formatMoney(t.toAmount, t.toCurrency)}`}
                {t.currency !== 'GBP' && t.toCurrency !== 'GBP' && ` (≈ ${formatMoney(t.gbpAmount)})`}
              </li>
            ))}
          </ul>
        )}
      </section>

      {debts && <AccountsCard accounts={accounts} overview={debts} onChanged={refreshAll} />}

      <AvalancheCard key={refreshKey} />

      <SettingsCard onSaved={handleSettingsSaved} />
    </main>
  );
}
