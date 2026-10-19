import type { Account, DebtsOverview } from '../types';
import { useState } from 'react';
import { createTransaction } from '../api';

const gbp = (n: number) =>
    n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

const monthYear = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

export default function AccountsCard({ accounts, overview, onChanged }: {
    accounts: Account[];
    overview: DebtsOverview;
    onChanged: () => void;
}) {
    const current = accounts.filter((a) => a.type === 'Current');

    const [payingId, setPayingId] = useState<number | null>(null);
    const [amount, setAmount] = useState('');
    const [fromId, setFromId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    function startPaying(debt: Account) {
        setError(null);
        setPayingId(debt.id);
        setAmount(String(debt.monthlyPayment));
        setFromId(current[0]?.id ?? null);
    }

    // A repayment is a transfer: money held goes down, and so does the amount owed.
    async function pay(debt: Account) {
        if (fromId === null) return;
        setError(null);
        try {
            await createTransaction({
                type: 'Transfer',
                amount: Number(amount),
                description: `Payment to ${debt.name}`,
                category: 'Debt',
                date: new Date().toLocaleDateString('en-CA'),
                accountId: fromId,
                toAccountId: debt.id,
            });
            setPayingId(null);
            setAmount('');
            onChanged();
        } catch (err) {
            setError((err as Error).message);
        }
    }

    return (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Accounts</h2>

            <ul>
                {current.map((a) => (
                    <li key={a.id}>{a.name}: <strong>{gbp(a.balance)}</strong></li>
                ))}
            </ul>

            <p>
                Total owed <strong>{gbp(overview.totalBalance)}</strong> · paying{' '}
                {gbp(overview.totalMonthlyPayment)}/month
            </p>
            <p>
                Debt-free: <strong>{monthYear(overview.debtFreeDate)}</strong> · interest still to pay{' '}
                {gbp(overview.totalInterest)}
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                        <th>Debt</th><th>Owed</th><th>Available</th><th>APR</th><th>Paying</th><th>Paid off</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    {overview.debts.map(({ debt, projection }) => (
                        <tr key={debt.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td>{debt.name}</td>
                            <td>{gbp(debt.balance)}</td>
                            <td>{debt.availableCredit === null ? '—' : gbp(debt.availableCredit)}</td>
                            <td>{debt.apr}%</td>
                            <td>{gbp(debt.monthlyPayment)}</td>
                            <td style={{ color: projection.canBePaidOff ? undefined : 'crimson' }}>
                                {projection.canBePaidOff
                                    ? `${monthYear(projection.payoffDate)} (${projection.months} mo)`
                                    : 'Payment too low'}
                            </td>
                            <td>
                                {payingId === debt.id ? (
                                    <>
                                        <input type="number" step="0.01" min="0" value={amount} placeholder="£"
                                            onChange={(e) => setAmount(e.target.value)} style={{ width: 70 }} />
                                        <select value={fromId ?? ''} onChange={(e) => setFromId(Number(e.target.value))}>
                                            {current.map((a) => <option key={a.id} value={a.id}>from {a.name}</option>)}
                                        </select>
                                        <button onClick={() => pay(debt)} disabled={fromId === null}>Save</button>
                                        <button onClick={() => setPayingId(null)}>Cancel</button>
                                    </>
                                ) : (
                                    <button onClick={() => startPaying(debt)}>Pay</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {error && <p style={{ color: 'crimson' }}>{error}</p>}
        </section>
    );
}
