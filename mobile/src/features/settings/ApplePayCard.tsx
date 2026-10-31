import { accountGroups, accountLabel, captureAccounts, type Account, type Settings } from '@lifetracker/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { setDefaultAccount } from '@/api';
import PickerButton from '@/components/PickerButton';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { useTokens } from '@/theme/tokens';
import ErrorAlert from '@/components/ErrorAlert';

const noDefault = 'No default (reject unmatched payments)';

// How Apple Pay payments find their account (web: the Apple Pay capture card in SettingsPage).
export default function ApplePayCard({ settings: s, accounts }: { settings: Settings | undefined; accounts: Account[] | undefined }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [error, setError] = useState<string | null>(null);

  async function changeDefault(accountId: number | null) {
    setError(null);
    try {
      await setDefaultAccount(accountId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const chosen = accounts?.find((a) => a.id === s?.defaultAccountId);
  const steps = ['An account with a matching Apple Pay name', 'An account whose name matches the card', 'Otherwise, the default account below'];

  return (
    <Card title="Apple Pay capture"
      description="An iOS Shortcut sends each Apple Pay payment here with the card's Wallet name, and it's recorded as an expense.">
      {steps.map((step, i) => (
        <View key={step} style={styles.step}><Badge tone="accent">{String(i + 1)}</Badge><Text style={[styles.text, { color: t.muted }]}>{step}</Text></View>
      ))}

      <Text style={[styles.label, { color: t.ink }]}>Default account</Text>
      {s && accounts ? (
        <PickerButton title="Default account" valueLabel={chosen ? accountLabel(chosen) : noDefault}
          choices={[{ label: noDefault, value: null as number | null },
            ...accountGroups(captureAccounts(accounts)).flatMap((g) => g.accounts).map((a) => ({ label: accountLabel(a), value: a.id as number | null }))]}
          onChange={changeDefault} />
      ) : <ActivityIndicator color={t.muted} />}
      <Text style={[styles.small, { color: t.muted }]}>Where a payment goes when no card name matches.</Text>
      {error && <ErrorAlert message={error} />}

      <Text style={[styles.label, { color: t.ink }]}>Card names set up</Text>
      {!accounts ? <ActivityIndicator color={t.muted} /> : (
        <View style={[styles.list, { borderColor: t.line }]}>
          {accounts.map((a, i) => (
            <Pressable key={a.id} onPress={() => router.push(`/accounts/${a.id}`)} accessibilityRole="link"
              style={({ pressed }) => [styles.row, i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }, pressed && { opacity: 0.6 }]}>
              <Text style={[styles.name, { color: t.ink }]}>{a.name}</Text>
              <View style={styles.aliases}>
                {a.aliases.length === 0
                  ? <Text style={[styles.small, { color: t.subtle }]}>Name only</Text>
                  : a.aliases.map((x) => <Badge key={x.id}>{x.alias}</Badge>)}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={[styles.small, { color: t.muted }]}>Add names on each account&apos;s page. Case and punctuation are ignored.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 14, flex: 1 },
  label: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  small: { fontSize: 12, lineHeight: 17 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  name: { fontSize: 14, fontWeight: '500' },
  aliases: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
