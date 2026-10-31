import { adviceSentNote, askAdviceLabel, askingAdviceNote, canChangePurchase, type PlannedPurchase } from '@lifetracker/core';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { askPurchaseAdvice, getPurchaseAdvice } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import OpenAIErrorAlert from '@/features/insights/OpenAIErrorAlert';
import { useTokens } from '@/theme/tokens';
import AdviceView from './AdviceView';
import { openPurchaseForm } from './open';

// "Is this a good idea, and what's a reasonable monthly amount?" (web: AdviceCard): the latest advice
// for a planned purchase and a button to ask. My API asks OpenAI; the phone never does.
export default function AdviceCard({ purchase: p }: { purchase: PlannedPurchase }) {
  const t = useTokens();
  const advice = useData(`advice-${p.id}`, () => getPurchaseAdvice(p.id));
  const { refresh } = useRefresh();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = advice.data?.[0];
  const open = canChangePurchase(p);

  async function ask() {
    setAsking(true);
    setError(null);
    try {
      await askPurchaseAdvice({ plannedPurchaseId: p.id });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Card title="Advice" description="Is it a good idea, and what's a reasonable monthly amount?">
      {open && <Button title={askAdviceLabel(asking, latest !== undefined)} variant={latest ? 'secondary' : 'primary'} disabled={asking} onPress={ask} />}
      {error && <OpenAIErrorAlert error={error} />}
      {asking && <Alert>{askingAdviceNote(p.name)}</Alert>}
      {advice.error && <ErrorCard message={advice.error} status={advice.errorStatus} />}
      {!advice.data ? (!advice.error && <ActivityIndicator color={t.muted} />) : latest ? (
        <AdviceView advice={latest} onUse={open ? () => openPurchaseForm(p.id, latest.result.suggestedMonthlyAmount) : undefined} />
      ) : (
        <Text style={[styles.small, { color: t.muted }]}>{adviceSentNote}</Text>
      )}
      {advice.data && advice.data.length > 1 && (
        <Text style={[styles.small, { color: t.muted }]}>Showing the latest of {advice.data.length} answers.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
});
