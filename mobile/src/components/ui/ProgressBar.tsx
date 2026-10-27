import { StyleSheet, View } from 'react-native';

import type { Tone } from './Badge';
import { useTokens } from '@/theme/tokens';

// How far along something is, 0 to 1 (web: ProgressBar).
export default function ProgressBar({ value, tone = 'accent', label }: { value: number; tone?: Tone; label: string }) {
  const t = useTokens();
  const fill = { neutral: t.subtle, accent: t.accent, positive: t.positive, negative: t.negative, warning: t.warning }[tone];
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.track, { backgroundColor: t.surfaceMuted }]}>
      <View style={[styles.fill, { backgroundColor: fill, width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
