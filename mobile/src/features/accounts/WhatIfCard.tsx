import { currencySymbol, defaultWhatIfPayment, formatMoney, whatIfSummary, type Account } from '@lifetracker/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getWhatIf } from '@/api';
import { Field } from '@/components/form/Field';
import MoneyInput from '@/components/form/MoneyInput';
import Card from '@/components/ui/Card';
import { useData } from '@/data/useData';
import { useDebounce } from '@/hooks/useDebounce';
import { useTokens } from '@/theme/tokens';

// "What if I paid more on this one?" (web: WhatIfCard). Try a monthly payment and see the payoff
// date and interest change, compared with the payment I've planned.
export default function WhatIfCard({ debt }: { debt: Account }) {
  const t = useTokens();
  const [input, setInput] = useState(String(defaultWhatIfPayment(debt)));
  const payment = useDebounce(Math.max(0, Number(input) || 0));
  const result = useData(`whatif-${debt.id}-${payment}`, () => getWhatIf(debt.id, payment));
  const c = debt.currency;
  const r = result.data && whatIfSummary(result.data, payment, c);

  return (
    <Card title="What if I paid more?" description={`Currently paying ${formatMoney(debt.monthlyPayment, c)} a month.`}>
      <View style={[styles.input, { borderColor: t.line, backgroundColor: t.surfaceMuted }]}>
        <Field label="Monthly payment">
          <MoneyInput symbol={currencySymbol(c)} value={input} onChangeText={setInput} accessibilityLabel="What-if monthly payment" />
        </Field>
      </View>
      {!r ? <ActivityIndicator color={t.muted} /> : !r.clears ? (
        <Text style={[styles.text, { color: t.negative }]}>{r.message}</Text>
      ) : (
        <View style={styles.results}>
          <View style={styles.result}>
            <Text style={[styles.label, { color: t.muted }]}>Cleared</Text>
            <Text style={[styles.value, { color: t.ink }]}>{r.cleared}</Text>
            <Text style={[styles.label, { color: t.muted }]}>{r.months}</Text>
          </View>
          <View style={styles.result}>
            <Text style={[styles.label, { color: t.muted }]}>Interest</Text>
            <Text style={[styles.value, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit>{r.interest}</Text>
          </View>
          <View style={styles.result}>
            <Text style={[styles.label, { color: t.muted }]}>Compared with now</Text>
            <Text style={[styles.value, { color: r.better ? t.positive : t.ink }]}>{r.compared}</Text>
            {r.interestSaved && <Text style={[styles.label, { color: t.positive }]}>{r.interestSaved}</Text>}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginBottom: 4 },
  text: { fontSize: 14, lineHeight: 20 },
  results: { flexDirection: 'row', gap: 12 },
  result: { flex: 1, gap: 2 },
  label: { fontSize: 12 },
  value: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
