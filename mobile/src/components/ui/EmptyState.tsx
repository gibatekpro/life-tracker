import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// Nothing to show yet: an icon, a title, a line of help and an optional action (web: EmptyState).
export default function EmptyState({ icon, title, children, action }: {
  icon: SFSymbol;
  title: string;
  children?: string;
  action?: ReactNode;
}) {
  const t = useTokens();
  return (
    <View style={styles.box}>
      <View style={[styles.circle, { backgroundColor: t.surfaceMuted }]}>
        <SymbolView name={icon} size={20} tintColor={t.muted} />
      </View>
      <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
      {children ? <Text style={[styles.text, { color: t.muted }]}>{children}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4, maxWidth: 320 },
  action: { marginTop: 16, alignSelf: 'stretch' },
});
