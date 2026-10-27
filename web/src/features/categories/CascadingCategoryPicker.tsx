import type { Category, CategoryKind } from '@lifetracker/core';
import { categoryLevels } from '@lifetracker/core';
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
  // One dropdown per level: the top level, then each chosen category that has subcategories.
  const levels = categoryLevels(categories, kind, value);

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
