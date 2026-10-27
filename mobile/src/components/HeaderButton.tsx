import { Pressable, StyleSheet, Text } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A text button for a navigation bar (Cancel, Save). In the header, the keyboard can never cover it.
export default function HeaderButton({ title, onPress, disabled = false, primary = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} accessibilityRole="button"
      accessibilityState={{ disabled }} style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}>
      <Text style={[styles.text, { color: t.accent }, primary && styles.primary]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 17, paddingHorizontal: 4 },
  primary: { fontWeight: '600' },
});
