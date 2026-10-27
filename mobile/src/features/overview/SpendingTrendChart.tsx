import { formatMoney, formatMoneyShort, niceAxis, spendingTrend, type MonthlySummary } from '@lifetracker/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { useTokens } from '@/theme/tokens';

const axisWidth = 52;

// Spending per budget month for the last six (web: SpendingTrendChart, drawn with
// react-native-gifted-charts). What to draw is core's spendingTrend: bars, the dashed take-home pay
// line when spending gets near it (or a note underneath), or income bars beside spending when
// income is recorded. Phones can't hover, so tapping a bar shows its figures underneath (the latest
// month to start with).
export default function SpendingTrendChart({ months }: { months: MonthlySummary[] }) {
  const t = useTokens();
  const [width, setWidth] = useState(0);
  const { bars, recorded, income, showIncomeLine, note } = spendingTrend(months);
  const [selected, setSelected] = useState(bars.length - 1);
  const axis = niceAxis(Math.max(0, ...bars.map((b) => (recorded ? Math.max(b.spent, b.income) : b.spent)), showIncomeLine ? income : 0));

  // Each month gets an equal slot; with recorded income it holds two bars side by side.
  const plot = Math.max(0, width - axisWidth - 8);
  const slot = bars.length ? plot / bars.length : 0;
  const barWidth = Math.max(4, recorded ? Math.min(28, slot * 0.35) : Math.min(40, slot * 0.6));
  const group = recorded ? barWidth * 2 + 2 : barWidth;
  const data = bars.flatMap((b, i) => {
    const onPress = () => setSelected(i);
    const label = { label: b.label, labelWidth: group, labelTextStyle: { color: i === selected ? t.ink : t.muted, fontSize: 12 } };
    return recorded
      ? [
        { value: b.income, frontColor: t.chart6, spacing: 2, onPress, ...label },
        { value: b.spent, frontColor: t.accent, spacing: slot - group, onPress },
      ]
      : [{ value: b.spent, frontColor: t.accent, spacing: slot - group, onPress, ...label }];
  });
  const chosen = bars[selected];

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible
        accessibilityLabel={`Spending by budget month: ${bars.map((b) => `${b.label} ${formatMoney(b.spent)}`).join(', ')}`}>
        {width > 0 && (
          <BarChart
            data={data}
            width={plot}
            height={180}
            barWidth={barWidth}
            initialSpacing={(slot - group) / 2}
            endSpacing={0}
            disableScroll
            roundedTop
            maxValue={axis.max}
            stepValue={axis.step}
            noOfSections={axis.max / axis.step}
            yAxisLabelWidth={axisWidth}
            formatYLabel={(label) => formatMoneyShort(Number(label))}
            yAxisTextStyle={{ color: t.muted, fontSize: 11 }}
            yAxisThickness={0}
            xAxisThickness={StyleSheet.hairlineWidth}
            xAxisColor={t.line}
            rulesColor={t.line}
            rulesType="solid"
            showReferenceLine1={showIncomeLine}
            referenceLine1Position={income}
            referenceLine1Config={{
              color: t.muted, thickness: 1, dashWidth: 4, dashGap: 4,
              labelText: 'Take-home pay', labelTextStyle: { color: t.muted, fontSize: 11, textAlign: 'right', top: -14 },
            }}
          />
        )}
      </View>
      {recorded && (
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: t.chart6 }]} /><Text style={[styles.small, { color: t.muted }]}>Income</Text>
          <View style={[styles.dot, { backgroundColor: t.accent }]} /><Text style={[styles.small, { color: t.muted }]}>Spent</Text>
        </View>
      )}
      {chosen && (
        <Text style={[styles.caption, { color: t.ink }]}>
          {chosen.label}: Spent {formatMoney(chosen.spent)}{recorded ? ` · Income ${formatMoney(chosen.income)}` : ''}
        </Text>
      )}
      {note && <Text style={[styles.small, { color: t.muted }]}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  small: { fontSize: 12, lineHeight: 17 },
  caption: { fontSize: 14, marginTop: 8, fontVariant: ['tabular-nums'] },
});
