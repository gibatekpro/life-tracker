import {
  addMoneyDraft, canChangePurchase, cancelPurchaseMessage, formatDate, formatMoney, formatYmLong, purchaseFigures, purchaseStatus,
  type PlannedPurchase,
} from '@lifetracker/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert as NativeAlert, StyleSheet, Text, View } from 'react-native';

import { cancelPlannedPurchase, getAccountPayments, getAccounts, getPlannedPurchase, getSettings } from '@/api';
import ErrorAlert from '@/components/ErrorAlert';
import ErrorCard from '@/components/ErrorCard';
import HeaderButton from '@/components/HeaderButton';
import Screen from '@/components/Screen';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import Stat from '@/components/ui/Stat';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { openMarkBought, openPurchaseForm } from '@/features/purchases/open';
import { openNewTransaction } from '@/features/transactions/open';
import { useTokens } from '@/theme/tokens';

// One planned purchase in full (web: PlannedPurchaseDetailPage): what's saved against the target, the
// plan, whether it's on track, and every contribution (transfers into its savings account). Add money
// opens a transfer from my default current account; it can also be edited, marked bought or cancelled.
// In two parts, like the forms: this one loads it (and shows not found or a spinner), and Detail only
// ever gets a loaded purchase, so nothing in it has to allow for one that isn't there yet.
export default function PlannedPurchaseScreen() {
  const t = useTokens();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const purchase = useData(`planned-purchase-${id}`, () => getPlannedPurchase(id));
  const p = purchase.data?.id === id ? purchase.data : undefined;

  if (purchase.error && !p) {
    if (purchase.errorStatus === 401) return <Screen><ErrorCard message={purchase.error} status={401} /></Screen>;
    return (
      <Screen>
        <EmptyState icon="gift" title="Planned purchase not found"
          action={<Button title="Back to planned purchases" variant="secondary" onPress={() => router.back()} />}>{purchase.error}</EmptyState>
      </Screen>
    );
  }
  if (!p) return <Screen><ActivityIndicator color={t.muted} /></Screen>;
  return <Detail p={p} loading={purchase.loading} />;
}

function Detail({ p, loading }: { p: PlannedPurchase; loading: boolean }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const id = p.id;
  const contributions = useData(`payments-${p.accountId}`, () => getAccountPayments(p.accountId));
  const accounts = useData('accounts', getAccounts);
  const settings = useData('settings', getSettings);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const f = purchaseFigures(p);
  const status = purchaseStatus(p);
  const open = canChangePurchase(p);
  const addMoney = () => openNewTransaction(addMoneyDraft(p, accounts.data ?? [], settings.data?.defaultAccountId ?? null));

  const confirmCancel = () =>
    NativeAlert.alert(`Cancel ${p.name}?`, cancelPurchaseMessage(p), [
      { text: 'Keep saving', style: 'cancel' },
      {
        text: 'Cancel it', style: 'destructive', onPress: async () => {
          setCancelError(null);
          try {
            await cancelPlannedPurchase(id);
            refresh();
          } catch (e) {
            setCancelError((e as Error).message);
          }
        },
      },
    ]);

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Stack.Screen options={{
        title: p.name,
        headerRight: open ? () => <HeaderButton title="Edit" onPress={() => openPurchaseForm(id)} /> : undefined,
      }} />

      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: t.accentSoft }]}><SymbolView name="gift" size={22} tintColor={t.accent} /></View>
        <View style={styles.badges}>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={p.isEssential ? 'accent' : 'neutral'}>{p.isEssential ? 'Essential' : 'Want'}</Badge>
        </View>
      </View>
      {open && <Button title="Add money" onPress={addMoney} />}

      <Card>
        <View style={styles.stats}>
          <View style={styles.stat}><Stat label="Saved" value={formatMoney(p.saved)} caption={`of ${formatMoney(p.targetAmount)} · ${f.percent}`} /></View>
          <View style={styles.stat}><Stat label="Each month" value={formatMoney(p.monthlyAmount)} caption={`Started ${formatYmLong(p.startMonth)}`} /></View>
          <View style={styles.stat}><Stat label="Last month to save" value={formatYmLong(p.targetMonth)} caption={f.left ?? undefined} /></View>
          <View style={styles.stat}>
            <Stat label="Expected" value={f.expected} tone={f.late ? 'warning' : p.status === 'Achieved' ? 'positive' : 'ink'}
              caption={f.behind ?? (p.status === 'Active' ? 'At the pace so far' : undefined)} />
          </View>
        </View>
        <ProgressBar label={`${p.name} saved`} value={f.progress} tone={f.progressTone} />
      </Card>

      <Card title="Contributions" description={`Transfers into ${p.accountName}`}
        action={{ label: 'Account', onPress: () => router.push(`/accounts/${p.accountId}`) }}>
        {!contributions.data ? <ActivityIndicator color={t.muted} /> : contributions.data.length === 0 ? (
          <EmptyState icon="gift" title="Nothing saved yet" action={open ? <Button title="Add money" onPress={addMoney} /> : undefined}>
            {`Each transfer into ${p.accountName} shows up here.`}
          </EmptyState>
        ) : contributions.data.map((c, i) => (
          <View key={c.id} style={[styles.payment, i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View>
              <Text style={[styles.paid, { color: t.positive }]}>{formatMoney(c.amount)}</Text>
              <Text style={[styles.small, { color: t.muted }]}>from {c.fromAccountName}</Text>
            </View>
            <Text style={[styles.text, { color: t.muted }]}>{formatDate(c.date)}</Text>
          </View>
        ))}
      </Card>

      {p.notes && <Card title="Notes"><Text style={[styles.text, { color: t.ink }]}>{p.notes}</Text></Card>}

      {open && (
        <Card title="Finish">
          <Text style={[styles.text, { color: t.muted }]}>Bought it? Record what it cost from {p.accountName}. Or stop saving for it.</Text>
          {cancelError && <ErrorAlert message={cancelError} />}
          <Button title="Mark as bought" onPress={() => openMarkBought(id)} />
          <Button title="Cancel it" variant="danger" onPress={confirmCancel} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 12, marginBottom: 8 },
  stat: { flexBasis: '46%', flexGrow: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  text: { fontSize: 14, lineHeight: 20 },
  payment: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10 },
  paid: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
