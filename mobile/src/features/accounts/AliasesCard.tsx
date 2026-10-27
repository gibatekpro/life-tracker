import type { Account } from '@lifetracker/core';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addAlias, removeAlias } from '@/api';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { useTokens } from '@/theme/tokens';
import ErrorAlert from '@/components/ErrorAlert';

// The names Apple Pay might send for this card, e.g. "Lloyd's" for "Lloyds Current" (web: AliasesCard).
// Capture matches them ignoring case and punctuation; anything unmatched goes to the default account.
export default function AliasesCard({ account }: { account: Account }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      await addAlias(account.id, alias.trim());
      setAlias('');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(aliasId: number) {
    setError(null);
    try {
      await removeAlias(account.id, aliasId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card title="Apple Pay names" description={`Wallet card names that should land in this account. “${account.name}” already matches.`}>
      {account.aliases.length > 0 && (
        <View style={styles.chips}>
          {account.aliases.map((a) => (
            <View key={a.id} style={[styles.chip, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[styles.chipText, { color: t.ink }]}>{a.alias}</Text>
              <Pressable onPress={() => remove(a.id)} accessibilityRole="button" accessibilityLabel={`Remove ${a.alias}`} hitSlop={10}>
                <SymbolView name="xmark.circle.fill" size={18} tintColor={t.subtle} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <TextInput value={alias} onChangeText={setAlias} placeholder="e.g. Lloyd's" placeholderTextColor={t.subtle} maxLength={100}
          accessibilityLabel="New Apple Pay name" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => alias.trim() !== '' && add()}
          style={[styles.input, { color: t.ink, backgroundColor: t.surfaceMuted, borderColor: t.line }]} />
        <Button title="Add" variant="secondary" onPress={add} disabled={alias.trim() === ''} />
      </View>
      {error && <ErrorAlert message={error} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  chipText: { fontSize: 14 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, fontSize: 16, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, minHeight: 44 },
});
