import { useState } from 'react';
import { askPurchaseAdvice, getPurchaseAdvice } from '../../api';
import type { PlannedPurchase, PurchaseAdvice } from '@lifetracker/core';
import { adviceSentNote, askAdviceLabel, askingAdviceNote, canChangePurchase } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Alert, Skeleton } from '../../components/ui/Bits';
import OpenAIError from '../insights/OpenAIError';
import AdviceView from './AdviceView';

// "Is this a good idea, and what's a reasonable monthly amount?": the latest advice for a planned
// purchase, and a button to ask (my API asks OpenAI; the browser never does). onUse: "Use this amount".
export default function AdviceCard({ purchase: p, onUse }: { purchase: PlannedPurchase; onUse: (advice: PurchaseAdvice) => void }) {
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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Card title="Advice" description="Is it a good idea, and what's a reasonable monthly amount?"
      action={open && <Button size="sm" variant={latest ? 'secondary' : 'primary'} icon="sparkles" disabled={asking} onClick={ask}>
        {askAdviceLabel(asking, latest !== undefined)}
      </Button>}>
      {error && <Alert tone="negative" className="mb-4"><OpenAIError error={error} /></Alert>}
      {asking && <Alert className="mb-4">{askingAdviceNote(p.name)}</Alert>}
      {advice.error && <Alert tone="negative">{advice.error}</Alert>}
      {!advice.data ? <Skeleton className="h-24" /> : latest ? (
        <AdviceView advice={latest} onUse={open ? () => onUse(latest) : undefined} />
      ) : (
        <p className="text-sm text-muted">{adviceSentNote}</p>
      )}
      {advice.data && advice.data.length > 1 && (
        <p className="mt-3 text-xs text-muted">Showing the latest of {advice.data.length} answers.</p>
      )}
    </Card>
  );
}
