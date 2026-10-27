import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlySummary } from '@lifetracker/core';
import { useTokens } from '../../hooks/useTokens';
import { formatMoney, formatMoneyShort, spendingTrend } from '@lifetracker/core';

// Spending per budget month for the last six, to see the trend. What to draw (bars, the take-home
// pay line or a note) is core's spendingTrend, shared with the phone.
export default function SpendingTrendChart({ months }: { months: MonthlySummary[] }) {
  const t = useTokens(['accent', 'muted', 'line', 'surface', 'ink', 'chart-6'] as const);
  const { bars, recorded, income, showIncomeLine: showIncome, note } = spendingTrend(months);
  const data = bars.map((b) => ({ month: b.label, spent: b.spent, income: b.income }));

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
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}
