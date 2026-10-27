import Slider from '@react-native-community/slider';
import { extraOutcome, type AvalanchePlan } from '@lifetracker/core';
import { StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/form/Field';
import MoneyInput from '@/components/form/MoneyInput';
import Card from '@/components/ui/Card';
import { useTokens } from '@/theme/tokens';

// "What if I paid a bit more each month?" (web: ExtraSimulator): an amount, or the native slider
// (0 to £500 in £10 steps), compared with the plan without it.
export default function ExtraSimulator({ input, onInput, extra, baseline, plan }: {
  input: string;
  onInput: (value: string) => void;
  extra: number;
  baseline: AvalanchePlan;
  plan: AvalanchePlan;
}) {
  const t = useTokens();
  const outcome = extraOutcome(extra, baseline, plan);
  return (
    <Card title="Pay a bit more?" description="See what an extra amount each month would change.">
      <View style={[styles.input, { borderColor: t.line, backgroundColor: t.surfaceMuted }]}>
        <Field label="Extra per month">
          <MoneyInput symbol="£" value={input} onChangeText={onInput} accessibilityLabel="Extra per month" />
        </Field>
      </View>
      <Slider minimumValue={0} maximumValue={500} step={10} value={Math.min(500, Number(input) || 0)}
        onValueChange={(v) => onInput(String(v))} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.line}
        accessibilityLabel="Extra per month" />
      <View style={[styles.result, { backgroundColor: t.surfaceMuted }]}>
        <Text style={[outcome.sub ? styles.headline : styles.text, { color: outcome.tone === 'positive' ? t.positive : t.muted }]}>
          {outcome.headline}
        </Text>
        {outcome.sub && <Text style={[styles.text, { color: t.muted }]}>{outcome.sub}</Text>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  result: { borderRadius: 12, padding: 14, gap: 2 },
  headline: { fontSize: 18, fontWeight: '600' },
  text: { fontSize: 14, lineHeight: 20 },
});
