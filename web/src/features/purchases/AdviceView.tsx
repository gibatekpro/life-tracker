import { useId, useState } from 'react';
import type { PurchaseAdvice } from '@lifetracker/core';
import { adviceDisclaimer, adviceFooter, adviceSuggestion, verdictLabel } from '@lifetracker/core';
import Button from '../../components/ui/Button';
import ExpandButton from '../../components/tree/ExpandButton';
import { Badge } from '../../components/ui/Bits';

// One piece of advice: the verdict, a reasonable monthly amount, the reasoning, risks and alternatives,
// where it came from, and exactly what was sent. onUse offers "Use this amount".
export default function AdviceView({ advice: a, onUse }: { advice: PurchaseAdvice; onUse?: () => void }) {
  const promptId = useId();
  const [showPrompt, setShowPrompt] = useState(false);
  const verdict = verdictLabel[a.result.verdict];
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={verdict.tone}>{verdict.label}</Badge>
          <span className="font-medium tabular-nums">{adviceSuggestion(a)}</span>
        </div>
        {onUse && <Button size="sm" onClick={onUse}>Use this amount</Button>}
      </div>
      <p className="leading-relaxed whitespace-pre-line">{a.result.reasoning}</p>
      {a.result.risks.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Risks</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">{a.result.risks.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {a.result.alternatives.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Alternatives</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">{a.result.alternatives.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted">{adviceDisclaimer} {adviceFooter(a)}.</p>
      <div className="border-t border-line pt-3">
        <ExpandButton expanded={showPrompt} controls={promptId} onClick={() => setShowPrompt((s) => !s)} className="font-medium">
          What was sent
        </ExpandButton>
        {showPrompt && (
          <pre id={promptId} className="mt-2 max-h-96 overflow-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {a.promptSent}
          </pre>
        )}
      </div>
    </div>
  );
}
