import type { Account, DebtsOverview } from '../types';
import { useState } from 'react';
import { createTransaction } from '../api';
import { formatMoney } from '../lib/format';

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
    const [received, setReceived] = useState('');
    const [fromId, setFromId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Start from an account in the debt's own currency if there is one (PalmPay for a naira loan).
    function startPaying(debt: Account) {
        const from = current.find((a) => a.currency === debt.currency) ?? current[0];
        setError(null);
        setPayingId(debt.id);
        setFromId(from?.id ?? null);
        // The instalment is in the debt's currency, so it goes in whichever box is in that currency.
        const sameCurrency = from?.currency === debt.currency;
        setAmount(sameCurrency ? String(debt.monthlyPayment) : '');
        setReceived(sameCurrency ? '' : String(debt.monthlyPayment));
    }

    // A repayment is a transfer: money held goes down, and so does the amount owed.
    // Paying a naira loan from pounds, I enter what I sent (£) and what the loan received (₦).
    async function pay(debt: Account, crossesCurrencies: boolean) {
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
                toAmount: crossesCurrencies ? Number(received) : null,
            });
            setPayingId(null);
            setAmount('');
            setReceived('');
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
                    <li key={a.id}>{a.name}: <strong>{formatMoney(a.balance, a.currency)}</strong></li>
                ))}
            </ul>

            <p>
                Total owed <strong>{formatMoney(overview.totalBalance)}</strong> · paying{' '}
                {formatMoney(overview.totalMonthlyPayment)}/month
            </p>
            <p>
                Debt-free: <strong>{monthYear(overview.debtFreeDate)}</strong> · interest still to pay{' '}
                {formatMoney(overview.totalInterest)}
            </p>
            {overview.currenciesWithoutRate.length > 0 && (
                <p style={{ color: 'darkorange' }}>
                    {overview.currenciesWithoutRate.join(', ')} debts aren't in the £ totals yet: record a transfer
                    between GBP and {overview.currenciesWithoutRate.join('/')} to give them a rate.
                </p>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                        <th>Debt</th><th>Owed</th><th>Available</th><th>APR</th><th>Paying</th><th>Paid off</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    {overview.debts.map(({ debt, projection }) => {
                        const fromCurrency = current.find((a) => a.id === fromId)?.currency;
                        const crossesCurrencies = payingId === debt.id && fromCurrency !== undefined && fromCurrency !== debt.currency;
                        return (
                            <tr key={debt.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td>{debt.name}</td>
                                <td>{formatMoney(debt.balance, debt.currency)}</td>
                                <td>{debt.availableCredit === null ? '—' : formatMoney(debt.availableCredit, debt.currency)}</td>
                                <td>{debt.apr}%</td>
                                <td>{formatMoney(debt.monthlyPayment, debt.currency)}</td>
                                <td style={{ color: projection.canBePaidOff ? undefined : 'crimson' }}>
                                    {projection.canBePaidOff
                                        ? `${monthYear(projection.payoffDate)} (${projection.months} mo)`
                                        : 'Payment too low'}
                                </td>
                                <td>
                                    {payingId === debt.id ? (
                                        <>
                                            <select value={fromId ?? ''} onChange={(e) => setFromId(Number(e.target.value))}>
                                                {current.map((a) => <option key={a.id} value={a.id}>from {a.name}</option>)}
                                            </select>
                                            <input type="number" step="0.01" min="0" value={amount}
                                                placeholder={fromCurrency ?? ''}
                                                onChange={(e) => setAmount(e.target.value)} style={{ width: 80 }} />
                                            {crossesCurrencies && (
                                                <input type="number" step="0.01" min="0" value={received}
                                                    placeholder={`received ${debt.currency}`}
                                                    onChange={(e) => setReceived(e.target.value)} style={{ width: 100 }} />
                                            )}
                                            <button onClick={() => pay(debt, crossesCurrencies)} disabled={fromId === null}>Save</button>
                                            <button onClick={() => setPayingId(null)}>Cancel</button>
                                        </>
                                    ) : (
                                        <button onClick={() => startPaying(debt)}>Pay</button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {error && <p style={{ color: 'crimson' }}>{error}</p>}
        </section>
    );
}
