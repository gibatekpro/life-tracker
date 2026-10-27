import { niceAxis, payoffChartRows, type AvalanchePlan } from '@lifetracker/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { useTokens } from '@/theme/tokens';

const axisWidth = 40;

// How many months until each debt is cleared, at the current budget and with the extra (web:
// PayoffChart), drawn with react-native-gifted-charts. The web draws horizontal bars; here they stand
// up, one group per debt with its name underneath and the months on top, since the library's
// horizontal mode rotates the whole chart and misplaced the names on a phone.
export default function PayoffChart({ baseline, plan, showExtra }: { baseline: AvalanchePlan; plan: AvalanchePlan; showExtra: boolean }) {
  const t = useTokens();
  const [width, setWidth] = useState(0);
  const rows = payoffChartRows(baseline, plan);
  const axis = niceAxis(Math.max(0, ...rows.map((r) => Math.max(r.now, r.withExtra ?? 0))));

  const plot = Math.max(0, width - axisWidth - 8);
  const slot = rows.length ? plot / rows.length : 0;
  const barWidth = Math.max(6, showExtra ? Math.min(22, slot * 0.32) : Math.min(32, slot * 0.5));
  const group = showExtra ? barWidth * 2 + 2 : barWidth;
  const data = rows.flatMap((r) => {
    const label = { label: r.name, labelWidth: slot - 4, labelTextStyle: { color: t.ink, fontSize: 11, textAlign: 'center' as const } };
    return showExtra
      ? [
        { value: r.now, frontColor: t.chart6, spacing: 2, ...label },
        { value: r.withExtra ?? 0, frontColor: t.accent, spacing: slot - group },
      ]
      : [{ value: r.now, frontColor: t.accent, spacing: slot - group, ...label }];
  });

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible
        accessibilityLabel={`Months until each debt is cleared: ${rows.map((r) => `${r.name} ${r.now}${showExtra ? `, ${r.withExtra} with the extra` : ''}`).join('; ')}`}>
        {width > 0 && (
          <BarChart
            data={data}
            width={plot}
            height={170}
            barWidth={barWidth}
            initialSpacing={(slot - group) / 2}
            endSpacing={0}
            disableScroll
            roundedTop
            showValuesAsTopLabel
            topLabelTextStyle={{ color: t.muted, fontSize: 11 }}
            maxValue={axis.max}
            stepValue={axis.step}
            noOfSections={axis.max / axis.step}
            yAxisLabelWidth={axisWidth}
            formatYLabel={(label) => `${label} mo`}
            yAxisTextStyle={{ color: t.muted, fontSize: 11 }}
            yAxisThickness={0}
            xAxisThickness={StyleSheet.hairlineWidth}
            xAxisColor={t.line}
            rulesColor={t.line}
            rulesType="solid"
            xAxisTextNumberOfLines={2}
            xAxisLabelsHeight={30}
          />
        )}
      </View>
      {showExtra && (
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: t.chart6 }]} /><Text style={[styles.small, { color: t.muted }]}>Current budget</Text>
          <View style={[styles.dot, { backgroundColor: t.accent }]} /><Text style={[styles.small, { color: t.muted }]}>With extra</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  small: { fontSize: 12 },
});
