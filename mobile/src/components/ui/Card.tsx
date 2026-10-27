import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTokens } from '@/theme/tokens';

// The panel everything sits in (web: Card). A title, description and action (e.g. "View all")
// are optional.
export default function Card({ title, description, action, children, style }: {
  title?: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }, style]}>
      {(title || action) && (
        <View style={styles.header}>
          <View style={styles.titles}>
            {title ? <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">{title}</Text> : null}
            {description ? <Text style={[styles.description, { color: t.muted }]}>{description}</Text> : null}
          </View>
          {action && (
            <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={10}>
              <Text style={[styles.action, { color: t.accent }]}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 19 },
  action: { fontSize: 15, fontWeight: '500' },
});
