import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// An amount with its currency symbol in front, typed on the decimal keypad.
// large: the main amount at the top of the form.
export default function MoneyInput({ symbol, value, onChangeText, placeholder = '0.00', large = false, autoFocus, ref, accessibilityLabel }: {
  symbol: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  large?: boolean;
  autoFocus?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  accessibilityLabel: string;
}) {
  const t = useTokens();
  const size = large ? styles.large : styles.normal;
  return (
    <View style={styles.row}>
      <Text style={[size, { color: t.muted }]}>{symbol}</Text>
      <TextInput
        ref={ref}
        value={value}
        // Some keyboards type a decimal comma; the API wants a point.
        onChangeText={(s) => onChangeText(s.replace(',', '.'))}
        placeholder={placeholder}
        placeholderTextColor={t.subtle}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={[size, styles.input, { color: t.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 },
  input: { flex: 1, paddingVertical: 8, fontVariant: ['tabular-nums'] },
  normal: { fontSize: 17 },
  large: { fontSize: 34, fontWeight: '600' },
});
