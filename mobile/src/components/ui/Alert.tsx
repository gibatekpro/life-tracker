import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTokens } from '@/theme/tokens';

type Tone = 'info' | 'warning' | 'negative';

// A message box, as the web's Alert: info (neutral), warning or negative (errors).
// Children that are strings are wrapped in Text; pass Text yourself for mixed content.
export default function Alert({ tone = 'info', children, style }: {
  tone?: Tone;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const look = {
    info: { box: t.surfaceMuted, border: t.line, icon: t.muted, symbol: 'info.circle' as const },
    warning: { box: t.warningSoft, border: t.warningSoft, icon: t.warning, symbol: 'exclamationmark.triangle' as const },
    negative: { box: t.negativeSoft, border: t.negativeSoft, icon: t.negative, symbol: 'exclamationmark.triangle' as const },
  }[tone];
  return (
    <View accessibilityRole={tone === 'negative' ? 'alert' : 'text'}
      style={[styles.box, { backgroundColor: look.box, borderColor: look.border }, style]}>
      <SymbolView name={look.symbol} size={16} tintColor={look.icon} style={styles.icon} />
      <View style={styles.body}>
        {typeof children === 'string' ? <Text style={[styles.text, { color: t.ink }]}>{children}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12 },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 6 },
  text: { fontSize: 14, lineHeight: 20 },
});
