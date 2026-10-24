import type { SelectHTMLAttributes } from 'react';
import type { Category, CategoryKind } from '../../types';
import { Select } from '../../components/ui/Field';

// A category picker that shows the tree in order, each option labelled with its full path:
//   Subscriptions
//   Subscriptions › AI
//   Subscriptions › AI › Claude
// A native <select> can't nest deeper than one optgroup, and indentation alone loses its context
// once the picker is closed ("Claude" under what?), so the path keeps it clear either way.
// Only categories of `kind`; archived ones are hidden unless one is the current value.
export default function CategorySelect({ categories, kind, value, topLevelLabel, exclude, ...rest }:
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value'> & {
    categories: Category[];
    kind: CategoryKind;
    value: number | null | undefined;
    topLevelLabel?: string;     // an extra first choice with value "" (e.g. "Top level")
    exclude?: Set<number>;      // e.g. a category and its subcategories, when choosing its parent
  }) {
  const shown = categories.filter((c) =>
    c.kind === kind && (!c.isArchived || c.id === value) && !exclude?.has(c.id));

  return (
    <Select value={value ?? ''} {...rest}>
      {topLevelLabel !== undefined && <option value="">{topLevelLabel}</option>}
      {shown.map((c) => (
        <option key={c.id} value={c.id}>
          {c.path}{c.isArchived ? ' (archived)' : ''}
        </option>
      ))}
    </Select>
  );
}
