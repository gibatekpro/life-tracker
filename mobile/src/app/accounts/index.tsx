import {
  approxPounds, creditUsage, foreignCurrencies, formatMoney, formatMonthYear, isDebt, payDraft, payoffStat, rateNote, typeLabel,
  type Account, type DebtWithProjection, type ExchangeRate,
} from '@lifetracker/core';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getAccounts, getDebts, getExchangeRates } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import HeaderButton from '@/components/HeaderButton';
import Screen from '@/components/Screen';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import Stat from '@/components/ui/Stat';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { typeIcon } from '@/features/accounts/typeIcon';
import { openNewTransaction } from '@/features/transactions/open';
import { useTokens } from '@/theme/tokens';

const openAccount = (id: number) => router.push(`/accounts/${id}`);

function CurrentTile({ a, rates }: { a: Account; rates: ExchangeRate[] | undefined }) {
  const t = useTokens();
  const pounds = approxPounds(a.balance, a.currency, rates);
  return (
    <Pressable onPress={() => openAccount(a.id)} accessibilityRole="link" accessibilityLabel={a.name}
      style={({ pressed }) => [styles.tile, { backgroundColor: t.surface, borderColor: t.line }, pressed && { opacity: 0.7 }]}>
      <View style={styles.tileTop}>
        <View style={[styles.icon, { backgroundColor: t.accentSoft }]}><SymbolView name={typeIcon[a.type]} size={16} tintColor={t.accent} /></View>
        {a.currency !== 'GBP' && <Badge>{a.currency}</Badge>}
      </View>
      <Text style={[styles.small, { color: t.muted }]}>{a.name}</Text>
      <Text style={[styles.amount, { color: a.balance < 0 ? t.negative : t.ink }]}>{formatMoney(a.balance, a.currency)}</Text>
      {pounds && <Text style={[styles.small, { color: t.muted }]}>{pounds}</Text>}
    </Pressable>
  );
}

