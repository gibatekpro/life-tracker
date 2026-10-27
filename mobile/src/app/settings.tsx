import { ScrollView, StyleSheet } from 'react-native';

import Placeholder from '@/components/Placeholder';
import { useTokens } from '@/theme/tokens';

// Pushed over the tabs from the gear button; the stack gives it a native header.
export default function SettingsScreen() {
  const t = useTokens();
  return (
    <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Placeholder>Settings will show here.</Placeholder>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
