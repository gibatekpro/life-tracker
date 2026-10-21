import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlySummary } from '../../types';
import { useTokens } from '../../hooks/useTokens';
import { formatMoney, formatMoneyShort } from '../../lib/format';

const shortMonth = (s: MonthlySummary) => new Date(s.year, s.month - 1).toLocaleDateString('en-GB', { month: 'short' });

// Spending per budget month for the last six, to see the trend.
// With a fixed take-home pay, it's drawn as a line once spending gets near it (while spending is
// far below, the line would squash the bars flat). With recorded income, each month's income
// is its own bar beside the spending, since it changes from month to month.
export default function SpendingTrendChart({ months }: { months: MonthlySummary[] }) {
  const t = useTokens(['accent', 'muted', 'line', 'surface', 'ink', 'chart-6'] as const);
  const recorded = months.at(-1)?.incomeMode === 'Recorded';
  const income = months.at(-1)?.monthlyIncome ?? 0;
  const data = months.map((s) => ({ month: shortMonth(s), spent: s.totalSpent, income: s.monthlyIncome }));
  const highest = Math.max(0, ...data.map((d) => d.spent));
  const showIncome = !recorded && income > 0 && highest >= income * 0.5;

  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={t.line} />
            <XAxis dataKey="month" tick={{ fill: t.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis width={56} tick={{ fill: t.muted, fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => formatMoneyShort(v)} />
            <Tooltip cursor={{ fill: t.line, opacity: 0.4 }}
              contentStyle={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, color: t.ink, fontSize: 13 }}
              formatter={(value, name) => [formatMoney(Number(value)), name]} />
          {recorded && <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: t.muted }} />}
          {recorded && <Bar dataKey="income" name="Income" fill={t['chart-6']} radius={[6, 6, 0, 0]} maxBarSize={28} />}
            {showIncome && (
              <ReferenceLine y={income} stroke={t.muted} strokeDasharray="4 4" ifOverflow="extendDomain"
                label={{ value: 'Take-home pay', position: 'insideTopRight', fill: t.muted, fontSize: 11 }} />
            )}
            <Bar dataKey="spent" name="Spent" fill={t.accent} radius={[6, 6, 0, 0]} maxBarSize={recorded ? 28 : 40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!recorded && !showIncome && income > 0 && (
        <p className="mt-2 text-xs text-muted">Take-home pay {formatMoney(income)} a month; spending is well below it.</p>
      )}
    </div>
  );
}
