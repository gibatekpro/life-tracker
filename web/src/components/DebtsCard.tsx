import type { DebtsOverview } from '../types';
import { useState } from 'react';
import { recordDebtPayment } from '../api';

const gbp = (n: number) =>
    n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

const monthYear = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

export default function DebtsCard({ overview, onChanged }: {
    overview: DebtsOverview;
    onChanged: () => void;
}) {
    const [payingId, setPayingId] = useState<number | null>(null);
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);

    async function pay(debtId: number) {
        setError(null);
        try {
            await recordDebtPayment(debtId, Number(amount), new Date().toLocaleDateString('en-CA'));
            setPayingId(null);
            setAmount('');
            onChanged();
        } catch (err) {
            setError((err as Error).message);
        }
    }

    return (
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Debts</h2>

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
                        <th>Debt</th><th>Balance</th><th>APR</th><th>Paying</th><th>Paid off</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    {overview.debts.map(({ debt, projection }) => (
                        <tr key={debt.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td>{debt.name}</td>
                            <td>{gbp(debt.balance)}</td>
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
                                        <button onClick={() => pay(debt.id)}>Save</button>
                                        <button onClick={() => setPayingId(null)}>Cancel</button>
                                    </>
                                ) : (
                                    <button onClick={() => { setPayingId(debt.id); setAmount(String(debt.monthlyPayment)); }}>
                                        Pay
                                    </button>
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