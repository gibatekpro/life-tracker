import type { MonthlySummary } from '../types';

export default function SummaryCard({ summary }: { summary: MonthlySummary }) {
  const monthName = new Date(summary.year, summary.month - 1)
    .toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const percentSpent = summary.monthlyIncome > 0
    ? (summary.totalSpent / summary.monthlyIncome) * 100
    : 0;

  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>{monthName}</h2>
      <p>Spent £{summary.totalSpent.toFixed(2)} of £{summary.monthlyIncome.toFixed(2)}</p>

      <div style={{ background: '#eee', borderRadius: 4, height: 10 }}>
        <div style={{
          width: `${Math.min(percentSpent, 100)}%`,
          height: '100%',
          borderRadius: 4,
          background: percentSpent > 90 ? 'crimson' : 'seagreen',
        }} />
      </div>

      <p><strong>Remaining: £{summary.remaining.toFixed(2)}</strong></p>

      <ul>
        {summary.byCategory.map((c) => (
          <li key={c.category}>{c.category}: £{c.total.toFixed(2)}</li>
        ))}
      </ul>
    </section>
  );
}