import type { Category, CategoryKind } from '../../types';
import { Select } from '../../components/ui/Field';

// A category picker for small screens, one level at a time: choose a top-level category, then
// (if it has subcategories) a second dropdown appears for them, and so on. Each deeper dropdown
// starts with "{parent} itself", since spending can be filed on a parent too.
// The first dropdown takes `id`, so the form's label points at it.
export default function CascadingCategoryPicker({ id, categories, kind, value, onChange }: {
  id: string;
  categories: Category[];
  kind: CategoryKind;
  value: number | undefined;
  onChange: (categoryId: number) => void;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  // The chosen category and its parents, from the top: [Subscriptions, AI, Claude].
  const chain: Category[] = [];
  for (let c = value !== undefined ? byId.get(value) : undefined; c; c = c.parentId !== null ? byId.get(c.parentId) : undefined)
    chain.unshift(c);

  // Usable choices under a parent (archived ones only if already chosen), in the API's tree order.
  const childrenOf = (parentId: number | null) =>
    categories.filter((c) => c.kind === kind && c.parentId === parentId && (!c.isArchived || chain.includes(c)));

  // One dropdown per level: the top level, then each chosen category that has subcategories.
  const levels: { parent: Category | null; options: Category[]; selected: Category | undefined }[] = [];
  for (let parent: Category | null = null, depth = 0; depth < 20; depth++) {
    const options = childrenOf(parent?.id ?? null);
    if (options.length === 0) break;
    const selected = chain[depth];
    levels.push({ parent, options, selected });
    if (!selected) break;
    parent = selected;
  }

  return (
    <div className="grid gap-2">
      {levels.map(({ parent, options, selected }, depth) => (
        <Select key={parent?.id ?? 'top'} id={depth === 0 ? id : undefined}
          aria-label={depth === 0 ? undefined : `Within ${parent!.name}`}
          value={selected?.id ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? parent!.id : Number(e.target.value))}>
          {parent && <option value="">{parent.name} itself</option>}
          {options.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.isArchived ? ' (archived)' : ''}</option>
          ))}
        </Select>
      ))}
    </div>
  );
}
