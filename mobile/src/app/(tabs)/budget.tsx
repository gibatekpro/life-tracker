import {
  avalancheExtraNote, budgetDaysNote, budgetStats, budgetTree, copyNotice, debtBudgetNote, formatMoney, parseYm, periodLabel,
  shiftMonth, toYm, unallocatedNote, type BudgetLineKey,
} from '@lifetracker/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { copyPreviousBudget, getBudgetMonth, setBudgetAmount } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import MonthNav from '@/components/MonthNav';
import Screen from '@/components/Screen';
import CollapsibleTree from '@/components/tree/CollapsibleTree';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import Stat from '@/components/ui/Stat';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import BudgetLineRow from '@/features/budget/BudgetLineRow';
import DebtLineRow from '@/features/budget/DebtLineRow';
import { openAddLine, openAmountEditor } from '@/features/budget/open';
import { useTokens } from '@/theme/tokens';
import ErrorAlert from '@/components/ErrorAlert';

// My budget for a month (web: BudgetPage): what I plan to spend in each category and pay on each debt,
// against what's gone so far, what's unallocated, and what's safe to spend per day. Amounts are changed
// for one month in a small modal; months can be planned ahead. The spending tree opens and closes like
// the web's on a phone. The web keeps the month in the URL; here it's the screen's state.
export default function BudgetScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [ym, setYm] = useState<string | null>(null); // null: the budget month I'm in now
  const view = useData(`budget-${ym ?? 'now'}`, () => {
    if (!ym) return getBudgetMonth();
    const { year, month } = parseYm(ym);
    return getBudgetMonth(year, month);
  });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const v = view.data;
  const b = v?.budget;
  const shown = b ? toYm(b.year, b.month) : null;

  async function save(key: BudgetLineKey, amount: number) {
    setNotice(null);
    try {
      await setBudgetAmount(b!.year, b!.month, key, amount);
      refresh();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message });
    }
  }

  async function copyPrevious() {
    setNotice(null);
    try {
      const { copied } = await copyPreviousBudget(b!.year, b!.month);
      setNotice({ ok: true, text: copyNotice(copied) });
      refresh();
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message });
    }
  }

  const stats = v && budgetStats(v);
  const planNote = v && debtBudgetNote(v);
  const nudge = b && unallocatedNote(b);
  const linkStyle = { color: t.accent, fontWeight: '500' as const };

  return (
    <Screen title="Budget" description="Plan each month's spending and debt payments, and see how it's going."
      refreshing={view.loading && !!b} onRefresh={refresh}>
      {b && (
        <View style={styles.actions}>
          <View style={styles.action}><Button title="Copy last month" variant="secondary" onPress={copyPrevious} /></View>
          <View style={styles.action}><Button title="Add line" onPress={() => openAddLine(b.year, b.month)} /></View>
        </View>
      )}

      <View>
        <MonthNav label={b ? periodLabel(b) : '…'}
          onPrevious={() => shown && setYm(shiftMonth(shown, -1))} onNext={() => shown && setYm(shiftMonth(shown, 1))}
          previousDisabled={!shown} nextDisabled={!shown} />
        {b && <Text style={[styles.days, { color: t.muted }]}>{budgetDaysNote(b)}</Text>}
      </View>

      {view.error && <ErrorCard message={view.error} status={view.errorStatus} />}
      {notice && (notice.ok ? <Alert tone="info">{notice.text}</Alert> : <ErrorAlert message={notice.text} />)}

      {!b || !v || !stats || !planNote ? <ActivityIndicator color={t.muted} /> : (
        <>
          <View style={styles.grid}>
            <Card style={styles.cell}><Stat label="Income" value={stats.income.value} caption={stats.income.sub} /></Card>
            <Card style={styles.cell}><Stat label="Planned" value={stats.planned.value} caption={stats.planned.sub} /></Card>
            <Card style={styles.cell}><Stat label="Unallocated" value={stats.unallocated.value}
              tone={stats.unallocated.negative ? 'negative' : 'positive'} caption={stats.unallocated.sub} /></Card>
            <Card style={styles.cell}><Stat label="Safe to spend" value={stats.safe.value}
              tone={stats.safe.negative ? 'negative' : 'ink'} caption={stats.safe.sub} /></Card>
          </View>

          <Card title="Spending" description={`${formatMoney(b.spent)} spent of ${formatMoney(b.plannedSpending)} planned`}>
            {b.lines.length === 0 ? (
              <EmptyState icon="chart.pie" title="Nothing budgeted yet"
                action={<Button title="Add a line" onPress={() => openAddLine(b.year, b.month)} />}>
                Give categories a default in Settings to have them every month, or add a line for just this month.
              </EmptyState>
            ) : (
              <CollapsibleTree page="budget" nodes={budgetTree(b.lines)} renderRow={(node, context) => (
                <BudgetLineRow line={node.item} context={context} daysLeft={b.daysLeft}
                  onEdit={() => openAmountEditor({
                    year: b.year, month: b.month, categoryId: node.item.categoryId, name: node.item.name,
                    current: node.item.ownPlanned, defaultAmount: node.item.defaultAmount, monthAmount: node.item.monthAmount,
                  })} />
              )} />
            )}
          </Card>

          <Card title="Debt payments" description={`${formatMoney(b.debtPaid)} paid of ${formatMoney(b.plannedDebts)} planned`}>
            {b.debts.length === 0 ? <Text style={[styles.text, { color: t.muted }]}>No cards or loans to pay.</Text> : (
              <View>
                {b.debts.map((d, i) => (
                  <View key={d.accountId} style={i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }}>
                    <DebtLineRow debt={d} onUse={(amount) => save({ accountId: d.accountId }, amount)}
                      onEdit={() => openAmountEditor({
                        year: b.year, month: b.month, accountId: d.accountId, name: d.name, currency: d.currency,
                        current: d.nativePlanned, defaultAmount: d.nativeDefault, monthAmount: d.nativeMonthAmount,
                      })} />
                  </View>
                ))}
                {b.avalancheExtra > 0 && (
                  // What the avalanche plan pays beyond the debt lines.
                  <View style={[styles.extra, { borderTopColor: t.line }]}>
                    <View style={styles.extraTop}>
                      <Text style={[styles.extraName, { color: t.ink }]}>Extra for the avalanche</Text>
                      <Text style={[styles.text, { color: t.ink }]}>
                        {formatMoney(b.avalancheExtraPaid)} <Text style={{ color: t.muted }}>paid of</Text> {formatMoney(b.avalancheExtra)}
                      </Text>
                    </View>
                    <ProgressBar label="Avalanche extra paid" value={b.avalancheExtraPaid / b.avalancheExtra} />
                    <Text style={[styles.small, { color: t.muted }]}>{avalancheExtraNote(b)}</Text>
                  </View>
                )}
              </View>
            )}
            <Text style={[styles.planNote, { color: t.muted, backgroundColor: t.surfaceMuted }]}>
              {planNote.before}<Text style={linkStyle} onPress={() => router.navigate('/plan')}>{planNote.link}</Text>{planNote.after}
            </Text>
          </Card>

          {nudge && (
            <Alert tone="info">
              <Text style={[styles.text, { color: t.ink }]}>
                {nudge.before}<Text style={linkStyle} onPress={() => router.navigate('/plan')}>{nudge.link}</Text>{nudge.after}
              </Text>
            </Alert>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  days: { fontSize: 13, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '47%', flexGrow: 1, padding: 14 },
  text: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
  extra: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 6 },
  extraTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  extraName: { fontSize: 15, fontWeight: '600' },
  planNote: { fontSize: 12, lineHeight: 17, borderRadius: 10, overflow: 'hidden', padding: 12, marginTop: 8 },
});
