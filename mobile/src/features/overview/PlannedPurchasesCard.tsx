import { homePurchases, purchaseFigures, purchaseStatus } from '@lifetracker/core';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getPlannedPurchases } from '@/api';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// What I'm saving for, at a glance (web: PlannedPurchasesCard): up to three planned purchases with their
// progress. Nothing at all when there are none.
export default function PlannedPurchasesCard() {
  const t = useTokens();
  const purchases = useData('planned-purchases', getPlannedPurchases);
  if (purchases.error) return null;
  const home = purchases.data && homePurchases(purchases.data);
  if (purchases.data && !home) return null;

  return (
    <Card title="Planned purchases" description={home?.summary} action={{ label: 'All', onPress: () => router.push('/planned-purchases') }}>
      {!home ? <ActivityIndicator color={t.muted} /> : (
        <View style={styles.list}>
          {home.items.map((p) => {
            const f = purchaseFigures(p);
            const status = purchaseStatus(p);
            return (
              <Pressable key={p.id} onPress={() => router.push(`/planned-purchases/${p.id}`)} accessibilityRole="link"
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
                <View style={styles.row}>
                  <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{p.name}</Text>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </View>
                <ProgressBar label={`${p.name} saved`} value={f.progress} tone={f.progressTone} />
                <Text style={[styles.small, { color: t.muted }]}>{f.saved} · {f.target}</Text>
              </Pressable>
            );
          })}
          {home.more && <Text style={[styles.small, { color: t.muted }]}>{home.more}</Text>}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  item: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: '500' },
  small: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