function DebtTile({ item, rates, onPay }: { item: DebtWithProjection; rates: ExchangeRate[] | undefined; onPay: () => void }) {
  const t = useTokens();
  const { debt: d, projection: p } = item;
  const credit = creditUsage(d);
  const paidOff = payoffStat(p, d.currency);
  const pounds = approxPounds(d.balance, d.currency, rates);
  return (
    <View style={[styles.tile, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={styles.tileTop}>
        <Pressable onPress={() => openAccount(d.id)} accessibilityRole="link" style={styles.debtName}>
          <View style={[styles.icon, { backgroundColor: t.negativeSoft }]}><SymbolView name={typeIcon[d.type]} size={16} tintColor={t.negative} /></View>
          <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{d.name}</Text>
        </Pressable>
        <View style={styles.badges}>
          {d.currency !== 'GBP' && <Badge>{d.currency}</Badge>}
          <Badge>{typeLabel[d.type]}</Badge>
        </View>
      </View>

      <Text style={[styles.small, { color: t.muted }]}>Owed</Text>
      <Text style={[styles.amount, { color: t.negative }]}>{formatMoney(d.balance, d.currency)}</Text>
      {pounds && <Text style={[styles.small, { color: t.muted }]}>{pounds}</Text>}

      {credit && (
        <View style={styles.credit}>
          <ProgressBar label="Credit used" value={credit.used} tone={credit.tone} />
          <Text style={[styles.small, { color: t.muted }]}>{credit.note}</Text>
        </View>
      )}

      <View style={[styles.facts, { borderTopColor: t.line }]}>
        <View style={styles.fact}><Text style={[styles.small, { color: t.muted }]}>APR</Text><Text style={[styles.factValue, { color: t.ink }]}>{d.apr}%</Text></View>
        <View style={styles.fact}><Text style={[styles.small, { color: t.muted }]}>Paying</Text>
          <Text style={[styles.factValue, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(d.monthlyPayment, d.currency)}</Text></View>
        <View style={styles.fact}><Text style={[styles.small, { color: t.muted }]}>Paid off</Text>
          <Text style={[styles.factValue, { color: paidOff.clears ? t.ink : t.negative }]}>{paidOff.value}</Text></View>
      </View>
      {!p.canBePaidOff && (
        <Text style={[styles.small, { color: t.negative }]}>The payment doesn&apos;t cover the interest, so this never shrinks.</Text>
      )}

      <View style={styles.buttons}>
        <View style={styles.button}><Button title="Pay" onPress={onPay} /></View>
        <View style={styles.button}><Button title="Details" variant="secondary" onPress={() => openAccount(d.id)} /></View>
      </View>
    </View>
  );
}

// All my accounts (web: AccountsPage): what I have, then what I owe, with the totals that matter on top.
export default function AccountsScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const rates = useData('rates', getExchangeRates);
  const add = () => router.push('/account-form');

  const current = (accounts.data ?? []).filter((a) => !isDebt(a));
  const o = debts.data;
  const foreign = foreignCurrencies(accounts.data ?? []);
  const failed = [accounts, debts].find((d) => d.error);
  const spinner = <ActivityIndicator color={t.muted} />;

  return (
    <Screen description="Bank accounts, credit cards and loans." refreshing={accounts.loading && !!accounts.data} onRefresh={refresh}>
      <Stack.Screen options={{ headerRight: () => <HeaderButton primary title="Add" onPress={add} /> }} />
      {failed && <ErrorCard message={failed.error!} status={failed.errorStatus} />}

      <View style={styles.grid}>
        <Card style={styles.cell}>{o ? <Stat label="Total owed" value={formatMoney(o.totalBalance)} tone="negative" /> : spinner}</Card>
        <Card style={styles.cell}>{o ? <Stat label="Paying each month" value={formatMoney(o.totalMonthlyPayment)} /> : spinner}</Card>
        <Card style={styles.cell}>{o ? <Stat label="Interest still to pay" value={formatMoney(o.totalInterest)} /> : spinner}</Card>
        <Card style={styles.cell}>
          {o ? <Stat label="Debt-free" value={o.debts.length ? formatMonthYear(o.debtFreeDate) : 'Already'} tone="positive" /> : spinner}
        </Card>
      </View>

      {foreign.map((c) => <Text key={c} style={[styles.small, { color: t.muted }]}>{rateNote(c, rates.data)}</Text>)}

      {o && o.currenciesWithoutRate.length > 0 && (
        <Alert tone="warning">
          {`${o.currenciesWithoutRate.join(', ')} debts aren't in these £ totals yet. Record a transfer between pounds and ${o.currenciesWithoutRate.join('/')} and they'll be converted at that rate.`}
        </Alert>
      )}

      <Text style={[styles.section, { color: t.muted }]}>MONEY</Text>
      {!accounts.data ? spinner : current.length === 0 ? (
        <Card><EmptyState icon="building.columns" title="No bank accounts yet" action={<Button title="Add one" variant="secondary" onPress={add} />} /></Card>
      ) : current.map((a) => <CurrentTile key={a.id} a={a} rates={rates.data} />)}

      <Text style={[styles.section, { color: t.muted }]}>DEBTS</Text>
      {!o ? spinner : o.debts.length === 0 ? (
        <Card><EmptyState icon="creditcard" title="No debts">Credit cards and loans you add appear here with their payoff dates.</EmptyState></Card>
      ) : o.debts.map((item) => (
        <DebtTile key={item.debt.id} item={item} rates={rates.data}
          onPay={() => openNewTransaction(payDraft(item.debt, accounts.data ?? []))} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '47%', flexGrow: 1, padding: 14 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginTop: 8, marginBottom: -4 },
  tile: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  debtName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 16, fontWeight: '500' },
  badges: { flexDirection: 'row', gap: 6 },
  small: { fontSize: 13, lineHeight: 18 },
  amount: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  credit: { gap: 6, marginTop: 8 },
  facts: { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  fact: { flex: 1, gap: 2 },
  factValue: { fontSize: 14, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1 },
});
