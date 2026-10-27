import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AvalanchePlan } from '@lifetracker/core';
import { payoffChartRows } from '@lifetracker/core';
import { useTokens } from '../../hooks/useTokens';

// How many months until each debt is cleared, at the current budget and with the extra amount,
// so the effect of paying more is visible debt by debt.
export default function PayoffChart({ baseline, plan, showExtra }: {
  baseline: AvalanchePlan;
  plan: AvalanchePlan;
  showExtra: boolean;
}) {
  const t = useTokens(['chart-6', 'accent', 'muted', 'line', 'surface', 'ink'] as const);
  const data = payoffChartRows(baseline, plan);

  return (
    <div className="h-[calc(3.5rem*var(--rows)+3rem)]" style={{ ['--rows' as string]: data.length }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} stroke={t.line} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: t.muted, fontSize: 12 }} axisLine={false} tickLine={false}
            unit=" mo" />
          <YAxis type="category" dataKey="name" width={96} tick={{ fill: t.ink, fontSize: 13 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: t.line, opacity: 0.4 }}
            contentStyle={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, color: t.ink, fontSize: 13 }}
            formatter={(value, name) => [`${value} months`, name]} />
          {showExtra && <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: t.muted }} />}
          <Bar dataKey="now" name="Current budget" fill={showExtra ? t['chart-6'] : t.accent} radius={[0, 6, 6, 0]} maxBarSize={18} />
          {showExtra && <Bar dataKey="withExtra" name="With extra" fill={t.accent} radius={[0, 6, 6, 0]} maxBarSize={18} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
