import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

interface Props {
  title: string;
  children?: ReactNode;
  // Pass both to get pull-to-refresh.
  refreshing?: boolean;
  onRefresh?: () => void;
}

// A tab's page: a large title with a Settings button, then the content, scrolling.
// contentInsetAdjustmentBehavior="automatic" lets iOS keep the content clear of the
// status bar and the tab bar, which content scrolls underneath.
export default function Screen({ title, children, refreshing = false, onRefresh }: Props) {
  const t = useTokens();

  return (
    <ScrollView
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh && <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.muted} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">{title}</Text>
        <Link href="/settings" asChild>
          <Pressable accessibilityLabel="Settings" hitSlop={12}>
            <SymbolView name="gearshape" size={24} tintColor={t.muted} />
          </Pressable>
        </Link>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '700' },
});
