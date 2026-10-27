import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// One row of a FormSection: a label on the left and the value or control on the right.
// With onPress the whole row is a button (e.g. it opens a list to choose from).
export default function FormRow({ label, children, onPress, accessibilityLabel }: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = useTokens();
  const content = (
    <>
      <Text style={[styles.label, { color: t.ink }]}>{label}</Text>
      <View style={styles.value}>{children}</View>
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  label: { fontSize: 16 },
  value: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
});
