import { purchaseGroups } from '@lifetracker/core';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getPlannedPurchases } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import HeaderButton from '@/components/HeaderButton';
import Screen from '@/components/Screen';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { openPurchaseForm } from '@/features/purchases/open';
import PurchaseCard from '@/features/purchases/PurchaseCard';
import { useTokens } from '@/theme/tokens';

// Everything I'm saving towards (web: PlannedPurchasesPage): how much is saved, whether it's on track
// and when it should be reached. Finished ones (bought, cancelled) below.
export default function PlannedPurchasesScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const purchases = useData('planned-purchases', getPlannedPurchases);

  return (
    <Screen description="Save towards something each month, and see how it's going." refreshing={purchases.loading && !!purchases.data}
      onRefresh={refresh}>
      <Stack.Screen options={{ headerRight: () => <HeaderButton title="Add" onPress={() => openPurchaseForm()} /> }} />
      {purchases.error && <ErrorCard message={purchases.error} status={purchases.errorStatus} />}

      {!purchases.data ? (!purchases.error && <ActivityIndicator color={t.muted} />) : purchases.data.length === 0 ? (
        <Card>
          <EmptyState icon="gift" title="Nothing planned yet" action={<Button title="Plan one" onPress={() => openPurchaseForm()} />}>
            Saving for a visa fee or a laptop? Set a target and a monthly amount, and it gets its own line in the budget.
          </EmptyState>
        </Card>
      ) : purchaseGroups(purchases.data).map((g) => (
        <View key={g.label} style={styles.group}>
          <Text style={[styles.heading, { color: t.muted }]} accessibilityRole="header">{g.label.toUpperCase()}</Text>
          {g.items.map((p) => <PurchaseCard key={p.id} p={p} />)}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  heading: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
});
