import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// An amount with its currency symbol in front (or a suffix such as "%"), typed on the decimal keypad.
// large: the main amount at the top of the form. allowNegative: the decimal keypad has no minus key,
// so an amount that can go below zero (an overdrawn balance) uses the keyboard with punctuation.
export default function MoneyInput({
  symbol, suffix, value, onChangeText, placeholder = '0.00', large = false, allowNegative = false, autoFocus, ref, accessibilityLabel,
}: {
  symbol: string;
  suffix?: string;
  allowNegative?: boolean;
  // Only in a modal: in a tab, which is mounted before it's shown, focusing makes iOS switch to that tab.
  autoFocus?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  large?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  accessibilityLabel: string;
}) {
  const t = useTokens();
  const size = large ? styles.large : styles.normal;
  return (
    <View style={styles.row}>
      {symbol ? <Text style={[size, { color: t.muted }]}>{symbol}</Text> : null}
      <TextInput
        ref={ref}
        value={value}
        // Some keyboards type a decimal comma; the API wants a point.
        onChangeText={(s) => onChangeText(s.replace(',', '.'))}
        placeholder={placeholder}
        placeholderTextColor={t.subtle}
        keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={[size, styles.input, { color: t.ink }]}
      />
      {suffix ? <Text style={[size, { color: t.subtle }]}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 },
  input: { flex: 1, paddingVertical: 8, fontVariant: ['tabular-nums'] },
  normal: { fontSize: 17 },
  large: { fontSize: 34, fontWeight: '600' },
});
