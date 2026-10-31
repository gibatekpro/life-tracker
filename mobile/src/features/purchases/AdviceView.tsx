import { adviceDisclaimer, adviceFooter, adviceSuggestion, verdictLabel, type PurchaseAdvice } from '@lifetracker/core';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useTokens } from '@/theme/tokens';

// One piece of advice (web: AdviceView): the verdict, a reasonable monthly amount, the reasoning, risks
// and alternatives, where it came from, and exactly what was sent. onUse offers "Use this amount".
export default function AdviceView({ advice: a, onUse }: { advice: PurchaseAdvice; onUse?: () => void }) {
  const t = useTokens();
  const [showPrompt, setShowPrompt] = useState(false);
  const verdict = verdictLabel[a.result.verdict];
  const list = (title: string, items: string[]) => items.length > 0 && (
    <View style={styles.group}>
      <Text style={[styles.strong, { color: t.ink }]}>{title}</Text>
      {items.map((item) => <Text key={item} style={[styles.text, { color: t.muted }]}>•  {item}</Text>)}
    </View>
  );

  return (
    <View style={styles.box}>
      <View style={styles.top}>
        <Badge tone={verdict.tone}>{verdict.label}</Badge>
        <Text style={[styles.strong, { color: t.ink }]}>{adviceSuggestion(a)}</Text>
      </View>
      {onUse && <Button title="Use this amount" variant="secondary" onPress={onUse} />}
      <Text style={[styles.text, { color: t.ink }]}>{a.result.reasoning}</Text>
      {list('Risks', a.result.risks)}
      {list('Alternatives', a.result.alternatives)}
      <Text style={[styles.small, { color: t.muted }]}>{adviceDisclaimer} {adviceFooter(a)}.</Text>
      <View style={[styles.prompt, { borderTopColor: t.line }]}>
        <Pressable onPress={() => setShowPrompt((s) => !s)} accessibilityRole="button" accessibilityState={{ expanded: showPrompt }} style={styles.toggle}>
          <SymbolView name={showPrompt ? 'chevron.down' : 'chevron.right'} size={11} tintColor={t.ink} />
          <Text style={[styles.strong, { color: t.ink }]}>What was sent</Text>
        </Pressable>
        {showPrompt && (
          <Text selectable style={[styles.sent, { color: t.ink, backgroundColor: t.surface, borderColor: t.line }]}>{a.promptSent}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  group: { gap: 4 },
  strong: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  text: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 17 },
  prompt: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sent: { fontFamily: 'Menlo', fontSize: 11, lineHeight: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10 },
});
