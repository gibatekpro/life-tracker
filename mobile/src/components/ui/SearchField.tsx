import { SymbolView } from 'expo-symbols';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A search box with a magnifying glass and the iOS clear button.
export default function SearchField({ value, onChangeText, placeholder }: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const t = useTokens();
  return (
    <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.line }]}>
      <SymbolView name="magnifyingglass" size={15} tintColor={t.subtle} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.subtle}
        accessibilityLabel="Search" clearButtonMode="while-editing" returnKeyType="search" autoCorrect={false}
        style={[styles.input, { color: t.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, minHeight: 40 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
});
