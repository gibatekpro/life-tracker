import {
  foreignCurrencies, foreignOwed, formatMoney, monthlyBudgetNote, payoffChartDescription, payoffNote, planHeadline, planMissingRates,
  rateNote,
} from '@lifetracker/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getAvalanchePlan, getDebts, getExchangeRates } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import Screen from '@/components/Screen';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import ExtraSimulator from '@/features/plan/ExtraSimulator';
import PayoffChart from '@/features/plan/PayoffChart';
import { useDebounce } from '@/hooks/useDebounce';
import { useTokens } from '@/theme/tokens';

// The plan for getting out of debt (web: DebtPlanPage), using the avalanche method: every debt gets its
// normal payment, and anything extra goes to the highest interest rate first. When a debt is cleared,
// its payment rolls on to the next. The simulator shows what an extra amount each month would do;
// as on the web's phone layout, it comes straight after the debt-free date.
export default function PlanScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [extraInput, setExtraInput] = useState('0');
  const extra = useDebounce(Math.max(0, Number(extraInput) || 0));
  const baseline = useData('plan-0', () => getAvalanchePlan(0));
  const plan = useData(`plan-${extra}`, () => getAvalanchePlan(extra));
  const debts = useData('debts', getDebts);
  const rates = useData('rates', getExchangeRates);
  const debtAccount = (id: number) => debts.data?.debts.find((d) => d.debt.id === id)?.debt;
  const foreign = foreignCurrencies((debts.data?.debts ?? []).map((d) => d.debt));
  const missingRates = debts.data ? planMissingRates(debts.data.currenciesWithoutRate) : null;

  const b = baseline.data;
  const p = plan.data;
  const failed = [baseline, plan].find((d) => d.error);
  const headline = p && planHeadline(p);

  return (
    <Screen title="Debt plan" description="Pay every debt its normal payment, and put anything extra on the highest interest rate first."
      refreshing={baseline.loading && !!b} onRefresh={refresh}>
      {failed && <ErrorCard message={failed.error!} status={failed.errorStatus} />}
      {missingRates && <Alert tone="warning">{missingRates}</Alert>}

      {!p || !b || !headline ? <ActivityIndicator color={t.muted} /> : b.payoffs.length === 0 && b.canBePaidOff ? (
        <Card><EmptyState icon="target" title="Nothing to pay off">Add a credit card or loan on the Accounts page to plan its payoff.</EmptyState></Card>
      ) : (
        <>
          <Card>
            {headline.clears ? (
              <>
                <Text style={[styles.small, { color: t.muted }]}>Debt-free by</Text>
                <Text style={[styles.big, { color: t.positive }]}>{headline.date}</Text>
                <Text style={[styles.text, { color: t.muted }]}>{headline.note}</Text>
              </>
            ) : <Alert tone="negative">{headline.message}</Alert>}
          </Card>

          <ExtraSimulator input={extraInput} onInput={setExtraInput} extra={extra} baseline={b} plan={p} />

          {p.canBePaidOff && b.canBePaidOff && (
            <Card title="When each debt is cleared" description={payoffChartDescription(extra)}>
              <PayoffChart baseline={b} plan={p} showExtra={extra > 0} />
            </Card>
          )}

          {p.canBePaidOff && (
            <Card title="Payoff order" description="Highest interest first. Each cleared payment rolls on to the next.">
              {p.payoffs.map((x, i) => {
                const owed = foreignOwed(debtAccount(x.id), rates.data);
                return (
                  <View key={x.id} style={styles.step}>
                    <View style={[styles.number, { backgroundColor: t.accentSoft }]}>
                      <Text style={[styles.numberText, { color: t.accent }]}>{i + 1}</Text>
                    </View>
                    <View style={styles.stepBody}>
                      <Pressable onPress={() => router.push(`/accounts/${x.id}`)} accessibilityRole="link">
                        <Text style={[styles.name, { color: t.ink }]}>{x.name}</Text>
                      </Pressable>
                      <Text style={[styles.small, { color: t.muted }]}>{payoffNote(x)}</Text>
                      {owed && <Text style={[styles.small, { color: t.ink }]}>{owed}</Text>}
                      <Text style={[styles.small, { color: t.muted }]}>{formatMoney(x.interestPaid)} interest</Text>
                    </View>
                  </View>
                );
              })}
              {foreign.length > 0 && (
                <View style={[styles.notes, { borderTopColor: t.line }]}>
                  {foreign.map((c) => <Text key={c} style={[styles.small, { color: t.muted }]}>{rateNote(c, rates.data)}</Text>)}
                </View>
              )}
            </Card>
          )}

          <Card title="Monthly budget">
            <Text style={[styles.text, { color: t.muted }]}>{monthlyBudgetNote(b)}</Text>
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="link">
              <Text style={[styles.link, { color: t.accent }]}>Set the debt budget</Text>
            </Pressable>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
  text: { fontSize: 14, lineHeight: 20 },
  big: { fontSize: 36, fontWeight: '600' },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 8 },
  number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '600' },
  stepBody: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500' },
  notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 6, gap: 2 },
  link: { fontSize: 15, fontWeight: '500', marginTop: 4 },
});
