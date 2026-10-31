import { Link } from 'react-router';
import { getPlannedPurchases } from '../../api';
import { homePurchases, purchaseFigures, purchaseStatus } from '@lifetracker/core';
import { useData } from '../../data/useData';
import Card from '../../components/ui/Card';
import { Badge, ProgressBar, Skeleton } from '../../components/ui/Bits';

// What I'm saving for, at a glance: up to three planned purchases with their progress. Nothing at all
// when there are none (Home stays as it was).
export default function PlannedPurchasesCard() {
  const purchases = useData('planned-purchases', getPlannedPurchases);
  if (purchases.error) return null;
  const home = purchases.data && homePurchases(purchases.data);
  if (purchases.data && !home) return null;

  return (
    <Card title="Planned purchases" description={home?.summary}
      action={<Link to="/planned-purchases" className="text-sm font-medium text-accent hover:underline">All</Link>}>
      {!home ? <Skeleton className="h-24" /> : (
        <ul className="grid gap-4">
          {home.items.map((p) => {
            const f = purchaseFigures(p);
            const status = purchaseStatus(p);
            return (
              <li key={p.id}>
                <Link to={`/planned-purchases/${p.id}`} className="block rounded-lg hover:bg-surface-muted">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{p.name}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <ProgressBar label={`${p.name} saved`} value={f.progress} tone={f.progressTone} />
                  <p className="mt-1 text-xs text-muted tabular-nums">{f.saved} · {f.target}</p>
                </Link>
              </li>
            );
          })}
          {home.more && <li className="text-xs text-muted">{home.more}</li>}
        </ul>
      )}
    </Card>
  );
}
