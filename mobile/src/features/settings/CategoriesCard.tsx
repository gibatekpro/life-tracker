import {
  archivedCount as countArchived, buildTree, categoryNote, categoryRemoval, visibleCategories, type Category, type CategoryKind,
} from '@lifetracker/core';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert as NativeAlert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { archiveCategory, deleteCategory, getCategories, unarchiveCategory } from '@/api';
import { useChooser } from '@/components/form/useChooser';
import CollapsibleTree from '@/components/tree/CollapsibleTree';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Segmented from '@/components/ui/Segmented';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';
import ErrorAlert from '@/components/ErrorAlert';

const kinds: { value: CategoryKind; label: string }[] = [
  { value: 'Expense', label: 'Spending' },
  { value: 'Income', label: 'Income' },
];

const openForm = (kind: CategoryKind, params: { id?: number; parentId?: number }) =>
  router.push({ pathname: '/category-form', params: { kind, ...(params.id ? { id: String(params.id) } : {}), ...(params.parentId ? { parentId: String(params.parentId) } : {}) } });

// My categories as a tree (web: CategoriesCard): add, add a subcategory, rename or move, set the default
// monthly budget, archive. Delete is only offered while nothing uses a category; otherwise archiving keeps
// its history (the API refuses to delete it too, with a 409 whose message is shown). A row's actions are
// in an action sheet behind "…", where the web shows them as buttons on the row.
export default function CategoriesCard() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const choose = useChooser();
  const categories = useData('categories', getCategories);
  const [kind, setKind] = useState<CategoryKind>('Expense');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = categories.data ?? [];
  const shown = visibleCategories(all, kind, showArchived);
  const archived = countArchived(all, kind);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function actions(c: Category) {
    const removal = categoryRemoval(c);
    const choices: { label: string; value: () => void }[] = [
      ...(!c.isArchived ? [{ label: 'Add a subcategory', value: () => openForm(kind, { parentId: c.id }) }] : []),
      { label: 'Edit', value: () => openForm(kind, { id: c.id }) },
      removal === 'unarchive' ? { label: 'Unarchive', value: () => act(() => unarchiveCategory(c.id)) }
        : removal === 'archive' ? { label: 'Archive', value: () => act(() => archiveCategory(c.id)) }
        : {
          label: 'Delete', value: () => NativeAlert.alert(`Delete ${c.name}?`, undefined, [
            { text: 'Keep', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => act(() => deleteCategory(c.id)) },
          ]),
        },
    ];
    choose(c.name, choices, (run) => run(), {
      message: removal === 'archive' ? "It has transactions or subcategories, so it's archived rather than deleted." : undefined,
      destructive: removal === 'delete' ? choices.length - 1 : undefined,
    });
  }

  return (
    <Card title="Categories" description="What spending and income are filed under. Spending categories can have a default monthly budget."
      action={{ label: 'Add', onPress: () => openForm(kind, {}) }}>
      <Segmented label="Category kind" options={kinds} value={kind} onChange={setKind} />
      {archived > 0 && (
        <View style={styles.archived}>
          <Text style={[styles.text, { color: t.muted }]}>Show archived ({archived})</Text>
          <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: t.accent }} accessibilityLabel={`Show archived (${archived})`} />
        </View>
      )}
      {error && <ErrorAlert message={error} />}

      {!categories.data ? <ActivityIndicator color={t.muted} /> : shown.length === 0 ? (
        <EmptyState icon="tag" title="No categories yet" />
      ) : (
        <View style={[styles.tree, { borderColor: t.line }]}>
          <CollapsibleTree page={`settings-categories-${kind}`} nodes={buildTree(shown, (c) => c.id, (c) => c.parentId)}
            renderRow={({ item: c, children }, { depth, expandable, expanded, toggle }) => (
              <View style={[styles.row, { paddingLeft: 12 + Math.min(depth, 5) * 16 }]}>
                <View style={styles.body}>
                  <View style={styles.title}>
                    {depth > 0 && !expandable && <Text style={{ color: t.subtle }}>└</Text>}
                    {expandable ? (
                      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle}>
                        <SymbolView name={expanded ? 'chevron.down' : 'chevron.right'} size={11} tintColor={t.muted} />
                        <Text style={[styles.name, { color: c.isArchived ? t.subtle : t.ink }]}>{c.name}</Text>
                      </Pressable>
                    ) : <Text style={[styles.name, { color: c.isArchived ? t.subtle : t.ink }]}>{c.name}</Text>}
                    {c.isArchived && <Badge>Archived</Badge>}
                  </View>
                  <Text style={[styles.note, { color: t.muted }]}>{categoryNote(c, expandable && !expanded ? children.length : undefined)}</Text>
                </View>
                <Pressable onPress={() => actions(c)} accessibilityRole="button" accessibilityLabel={`Actions for ${c.name}`} hitSlop={10} style={styles.more}>
                  <SymbolView name="ellipsis.circle" size={22} tintColor={t.accent} />
                </Pressable>
              </View>
            )} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  archived: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 14 },
  tree: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingRight: 12 },
  body: { flex: 1, gap: 2 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '500' },
  note: { fontSize: 12 },
  more: { padding: 4 },
});
