import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// "‹  28 Sept – 27 Oct 2026  ›": stepping through budget months.
export default function MonthNav({ label, onPrevious, onNext, previousDisabled = false, nextDisabled = false }: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  const t = useTokens();
  const arrow = (name: 'chevron.left' | 'chevron.right', a11y: string, onPress: () => void, disabled: boolean) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y}
      accessibilityState={{ disabled }} hitSlop={10} style={({ pressed }) => [styles.arrow, { opacity: disabled ? 0.3 : pressed ? 0.5 : 1 }]}>
      <SymbolView name={name} size={18} tintColor={t.accent} />
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {arrow('chevron.left', 'Previous month', onPrevious, previousDisabled)}
      <Text style={[styles.label, { color: t.ink }]} accessibilityRole="header">{label}</Text>
      {arrow('chevron.right', 'Next month', onNext, nextDisabled)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { padding: 8 },
  label: { fontSize: 18, fontWeight: '600', textAlign: 'center', flex: 1 },
});
