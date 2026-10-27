import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/theme/tokens';

// Stands in for a screen that hasn't been built yet.
export default function Placeholder({ children }: { children: string }) {
  const t = useTokens();
  return <Text style={[styles.text, { color: t.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22 },
});
