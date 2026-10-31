import { purchaseFigures, purchaseStatus, type PlannedPurchase } from '@lifetracker/core';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { useTokens } from '@/theme/tokens';

// One planned purchase as a card (web: PurchaseCard): saved of target with a progress bar, the monthly
// amount, on track or behind, and when it should be reached. Tapping opens it.
export default function PurchaseCard({ p }: { p: PlannedPurchase }) {
  const t = useTokens();
  const f = purchaseFigures(p);
  const status = purchaseStatus(p);
  return (
    <Pressable onPress={() => router.push(`/planned-purchases/${p.id}`)} accessibilityRole="link" accessibilityLabel={`${p.name}, ${f.saved}, ${status.label}`}
      style={({ pressed }) => [styles.card, { backgroundColor: t.surface, borderColor: t.line }, pressed && { opacity: 0.7 }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: t.accentSoft }]}><SymbolView name="gift" size={16} tintColor={t.accent} /></View>
        <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{p.name}</Text>
        {p.isEssential && <Badge tone="accent">Essential</Badge>}
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>
      <View style={styles.row}>
        <Text style={[styles.saved, { color: t.ink }]}>{f.saved}</Text>
        <Text style={[styles.small, { color: t.muted }]}>{f.percent}</Text>
      </View>
      <ProgressBar label={`${p.name} saved`} value={f.progress} tone={f.progressTone} />
      <View style={styles.row}>
        <View>
          <Text style={[styles.caption, { color: t.muted }]}>Each month</Text>
          <Text style={[styles.text, { color: t.ink }]}>{f.monthly}</Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.caption, { color: t.muted }]}>{f.target}</Text>
          <Text style={[styles.text, { color: f.late ? t.warning : t.ink }]}>{f.finish}</Text>
        </View>
      </View>
      {(f.behind ?? f.left) && <Text style={[styles.small, { color: f.behind ? t.warning : t.muted }]}>{f.behind ?? f.left}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  right: { alignItems: 'flex-end' },
  saved: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 12 },
  text: { fontSize: 14, fontVariant: ['tabular-nums'] },
  small: { fontSize: 13 },
});
