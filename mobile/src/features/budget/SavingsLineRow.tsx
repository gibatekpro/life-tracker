import { formatMoney, plannedLabel, savingsLineNote, type SavingsLine } from '@lifetracker/core';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { useTokens } from '@/theme/tokens';
import NoteParts from './NoteParts';

// A planned purchase's line (web: SavingsLineRow): what I plan to put aside this month (its monthly
// amount or this month's own figure, never more than it still needs) and what's gone into its account.
// The figure opens the budget-line modal; the name opens the planned purchase.
export default function SavingsLineRow({ line: s, onEdit }: { line: SavingsLine; onEdit: () => void }) {
  const t = useTokens();
  const { parts, progressTone } = savingsLineNote(s);
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.title}>
          <Text style={[styles.name, { color: t.ink }]} numberOfLines={1} accessibilityRole="link"
            onPress={() => router.push(`/planned-purchases/${s.plannedPurchaseId}`)}>{s.name}</Text>
          {s.isEssential && <Badge tone="accent">Essential</Badge>}
          {s.monthAmount !== null && <Badge tone="accent">This month</Badge>}
        </View>
        <Text style={[styles.figures, { color: t.ink }]}>
          {formatMoney(s.paid)} <Text style={{ color: t.muted }}>saved of </Text>
          <Text onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Change the ${s.name} budget`}
            style={[styles.planned, { textDecorationColor: t.subtle }]}>{plannedLabel(s.planned)}</Text>
        </Text>
      </View>
      {s.planned > 0 && <ProgressBar label={`${s.name} saved`} value={s.paid / s.planned} tone={progressTone} />}
      <NoteParts parts={parts} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, gap: 6 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  figures: { fontSize: 14, fontVariant: ['tabular-nums'] },
  planned: { fontWeight: '600', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
