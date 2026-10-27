import { useState } from 'react';
import { archiveCategory, deleteCategory, getCategories, unarchiveCategory } from '../../api';
import type { Category, CategoryKind } from '@lifetracker/core';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import { buildTree, formatMoney } from '@lifetracker/core';
import { cn } from '../../lib/cn';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Alert, Badge, EmptyState, SegmentedControl, Skeleton } from '../../components/ui/Bits';
import CategoryForm from './CategoryForm';
import CollapsibleTree from '../../components/tree/CollapsibleTree';
import ExpandButton from '../../components/tree/ExpandButton';
import { useIsSmallScreen } from '../../hooks/useIsSmallScreen';

type Editing = { category: Category } | { parentId: number | null } | null;

const kinds: { value: CategoryKind; label: string }[] = [
  { value: 'Expense', label: 'Spending' },
  { value: 'Income', label: 'Income' },
];

// My categories, as a tree: add, add a subcategory, rename or move, set the default monthly
// budget, archive. Delete is only offered while nothing uses a category; otherwise archiving keeps
// its history (the API refuses to delete it too).
export default function CategoriesCard() {
  const categories = useData('categories', getCategories);
  const { refresh } = useRefresh();
  const [kind, setKind] = useState<CategoryKind>('Expense');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // On small screens only the top level shows until a category is opened.
  const small = useIsSmallScreen();

  const all = categories.data ?? [];
  const shown = all.filter((c) => c.kind === kind && (showArchived || !c.isArchived));
  const archivedCount = all.filter((c) => c.kind === kind && c.isArchived).length;

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card title="Categories" description="What spending and income are filed under. Spending categories can have a default monthly budget."
      action={<Button size="sm" icon="plus" onClick={() => setEditing({ parentId: null })}>Add</Button>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-56"><SegmentedControl label="Category kind" options={kinds} value={kind} onChange={(k) => { setKind(k); setConfirmDelete(null); }} /></div>
        {archivedCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-accent" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived ({archivedCount})
          </label>
        )}
      </div>

      {error && <Alert tone="negative" className="mb-4">{error}</Alert>}

      {!categories.data ? <Skeleton className="h-48" /> : shown.length === 0 ? (
        <EmptyState icon="tag" title="No categories yet" />
      ) : (
        <CollapsibleTree className="rounded-xl border border-line" page={`settings-categories-${kind}`} collapsible={small}
          nodes={buildTree(shown, (c) => c.id, (c) => c.parentId)}
          renderRow={({ item: c, children }, { depth, expandable, expanded, toggle, controls }) => {
            const unused = c.transactionCount === 0 && c.childCount === 0;
            const name = (
              <span className={cn('text-sm font-medium', c.isArchived && 'text-subtle')}>{c.name}</span>
            );
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pr-3"
                // Indent by depth, capped so a deep tree stays readable on a phone.
                style={{ paddingLeft: `${1 + Math.min(depth, 5) * 1.25}rem` }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {depth > 0 && !expandable && <span aria-hidden className="text-subtle">└</span>}
                    {expandable ? <ExpandButton expanded={expanded} controls={controls} onClick={toggle}>{name}</ExpandButton> : name}
                    {c.isArchived && <Badge>Archived</Badge>}
                  </div>
                  <p className="text-xs text-muted">
                    {kind === 'Expense' && (c.defaultMonthlyAmount !== null ? `${formatMoney(c.defaultMonthlyAmount)} a month` : 'No default budget')}
                    {kind === 'Expense' && ' · '}
                    {c.transactionCount} transaction{c.transactionCount === 1 ? '' : 's'}
                    {expandable && !expanded && ` · ${children.length} subcategor${children.length === 1 ? 'y' : 'ies'}`}
                  </p>
                </div>

                {confirmDelete === c.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Delete {c.name}?</span>
                    <Button size="sm" onClick={() => setConfirmDelete(null)}>Keep</Button>
                    <Button size="sm" variant="destructive" onClick={() => act(() => deleteCategory(c.id))}>Delete</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {!c.isArchived && (
                      <Button variant="ghost" size="sm" icon="plus" aria-label={`Add a subcategory to ${c.name}`}
                        onClick={() => setEditing({ parentId: c.id })} />
                    )}
                    <Button variant="ghost" size="sm" icon="pencil" aria-label={`Edit ${c.name}`}
                      onClick={() => setEditing({ category: c })} />
                    {c.isArchived ? (
                      <Button variant="ghost" size="sm" onClick={() => act(() => unarchiveCategory(c.id))}>Unarchive</Button>
                    ) : unused ? (
                      <Button variant="ghost" size="sm" icon="trash" aria-label={`Delete ${c.name}`} onClick={() => setConfirmDelete(c.id)} />
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => act(() => archiveCategory(c.id))}
                        title="It has transactions or subcategories, so it's archived rather than deleted">Archive</Button>
                    )}
                  </div>
                )}
              </div>
            );
          }} />
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)}
        title={editing && 'category' in editing ? `Edit ${editing.category.name}` : 'Add category'}
        description={editing && 'parentId' in editing && editing.parentId !== null
          ? `Inside ${all.find((c) => c.id === editing.parentId)?.path}` : undefined}>
        {editing && (
          <CategoryForm kind={kind} categories={all}
            category={'category' in editing ? editing.category : undefined}
            parentId={'parentId' in editing ? editing.parentId : undefined}
            onDone={() => setEditing(null)} />
        )}
      </Modal>
    </Card>
  );
}
