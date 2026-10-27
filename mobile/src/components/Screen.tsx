import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import ScreenHeader from './ScreenHeader';
import { useTokens } from '@/theme/tokens';

interface Props {
  title: string;
  children?: ReactNode;
  // Pass both to get pull-to-refresh.
  refreshing?: boolean;
  onRefresh?: () => void;
  // Shows a "+" beside Settings.
  onAdd?: () => void;
}

// A tab's page: a large title with its buttons (ScreenHeader), then the content, scrolling.
// contentInsetAdjustmentBehavior="automatic" lets iOS keep the content clear of the
// status bar and the tab bar, which content scrolls underneath.
export default function Screen({ title, children, refreshing = false, onRefresh, onAdd }: Props) {
  const t = useTokens();

  return (
    <ScrollView
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh && <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.muted} />}
    >
      <ScreenHeader title={title} onAdd={onAdd} />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
