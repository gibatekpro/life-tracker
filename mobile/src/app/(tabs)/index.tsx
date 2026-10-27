import {
  categoryShares, earlierMonths, formatMoney, leftNote, moneyHeld, owedNote, periodLabel, spentNote, spentShare, spentShareTone,
} from '@lifetracker/core';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getAccounts, getDebts, getMonthlySummary, getTransactions } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import Screen from '@/components/Screen';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import Stat from '@/components/ui/Stat';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import SafeToSpendCard from '@/features/overview/SafeToSpendCard';
import SpendingTrendChart from '@/features/overview/SpendingTrendChart';
import { openNewTransaction } from '@/features/transactions/open';
import TransactionRow from '@/features/transactions/TransactionRow';
import { useTokens } from '@/theme/tokens';

// The last six budget months' summaries, oldest first, ending with the one I'm in now
// (which, before payday, is still last month's).
async function lastSixMonths() {
  const current = await getMonthlySummary();
  const earlier = await Promise.all(earlierMonths(current.year, current.month, 5).map((m) => getMonthlySummary(m.year, m.month)));
  return [...earlier, current];
}

// "How am I doing?" at a glance (web: OverviewPage): this month's spending against income, what I
// have, what I owe and when it's gone, the trend, where the money went, safe to spend, accounts,
// and the latest transactions, each linking through to its screen.
export default function HomeScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const summary = useData('summary', () => getMonthlySummary());
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const transactions = useData('transactions', getTransactions);
  const trend = useData('trend', lastSixMonths);

  const s = summary.data;
  const share = s ? spentShare(s) : 0;
  const held = accounts.data ? moneyHeld(accounts.data) : undefined;
  const failed = [summary, accounts, debts, transactions].find((d) => d.error);
  const spinner = <ActivityIndicator color={t.muted} style={styles.spinner} />;

  return (
    <Screen title="Overview" description={s ? `${periodLabel(s)} at a glance` : 'This month at a glance'}
      onAdd={() => openNewTransaction()} refreshing={summary.loading && !!s} onRefresh={refresh}>
      {failed && <ErrorCard message={`Couldn't load everything: ${failed.error}`} status={failed.errorStatus} />}

      <View style={styles.grid}>
        <Card style={styles.cell}>
          {s ? (
            <>
              <Stat label="Spent this month" value={formatMoney(s.totalSpent)} caption={spentNote(s)} />
              <ProgressBar label="Share of income spent" value={share} tone={spentShareTone(share)} />
            </>
          ) : spinner}
        </Card>
        <Card style={styles.cell}>
          {s ? <Stat label="Left this month" value={formatMoney(s.remaining)} tone={s.remaining < 0 ? 'negative' : 'positive'}
            caption={leftNote(s)} /> : spinner}
        </Card>
        <Card style={styles.cell}>
          {held ? <Stat label="Money held" value={held.value} tone={held.negative ? 'negative' : 'ink'} caption={held.sub} /> : spinner}
        </Card>
        <Card style={styles.cell}>
          {debts.data ? <Stat label="Total owed" value={formatMoney(debts.data.totalBalance)} tone="negative"
            caption={owedNote(debts.data)} /> : spinner}
        </Card>
      </View>

      <Card title="Spending trend" description="What you spent in each of the last six budget months">
        {trend.data ? <SpendingTrendChart months={trend.data} /> : spinner}
      </Card>

      <Card title="Where the money went" description="Spending by category this month">
        {!s ? spinner : s.byCategory.length === 0 ? (
          <EmptyState icon="tag" title="No spending yet this month">Expenses you record show up here by category.</EmptyState>
        ) : (
          <View style={styles.shares}>
            {categoryShares(s).map((c) => (
              <View key={c.category} style={styles.share}>
                <View style={styles.shareRow}>
                  <Text style={[styles.shareName, { color: t.ink }]} numberOfLines={1}>{c.category}</Text>
                  <Text style={[styles.money, { color: t.ink }]}>
                    {formatMoney(c.total)}<Text style={{ color: t.muted }}>  {c.percent}%</Text>
                  </Text>
                </View>
                <ProgressBar label={`${c.category} share of spending`} value={c.bar} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <SafeToSpendCard />

      <Card title="Accounts" action={{ label: 'Manage', onPress: () => router.push('/accounts') }}>
        {!accounts.data ? spinner : accounts.data.map((a, i) => (
          <Pressable key={a.id} onPress={() => router.push(`/accounts/${a.id}`)} accessibilityRole="link"
            style={({ pressed }) => [styles.accountRow, i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth },
              pressed && { opacity: 0.6 }]}>
            <Text style={[styles.accountName, { color: t.ink }]} numberOfLines={1}>{a.name}</Text>
            <Text style={[styles.money, { color: a.type === 'Current' ? t.ink : t.negative }]}>
              {a.type === 'Current' ? '' : '−'}{formatMoney(a.balance, a.currency)}
            </Text>
          </Pressable>
        ))}
        {debts.data && debts.data.currenciesWithoutRate.length > 0 && (
          <Alert tone="warning">
            {`${debts.data.currenciesWithoutRate.join(', ')} debts aren't in the £ total until you record a transfer in that currency.`}
          </Alert>
        )}
      </Card>

      <Card title="Recent transactions" action={{ label: 'View all', onPress: () => router.navigate('/activity') }}>
        {!transactions.data ? spinner : transactions.data.length === 0 ? (
          <EmptyState icon="list.bullet" title="No transactions yet"
            action={<Button title="Add your first" onPress={() => openNewTransaction()} />}>
            Record spending, income and card repayments, or let Apple Pay add them for you.
          </EmptyState>
        ) : (
          <View style={styles.recent}>
            {transactions.data.slice(0, 6).map((tx) => <TransactionRow key={tx.id} t={tx} />)}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { marginVertical: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '47%', flexGrow: 1, padding: 14 },
  shares: { gap: 14 },
  share: { gap: 6 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  shareName: { flex: 1, fontSize: 14, fontWeight: '500' },
  money: { fontSize: 14, fontVariant: ['tabular-nums'] },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  accountName: { flex: 1, fontSize: 14 },
  recent: { marginHorizontal: -16 },
});
