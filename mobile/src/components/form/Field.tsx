import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A labelled control inside a FormSection: a small caption above it and an optional hint below
// (web: Field).
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const t = useTokens();
  return (
    <View style={styles.field}>
      <Text style={[styles.caption, { color: t.muted }]}>{label}</Text>
      {children}
      {hint ? <Text style={[styles.hint, { color: t.muted }]}>{hint}</Text> : null}
    </View>
  );
}

// A plain text input styled for a FormSection.
export function TextField(props: ComponentProps<typeof TextInput>) {
  const t = useTokens();
  return <TextInput placeholderTextColor={t.subtle} {...props} style={[styles.input, { color: t.ink }, props.style]} />;
}

const styles = StyleSheet.create({
  field: { paddingBottom: 4 },
  caption: { fontSize: 13, fontWeight: '500', paddingTop: 10 },
  hint: { fontSize: 12, lineHeight: 16, paddingBottom: 8 },
  input: { fontSize: 17, paddingVertical: 10, minHeight: 44 },
});
