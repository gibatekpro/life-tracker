import type { DebtsOverview } from '../types';

const gbp = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

const monthYear = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';

export default function DebtsCard({ overview }: { overview: DebtsOverview }) {
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
            <th>Debt</th><th>Balance</th><th>APR</th><th>Paying</th><th>Paid off</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}