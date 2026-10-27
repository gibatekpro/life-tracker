import { debtLineNote, formatMoney, plannedLabel, type DebtLine } from '@lifetracker/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { useTokens } from '@/theme/tokens';
import NoteParts from './NoteParts';

// A card or loan's line (web: DebtLineRow): what I plan to pay this month, what's been paid in, and
// what the avalanche plan suggests (with "Use" to take it). Everything is in the account's own currency
// (₦ for a naira loan); for those, the £ figure that counts in the month's totals is shown too.
export default function DebtLineRow({ debt: d, onEdit, onUse }: { debt: DebtLine; onEdit: () => void; onUse: (amount: number) => void }) {
  const t = useTokens();
  const c = d.currency;
  const { parts, progressTone, suggestion } = debtLineNote(d);

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.title}>
          <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{d.name}</Text>
          {c !== 'GBP' && <Badge>{c}</Badge>}
          {d.nativeMonthAmount !== null && <Badge tone="accent">This month</Badge>}
        </View>
        <Text style={[styles.figures, { color: t.ink }]}>
          {formatMoney(d.nativePaid, c)} <Text style={{ color: t.muted }}>paid of </Text>
          <Text onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Change the ${d.name} budget`}
            style={[styles.planned, { textDecorationColor: t.subtle }]}>{plannedLabel(d.nativePlanned, c)}</Text>
        </Text>
      </View>
      {d.nativePlanned > 0 && <ProgressBar label={`${d.name} paid`} value={d.nativePaid / d.nativePlanned} tone={progressTone} />}
      <NoteParts parts={parts} />
      {suggestion && (
        <View style={styles.suggestion}>
          <Text style={[styles.small, { color: t.muted }]}>
            Avalanche suggests <Text style={{ color: t.ink, fontWeight: '500' }}>{suggestion.text}</Text>
          </Text>
          {suggestion.differs && (
            <Pressable onPress={() => onUse(suggestion.amount)} accessibilityRole="button" accessibilityLabel={`Use ${suggestion.text} for ${d.name}`} hitSlop={8}>
              <Text style={[styles.use, { color: t.accent }]}>Use</Text>
            </Pressable>
          )}
        </View>
      )}
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
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  small: { fontSize: 12 },
  use: { fontSize: 14, fontWeight: '600' },
});
