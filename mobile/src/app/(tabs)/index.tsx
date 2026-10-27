import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getBudgetMonth } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import Screen from '@/components/Screen';
import Card from '@/components/ui/Card';
import Stat from '@/components/ui/Stat';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { formatDate, formatDayMonth, formatMoney } from '@lifetracker/core';
import { openNewTransaction } from '@/features/transactions/open';
import { useTokens } from '@/theme/tokens';

// The budget month I'm in now (the API works out the dates from payday), at a glance.
// "+" opens the transaction form as a modal.
export default function HomeScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const { data, error, errorStatus, loading } = useData('budget-month', () => getBudgetMonth());
  const budget = data?.budget;

  return (
    // The pull spinner only shows over data already on screen; the first load has its own.
    <Screen title="Home" refreshing={loading && !!budget} onRefresh={refresh} onAdd={() => openNewTransaction()}>
      {error && <ErrorCard message={error} status={errorStatus} />}

      {!budget && loading && <ActivityIndicator style={styles.spinner} color={t.muted} />}

      {budget && (
        <>
          <Card>
            <Text style={[styles.period, { color: t.ink }]}>
              {formatDayMonth(budget.periodStart)} – {formatDate(budget.periodEnd)}
            </Text>
            <Text style={{ color: t.muted }}>
              {budget.daysLeft === 1 ? '1 day left' : `${budget.daysLeft} days left`}
            </Text>
          </Card>

          <Card>
            <Stat
              large
              label="Safe to spend"
              value={`${formatMoney(budget.safeToSpendPerDay)} a day`}
              caption={`${formatMoney(budget.safeToSpend)} until payday, after what's set aside`}
              tone={budget.safeToSpendPerDay < 0 ? 'negative' : 'positive'}
            />
          </Card>

          <Card>
            <View style={styles.row}>
              <Stat
                label="Income"
                value={formatMoney(budget.income)}
                caption={data.incomeMode === 'Recorded' ? 'Recorded' : 'Monthly setting'}
              />
              <Stat
                label="Unallocated"
                value={formatMoney(budget.unallocated)}
                caption="Income − planned"
                tone={budget.unallocated < 0 ? 'negative' : 'ink'}
              />
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  period: { fontSize: 20, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 16 },
});
