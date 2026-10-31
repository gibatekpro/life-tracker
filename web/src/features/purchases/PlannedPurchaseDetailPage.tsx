import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { cancelPlannedPurchase, getAccountPayments, getAccounts, getPlannedPurchase, getSettings } from '../../api';
import {
  addMoneyDraft, canChangePurchase, cancelPurchaseMessage, formatDate, formatMoney, formatYmLong, purchaseFigures, purchaseStatus,
} from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { Alert, Badge, EmptyState, ProgressBar, Skeleton, Stat } from '../../components/ui/Bits';
import { useQuickAdd } from '../transactions/quickAdd';
import BoughtForm from './BoughtForm';
import PlannedPurchaseForm from './PlannedPurchaseForm';

// One planned purchase in full: what's saved against the target, the plan, whether it's on track, and
// every contribution (transfers into its savings account). "Add money" opens the transaction form as a
// transfer from my default current account; it can also be edited, marked as bought or cancelled.
export default function PlannedPurchaseDetailPage() {
  const id = Number(useParams().id);
  const purchase = useData(`planned-purchase-${id}`, () => getPlannedPurchase(id));
  const p = purchase.data?.id === id ? purchase.data : undefined;
  const contributions = useData(`payments-${p?.accountId}`, () => getAccountPayments(p!.accountId), p !== undefined);
  const accounts = useData('accounts', getAccounts);
  const settings = useData('settings', getSettings);
  const openQuickAdd = useQuickAdd();
  const { refresh } = useRefresh();
  const [editing, setEditing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (purchase.error && !p) {
    return (
      <EmptyState icon="gift" title="Planned purchase not found"
        action={<Link to="/planned-purchases" className="text-accent">Back to planned purchases</Link>}>{purchase.error}</EmptyState>
    );
  }
  if (!p) return <Skeleton className="h-64" />;

  const f = purchaseFigures(p);
  const status = purchaseStatus(p);
  const open = canChangePurchase(p);

  async function cancel() {
    setCancelError(null);
    try {
      await cancelPlannedPurchase(id);
      setCancelling(false);
      refresh();
    } catch (err) {
      setCancelError((err as Error).message);
    }
  }

  return (
    <>
      <Link to="/planned-purchases" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="size-4" /> Planned purchases
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Icon name="gift" className="size-6" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            <div className="mt-1 flex gap-1.5">
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone={p.isEssential ? 'accent' : 'neutral'}>{p.isEssential ? 'Essential' : 'Want'}</Badge>
            </div>
          </div>
        </div>
        {open && (
          <div className="flex gap-2">
            <Button icon="pencil" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="primary" icon="plus"
              onClick={() => openQuickAdd(addMoneyDraft(p, accounts.data ?? [], settings.data?.defaultAccountId ?? null))}>
              Add money
            </Button>
          </div>
        )}
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat label="Saved" value={formatMoney(p.saved)} sub={`of ${formatMoney(p.targetAmount)} · ${f.percent}`} />
          <Stat label="Each month" value={formatMoney(p.monthlyAmount)} sub={`Started ${formatYmLong(p.startMonth)}`} />
          <Stat label="Last month to save" value={formatYmLong(p.targetMonth)} sub={f.left ?? undefined} />
          <Stat label="Expected" value={f.expected} valueClassName={cn(f.late && 'text-warning', p.status === 'Achieved' && 'text-positive')}
            sub={f.behind ?? (p.status === 'Active' ? 'At the pace so far' : undefined)} />
        </div>
        <div className="mt-6"><ProgressBar label={`${p.name} saved`} value={f.progress} tone={f.progressTone} /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Card title="Contributions" description={`Transfers into ${p.accountName}`}
            action={<Link to={`/accounts/${p.accountId}`} className="text-sm font-medium text-accent hover:underline">Account</Link>}>
            {!contributions.data ? <Skeleton className="h-24" /> : contributions.data.length === 0 ? (
              <EmptyState icon="gift" title="Nothing saved yet"
                action={open && <Button variant="primary" icon="plus"
                  onClick={() => openQuickAdd(addMoneyDraft(p, accounts.data ?? [], settings.data?.defaultAccountId ?? null))}>Add money</Button>}>
                Each transfer into {p.accountName} shows up here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {contributions.data.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="tabular-nums font-medium text-positive">{formatMoney(c.amount)}</p>
                      <p className="text-xs text-muted">from {c.fromAccountName}</p>
                    </div>
                    <span className="text-muted">{formatDate(c.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {p.notes && (
            <Card title="Notes"><p className="text-sm whitespace-pre-line">{p.notes}</p></Card>
          )}

          {open && (
            <Card title="Finish">
              <p className="mb-4 text-sm text-muted">Bought it? Record what it cost from {p.accountName}. Or stop saving for it.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" icon="check" onClick={() => setBuying(true)}>Mark as bought</Button>
                <Button variant="danger" icon="x" onClick={() => setCancelling(true)}>Cancel it</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${p.name}`}>
        <PlannedPurchaseForm purchase={p} onDone={() => setEditing(false)} />
      </Modal>

      <Modal open={buying} onClose={() => setBuying(false)} title={`Mark ${p.name} as bought`}>
        <BoughtForm purchase={p} onDone={() => setBuying(false)} />
      </Modal>

      <Modal open={cancelling} onClose={() => { setCancelling(false); setCancelError(null); }} title={`Cancel ${p.name}?`}
        description={cancelPurchaseMessage(p)}>
        {cancelError && <Alert tone="negative" className="mb-4">{cancelError}</Alert>}
        <div className="flex justify-end gap-2">
          <Button onClick={() => setCancelling(false)}>Keep saving</Button>
          <Button variant="destructive" onClick={cancel}>Cancel it</Button>
        </div>
      </Modal>
    </>
  );
}
