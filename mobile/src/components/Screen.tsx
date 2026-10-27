import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';

import ScreenHeader from './ScreenHeader';
import { useTokens } from '@/theme/tokens';

interface Props {
  // A tab's large title; leave it out on a pushed screen, whose native header shows the title.
  title?: string;
  description?: string;
  children?: ReactNode;
  // Pass both to get pull-to-refresh.
  refreshing?: boolean;
  onRefresh?: () => void;
  // Shows a "+" that opens a new transaction.
  onAdd?: () => void;
}

// A page: its header (web: PageHeader), then the content, scrolling.
// contentInsetAdjustmentBehavior="automatic" lets iOS keep the content clear of the status bar,
// the navigation bar and the tab bar; automaticallyAdjustKeyboardInsets keeps a focused input in view.
export default function Screen({ title, description, children, refreshing = false, onRefresh, onAdd }: Props) {
  const t = useTokens();

  return (
    <ScrollView
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={onRefresh && <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.muted} />}
    >
      {title
        ? <ScreenHeader title={title} description={description} onAdd={onAdd} />
        : description ? <Text style={[styles.description, { color: t.muted }]}>{description}</Text> : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  description: { fontSize: 15, lineHeight: 20 },
});
