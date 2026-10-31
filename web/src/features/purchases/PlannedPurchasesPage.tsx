import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getPlannedPurchases } from '../../api';
import { purchaseGroups } from '@lifetracker/core';
import { useData } from '../../data/useData';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Alert, EmptyState, PageHeader, Skeleton } from '../../components/ui/Bits';
import PlannedPurchaseForm from './PlannedPurchaseForm';
import PurchaseCard from './PurchaseCard';

// Everything I'm saving towards (a visa fee, a laptop), each in its own savings account: how much is
// saved, whether it's on track and when it should be reached. Finished ones (bought, cancelled) below.
export default function PlannedPurchasesPage() {
  const purchases = useData('planned-purchases', getPlannedPurchases);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader title="Planned purchases" description="Save towards something each month, and see how it's going."
        actions={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add planned purchase</Button>} />

      {purchases.error && <Alert tone="negative" className="mb-6">{purchases.error}</Alert>}

      {!purchases.data ? <Skeleton className="h-48" /> : purchases.data.length === 0 ? (
        <Card>
          <EmptyState icon="gift" title="Nothing planned yet"
            action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Plan one</Button>}>
            Saving for a visa fee or a laptop? Set a target and a monthly amount, and it gets its own line in the budget.
          </EmptyState>
        </Card>
      ) : purchaseGroups(purchases.data).map((g) => (
        <section key={g.label} className="mb-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{g.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((p) => <PurchaseCard key={p.id} p={p} />)}
          </div>
        </section>
      ))}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a planned purchase"
        description="Its money builds up in a savings account, filled by transfers.">
        <PlannedPurchaseForm onDone={(created) => { setAdding(false); if (created) navigate(`/planned-purchases/${created.id}`); }} />
      </Modal>
    </>
  );
}
