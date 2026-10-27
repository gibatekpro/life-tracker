import {
  approxPounds, creditUsage, formatDate, formatMoney, isDebt, payDraft, payoffStat, rateNote, typeLabel,
} from '@lifetracker/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert as NativeAlert, StyleSheet, Text, View } from 'react-native';

import { deleteAccount, getAccount, getAccountPayments, getAccounts, getDebts, getExchangeRates, getTransactions } from '@/api';
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
import AliasesCard from '@/features/accounts/AliasesCard';
import { typeIcon } from '@/features/accounts/typeIcon';
import WhatIfCard from '@/features/accounts/WhatIfCard';
import { openNewTransaction } from '@/features/transactions/open';
import TransactionRow from '@/features/transactions/TransactionRow';
import { useTokens } from '@/theme/tokens';

// One account in full (web: AccountDetailPage): its balance, and for a card or loan the payoff
// picture, a what-if and payment history. Also its Apple Pay names, recent transactions, edit and delete.
export default function AccountScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  // Once deleted, stop loading it: the refresh after deleting would otherwise ask for it again.
  const [deleted, setDeleted] = useState(false);
  const account = useData(`account-${id}`, () => getAccount(id), !deleted);
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const transactions = useData('transactions', getTransactions);
  const payments = useData(`payments-${id}`, () => getAccountPayments(id), !deleted);
  const rates = useData('rates', getExchangeRates);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const a = account.data?.id === id ? account.data : undefined;
  if (account.error && !a) {
    return (
      <Screen>
        <EmptyState icon="wallet.bifold" title="Account not found"
          action={<Button title="Back to accounts" variant="secondary" onPress={() => router.back()} />}>{account.error}</EmptyState>
      </Screen>
    );
  }
  if (!a) return <Screen><ActivityIndicator color={t.muted} /></Screen>;

  const debt = isDebt(a);
  const projection = debts.data?.debts.find((d) => d.debt.id === id)?.projection;
  const paidOff = projection && payoffStat(projection, a.currency);
  const mine = (transactions.data ?? []).filter((tx) => tx.accountId === id || tx.toAccountId === id);
  const credit = creditUsage(a);
  const pounds = approxPounds(a.balance, a.currency, rates.data);

  const confirmDelete = () =>
    NativeAlert.alert(`Delete ${a.name}?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleteError(null);
          try {
            await deleteAccount(id);
            setDeleted(true);
            refresh();
            router.back();
          } catch (e) {
            setDeleteError((e as Error).message);
          }
        },
      },
    ]);

  return (
    <Screen refreshing={account.loading} onRefresh={refresh}>
      <Stack.Screen options={{
        title: a.name,
        headerRight: () => <HeaderButton title="Edit" onPress={() => router.push({ pathname: '/account-form', params: { id: String(id) } })} />,
      }} />

      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: debt ? t.negativeSoft : t.accentSoft }]}>
          <SymbolView name={typeIcon[a.type]} size={22} tintColor={debt ? t.negative : t.accent} />
        </View>
        <View style={styles.badges}><Badge>{typeLabel[a.type]}</Badge><Badge>{a.currency}</Badge></View>
      </View>
      {debt
        ? <Button title="Pay" onPress={() => openNewTransaction(payDraft(a, accounts.data ?? []))} />
        : <Button title="New transaction" onPress={() => openNewTransaction({ accountId: a.id })} />}

      <Card>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Stat label={debt ? 'Owed' : 'Balance'} value={formatMoney(a.balance, a.currency)}
              tone={debt || a.balance < 0 ? 'negative' : 'ink'} caption={pounds ?? undefined} />
          </View>
          {debt && <View style={styles.stat}><Stat label="APR" value={`${a.apr}%`} caption={a.apr === 0 ? 'Interest included in the total' : undefined} /></View>}
          {debt && (
            <View style={styles.stat}>
              <Stat label="Monthly payment" value={formatMoney(a.monthlyPayment, a.currency)}
                caption={a.minimumPayment > 0 ? `Minimum ${formatMoney(a.minimumPayment, a.currency)}` : undefined} />
            </View>
          )}
          {debt && paidOff && (
            <View style={styles.stat}>
              <Stat label="Paid off" value={paidOff.value} tone={paidOff.clears ? 'positive' : 'negative'} caption={paidOff.sub} />
            </View>
          )}
        </View>
        {a.currency !== 'GBP' && <Text style={[styles.small, { color: t.muted }]}>{rateNote(a.currency, rates.data)}</Text>}
        {credit && (
          <View style={styles.credit}>
            <View style={styles.creditRow}>
              <Text style={[styles.small, { color: t.muted }]}>Credit used</Text>
              <Text style={[styles.small, { color: t.ink }]}>{credit.note}</Text>
            </View>
            <ProgressBar label="Credit used" value={credit.used} tone={credit.tone} />
          </View>
        )}
      </Card>

      {debt && a.balance > 0 && <WhatIfCard debt={a} />}

      <Card title={debt ? 'Activity' : 'Transactions'}
        action={{ label: 'View all', onPress: () => router.navigate({ pathname: '/activity', params: { account: String(id) } }) }}>
        {!transactions.data ? <ActivityIndicator color={t.muted} /> : mine.length === 0 ? (
          <EmptyState icon="list.bullet" title="No transactions yet" />
        ) : (
          <View style={styles.rows}>{mine.slice(0, 8).map((tx) => <TransactionRow key={tx.id} t={tx} />)}</View>
        )}
      </Card>

      {debt && (
        <Card title="Payments">
          {!payments.data ? <ActivityIndicator color={t.muted} /> : payments.data.length === 0 ? (
            <Text style={[styles.text, { color: t.muted }]}>No payments recorded yet.</Text>
          ) : payments.data.map((p, i) => (
            <View key={p.id} style={[styles.payment, i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View>
                <Text style={[styles.paid, { color: t.positive }]}>{formatMoney(p.amount, a.currency)}</Text>
                <Text style={[styles.small, { color: t.muted }]}>from {p.fromAccountName}</Text>
              </View>
              <Text style={[styles.text, { color: t.muted }]}>{formatDate(p.date)}</Text>
            </View>
          ))}
        </Card>
      )}

      <AliasesCard account={a} />

      <Card title="Delete account">
        <Text style={[styles.text, { color: t.muted }]}>Only possible while it has no transactions.</Text>
        {deleteError && <Alert tone="negative">{deleteError}</Alert>}
        <Button title={`Delete ${a.name}`} variant="danger" onPress={confirmDelete} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 12 },
  stat: { flexBasis: '46%', flexGrow: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  text: { fontSize: 14, lineHeight: 20 },
  credit: { gap: 6, marginTop: 8 },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rows: { marginHorizontal: -16 },
  payment: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10 },
  paid: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
