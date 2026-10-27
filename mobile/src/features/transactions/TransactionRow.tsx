import { formatMoney, showsPoundsValue, type Transaction } from '@lifetracker/core';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens, type Tokens } from '@/theme/tokens';
import { openTransactionToEdit } from './open';

const look: Record<Transaction['type'], { icon: SFSymbol; circle: keyof Tokens; colour: keyof Tokens }> = {
  Expense: { icon: 'arrow.up.right', circle: 'surfaceMuted', colour: 'muted' },
  Income: { icon: 'arrow.down.left', circle: 'accentSoft', colour: 'positive' },
  Transfer: { icon: 'arrow.left.arrow.right', circle: 'accentSoft', colour: 'accent' },
};

// One transaction in a list, as on the web: what it was, where the money went and how much.
// Spending shows as −£, money in as +£ (green), transfers neutrally (they aren't spending).
// When neither side is in pounds, its £ value shows underneath. Tapping it opens it to edit.
export default function TransactionRow({ t }: { t: Transaction }) {
  const tokens = useTokens();
  const { icon, circle, colour } = look[t.type];
  const sign = t.type === 'Income' ? '+' : t.type === 'Expense' ? '−' : '';

  return (
    <Pressable
      onPress={() => openTransactionToEdit(t.id)}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${t.description || 'transaction'}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? tokens.surfaceMuted : tokens.surface }]}
    >
      <View style={[styles.circle, { backgroundColor: tokens[circle] }]}>
        <SymbolView name={icon} size={15} tintColor={tokens[colour]} />
      </View>
      <View style={styles.middle}>
        <Text style={[styles.title, { color: tokens.ink }]} numberOfLines={1}>{t.description || '—'}</Text>
        <Text style={[styles.sub, { color: tokens.muted }]} numberOfLines={1}>
          {t.type === 'Transfer' ? `${t.accountName} → ${t.toAccountName}` : `${t.category} · ${t.accountName}`}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, {
          color: t.type === 'Income' ? tokens.positive : t.type === 'Transfer' ? tokens.muted : tokens.ink,
        }]}>
          {sign}{formatMoney(t.amount, t.currency)}
          {t.toAmount !== null && t.toCurrency ? ` → ${formatMoney(t.toAmount, t.toCurrency)}` : ''}
        </Text>
        {showsPoundsValue(t) && <Text style={[styles.sub, { color: tokens.muted }]}>≈ {formatMoney(t.gbpAmount)}</Text>}
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={tokens.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '500' },
  sub: { fontSize: 13 },
  right: { alignItems: 'flex-end', gap: 2, maxWidth: '50%' },
  amount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'], textAlign: 'right' },
});
