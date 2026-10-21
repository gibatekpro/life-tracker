import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlySummary } from '../../types';
import { useTokens } from '../../hooks/useTokens';
import { formatMoney, formatMoneyShort } from '../../lib/format';

const shortMonth = (s: MonthlySummary) => new Date(s.year, s.month - 1).toLocaleDateString('en-GB', { month: 'short' });

// Spending per month for the last six months, to see the trend. Take-home pay is drawn as a line
// once spending gets near it; while spending is far below, the line would squash the bars flat.
export default function SpendingTrendChart({ months }: { months: MonthlySummary[] }) {
  const t = useTokens(['accent', 'muted', 'line', 'surface', 'ink'] as const);
  const income = months.at(-1)?.monthlyIncome ?? 0;
  const data = months.map((s) => ({ month: shortMonth(s), spent: s.totalSpent }));
  const highest = Math.max(0, ...data.map((d) => d.spent));
  const showIncome = income > 0 && highest >= income * 0.5;

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
              formatter={(value) => [formatMoney(Number(value)), 'Spent']} />
            {showIncome && (
              <ReferenceLine y={income} stroke={t.muted} strokeDasharray="4 4" ifOverflow="extendDomain"
                label={{ value: 'Take-home pay', position: 'insideTopRight', fill: t.muted, fontSize: 11 }} />
            )}
            <Bar dataKey="spent" fill={t.accent} radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!showIncome && income > 0 && (
        <p className="mt-2 text-xs text-muted">Take-home pay {formatMoney(income)} a month; spending is well below it.</p>
      )}
    </div>
  );
}
