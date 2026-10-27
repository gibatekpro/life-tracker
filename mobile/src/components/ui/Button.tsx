import { Pressable, StyleSheet, Text } from 'react-native';

import { useTokens } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}

export default function Button({ title, onPress, variant = 'primary', disabled = false }: Props) {
  const t = useTokens();
  const colours = {
    primary: { background: t.accent, text: t.onAccent },
    secondary: { background: t.surfaceMuted, text: t.ink },
    danger: { background: t.negativeSoft, text: t.negative },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colours.background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.text, { color: colours.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  text: { fontSize: 16, fontWeight: '600' },
});
