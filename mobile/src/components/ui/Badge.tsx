import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/theme/tokens';

export type Tone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';

// A small rounded label (web: Badge), e.g. "18.9% APR" or "Archived".
export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: string }) {
  const t = useTokens();
  const look = {
    neutral: [t.surfaceMuted, t.muted],
    accent: [t.accentSoft, t.accent],
    positive: [t.positiveSoft, t.positive],
    negative: [t.negativeSoft, t.negative],
    warning: [t.warningSoft, t.warning],
  }[tone];
  return <Text style={[styles.badge, { backgroundColor: look[0], color: look[1] }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: 12, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start' },
});
