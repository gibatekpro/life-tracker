import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useChooser, type Choice } from './form/useChooser';
import { useTokens } from '@/theme/tokens';

// A compact dropdown outside a form (e.g. a list's account filter): the current choice and a
// chevron; tapping lists the choices in an action sheet. `title` names it for the sheet and VoiceOver.
export default function PickerButton<T>({ title, valueLabel, choices, onChange }: {
  title: string;
  valueLabel: string;
  choices: Choice<T>[];
  onChange: (value: T) => void;
}) {
  const t = useTokens();
  const choose = useChooser();
  return (
    <Pressable onPress={() => choose(title, choices, onChange)} accessibilityRole="button" accessibilityLabel={`${title}: ${valueLabel}`}
      style={({ pressed }) => [styles.button, { backgroundColor: t.surface, borderColor: t.line }, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.text, { color: t.ink }]} numberOfLines={1}>{valueLabel}</Text>
      <SymbolView name="chevron.up.chevron.down" size={13} tintColor={t.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, minHeight: 40 },
  text: { flex: 1, fontSize: 15 },
});
