import { formatDayHeading, groupByDay } from '@lifetracker/core';
import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { getTransactions } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import ScreenHeader from '@/components/ScreenHeader';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import TransactionRow from '@/features/transactions/TransactionRow';
import { openNewTransaction } from '@/features/transactions/open';
import { useTokens } from '@/theme/tokens';

// Every transaction, newest first, grouped by day under headers that stick while scrolling.
// SectionList is FlatList's sibling for grouped data: same virtualised list, plus section headers.
export default function ActivityScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const { data, error, errorStatus, loading } = useData('transactions', getTransactions);
  const sections = useMemo(() => groupByDay(data ?? []), [data]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <TransactionRow t={item} />}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.day, { color: t.muted, backgroundColor: t.canvas }]}>
          {formatDayHeading(section.date).toUpperCase()}
        </Text>
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenHeader title="Activity" onAdd={() => openNewTransaction()} />
          {error && <ErrorCard message={error} status={errorStatus} />}
        </View>
      }
      ListEmptyComponent={
        !data ? (error ? undefined : <ActivityIndicator style={styles.spinner} color={t.muted} />)
          : <Text style={[styles.empty, { color: t.muted }]}>Nothing recorded yet. Use + to add one.</Text>
      }
      stickySectionHeadersEnabled
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={styles.content}
      // The pull spinner only shows over a list already on screen; the first load has its own.
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={t.muted} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  header: { padding: 16, paddingBottom: 4, gap: 12 },
  day: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  spinner: { marginTop: 48 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 48, paddingHorizontal: 32 },
});
