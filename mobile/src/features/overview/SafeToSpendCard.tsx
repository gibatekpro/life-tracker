import { linesToWatch, safeToSpendSummary, watchLabel } from '@lifetracker/core';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getBudgetMonth } from '@/api';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// "How much can I spend today?" (web: SafeToSpendCard): what isn't spent or set aside for the
// rest of the budget month, per day, and the budget lines that are over or heading over.
export default function SafeToSpendCard() {
  const t = useTokens();
  const view = useData('budget-now', () => getBudgetMonth());
  const b = view.data?.budget;
  const safe = b ? safeToSpendSummary(b) : undefined;
  const watch = b ? linesToWatch(b) : [];

  return (
    <Card title="Safe to spend" action={{ label: 'Budget', onPress: () => router.navigate('/budget') }}>
      {!safe ? <ActivityIndicator color={t.muted} /> : (
        <>
          <Text style={[styles.big, { color: safe.negative ? t.negative : t.positive }]}>
            {safe.perDay}<Text style={[styles.perDay, { color: t.muted }]}> /day</Text>
          </Text>
          <Text style={[styles.note, { color: t.muted }]}>{safe.note}</Text>
          {watch.length > 0 && (
            <View style={[styles.watch, { borderTopColor: t.line }]}>
              {watch.map((w) => (
                <View key={w.line.categoryId} style={styles.row}>
                  <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{w.line.name}</Text>
                  <Badge tone={w.tone}>{watchLabel(w)}</Badge>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 30, fontWeight: '600', fontVariant: ['tabular-nums'] },
  perDay: { fontSize: 16, fontWeight: '500' },
  note: { fontSize: 14, lineHeight: 19 },
  watch: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontSize: 14 },
});
