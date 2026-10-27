import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

interface Props {
  label: string;
  value: string;
  caption?: string;
  tone?: 'ink' | 'positive' | 'negative';
  large?: boolean;
}

// A labelled figure: "Safe to spend / £24.50 a day".
export default function Stat({ label, value, caption, tone = 'ink', large = false }: Props) {
  const t = useTokens();
  return (
    <View style={styles.stat}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <Text style={[large ? styles.large : styles.value, { color: t[tone] }]}>{value}</Text>
      {caption && <Text style={[styles.caption, { color: t.muted }]}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, gap: 2 },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] },
  large: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13 },
});
