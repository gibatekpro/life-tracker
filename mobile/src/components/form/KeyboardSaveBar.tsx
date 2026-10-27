import { InputAccessoryView, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A bar attached to the top of the keyboard with Done and a form's Save, for inline forms whose Save
// button would otherwise sit under the keyboard (React Native's InputAccessoryView, iOS). An input
// shows it by passing the same id as inputAccessoryViewID.
export default function KeyboardSaveBar({ id, label, onSave, disabled = false }: {
  id: string;
  label: string;
  onSave: () => void;
  disabled?: boolean;
}) {
  const t = useTokens();
  return (
    <InputAccessoryView nativeID={id}>
      <View style={[styles.bar, { backgroundColor: t.surface, borderTopColor: t.line }]}>
        <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.text, { color: t.muted }]}>Done</Text>
        </Pressable>
        <Pressable onPress={() => { Keyboard.dismiss(); onSave(); }} disabled={disabled} accessibilityRole="button" hitSlop={8}
          style={{ opacity: disabled ? 0.4 : 1 }}>
          <Text style={[styles.text, styles.save, { color: t.accent }]}>{label}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  text: { fontSize: 16 },
  save: { fontWeight: '600' },
});
