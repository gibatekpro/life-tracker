import { Link } from 'react-router';
import type { PlannedPurchase } from '@lifetracker/core';
import { purchaseFigures, purchaseStatus } from '@lifetracker/core';
import { cn } from '../../lib/cn';
import Icon from '../../components/ui/Icon';
import { Badge, ProgressBar } from '../../components/ui/Bits';

// One planned purchase as a tile: saved of target with a progress bar, the monthly amount, on track
// or behind, and when it should be reached. The words and figures are core's (plannedPurchases.ts).
export default function PurchaseCard({ p }: { p: PlannedPurchase }) {
  const f = purchaseFigures(p);
  const status = purchaseStatus(p);
  return (
    <Link to={`/planned-purchases/${p.id}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon name="gift" className="size-4" /></div>
          <p className="truncate font-semibold">{p.name}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {p.isEssential && <Badge tone="accent">Essential</Badge>}
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
        <span className="tabular-nums font-medium">{f.saved}</span>
        <span className="text-muted tabular-nums">{f.percent}</span>
      </div>
      <div className="mt-2"><ProgressBar label={`${p.name} saved`} value={f.progress} tone={f.progressTone} /></div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted">Each month</dt><dd className="tabular-nums">{f.monthly}</dd></div>
        <div><dt className="text-xs text-muted">{f.target}</dt><dd className={cn(f.late && 'text-warning')}>{f.finish}</dd></div>
      </dl>
      {(f.behind ?? f.left) && <p className={cn('mt-3 text-xs', f.behind ? 'text-warning' : 'text-muted')}>{f.behind ?? f.left}</p>}
    </Link>
  );
}
