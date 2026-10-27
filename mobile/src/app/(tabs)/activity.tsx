import {
  accountGroups, accountLabel, filterTransactions, formatDayHeading, formatMoney, groupByDay, inPeriod, parseYm, periodLabel,
  shiftMonth, toYm, transactionTotals, type TypeFilter,
} from '@lifetracker/core';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { getAccounts, getMonthlySummary, getTransactions } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import MonthNav from '@/components/MonthNav';
import PickerButton from '@/components/PickerButton';
import ScreenHeader from '@/components/ScreenHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import SearchField from '@/components/ui/SearchField';
import Segmented from '@/components/ui/Segmented';
import Stat from '@/components/ui/Stat';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { openNewTransaction } from '@/features/transactions/open';
import TransactionRow from '@/features/transactions/TransactionRow';
import { useTokens } from '@/theme/tokens';

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Expense', label: 'Spending' },
  { value: 'Income', label: 'Income' },
  { value: 'Transfer', label: 'Transfers' },
];

// Every transaction, a budget month at a time, with filters (web: TransactionsPage). Tapping one opens
// it to edit or delete. The month's dates come from the API's summary, so they follow payday exactly
// as the summary does. The web keeps the month and filters in the URL; here they're the screen's state.
export default function ActivityScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const transactions = useData('transactions', getTransactions);
  const accounts = useData('accounts', getAccounts);
  const [search, setSearch] = useState('');
  // "View all" on an account opens this tab filtered to it (the web's ?account=). When the param
  // changes, the filter follows it, adjusted during render rather than in an effect.
  const { account: accountParam } = useLocalSearchParams<{ account?: string }>();
  const [accountId, setAccountId] = useState<number | null>(accountParam ? Number(accountParam) : null);
  const [seenParam, setSeenParam] = useState(accountParam);
  if (accountParam !== seenParam) {
    setSeenParam(accountParam);
    if (accountParam) setAccountId(Number(accountParam));
  }
  const [type, setType] = useState<TypeFilter>('All');

  // The month I'm in now (it may still be last month's, if payday hasn't come yet).
  const current = useData('summary', () => getMonthlySummary());
  const currentYm = current.data ? toYm(current.data.year, current.data.month) : null;
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const month = chosenMonth ?? currentYm;
  const period = useData(`summary-${month}`, () => {
    const { year, month: m } = parseYm(month!);
    return getMonthlySummary(year, m);
  }, month !== null);
  const p = period.data && toYm(period.data.year, period.data.month) === month ? period.data : undefined;

  const inMonth = useMemo(() => (p ? inPeriod(transactions.data ?? [], p) : []), [transactions.data, p]);
  const shown = useMemo(() => filterTransactions(inMonth, { accountId, type, search }), [inMonth, accountId, type, search]);
  const sections = useMemo(() => groupByDay(shown), [shown]);
  const { spent, received, transfers } = transactionTotals(inMonth);

  const accountChoices = [
    { label: 'All accounts', value: null as number | null },
    ...accountGroups(accounts.data ?? []).flatMap((g) => g.accounts).map((a) => ({ label: accountLabel(a), value: a.id as number | null })),
  ];
  const chosenAccount = accounts.data?.find((a) => a.id === accountId);
  const failed = [transactions, current, period].find((d) => d.error);
  const ready = transactions.data && p;

  return (
    <SectionList
      sections={ready ? sections : []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <TransactionRow t={item} showDate={false} />}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.day, { color: t.muted, backgroundColor: t.canvas }]}>{formatDayHeading(section.date).toUpperCase()}</Text>
      )}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.line }]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenHeader title="Transactions" description="Everything you've spent, received and moved between accounts."
            onAdd={() => openNewTransaction()} />
          <MonthNav label={p ? periodLabel(p) : '…'}
            onPrevious={() => month && setChosenMonth(shiftMonth(month, -1))}
            onNext={() => month && setChosenMonth(shiftMonth(month, 1))}
            previousDisabled={!month} nextDisabled={!month || !currentYm || month >= currentYm} />
          <View style={styles.stats}>
            <Card style={styles.stat}><Stat label="Spent" value={formatMoney(spent)} /></Card>
            <Card style={styles.stat}><Stat label="Money in" value={formatMoney(received)} tone="positive" /></Card>
            <Card style={styles.stat}><Stat label="Transfers" value={String(transfers)} caption="not counted as spending" /></Card>
          </View>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search description or category" />
          <PickerButton title="Account" valueLabel={chosenAccount ? accountLabel(chosenAccount) : 'All accounts'}
            choices={accountChoices} onChange={setAccountId} />
          <Segmented label="Type" options={typeOptions} value={type} onChange={setType} />
          {failed && <ErrorCard message={failed.error!} status={failed.errorStatus} />}
        </View>
      }
      ListEmptyComponent={
        !ready ? (failed ? undefined : <ActivityIndicator style={styles.spinner} color={t.muted} />)
          : inMonth.length === 0 ? (
            <EmptyState icon="list.bullet" title="Nothing recorded this month"
              action={<Button title="New transaction" onPress={() => openNewTransaction()} />}>
              Use the button to add one, or pick another month.
            </EmptyState>
          ) : (
            <EmptyState icon="list.bullet" title="No transactions match">Try a different search or filter.</EmptyState>
          )
      }
      stickySectionHeadersEnabled
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={styles.content}
      // The pull spinner only shows over a list already on screen; the first load has its own.
      refreshControl={<RefreshControl refreshing={transactions.loading && !!transactions.data} onRefresh={refresh} tintColor={t.muted} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  header: { padding: 16, paddingBottom: 4, gap: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12 },
  day: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  spinner: { marginTop: 48 },
});
