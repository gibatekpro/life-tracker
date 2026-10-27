import { categoryLevels, type Category, type CategoryKind } from '@lifetracker/core';

import SelectRow from './SelectRow';

// A category picked one level at a time (web: CascadingCategoryPicker): choose a top-level category,
// then (if it has subcategories) a row appears for them, and so on. Each deeper row offers
// "{parent} itself", since spending can be filed on a parent too. Only categories of `kind`;
// archived ones only if already chosen. A function returning the rows rather than a component, so a
// FormSection sees each row and draws the lines between them.
export function categoryPickerRows({ categories, kind, value, onChange }: {
  categories: Category[];
  kind: CategoryKind;
  value: number | undefined;
  onChange: (categoryId: number) => void;
}) {
  return categoryLevels(categories, kind, value).map(({ parent, options, selected }, depth) => (
    <SelectRow key={parent?.id ?? 'top'} label={parent ? `Within ${parent.name}` : 'Category'}
      valueLabel={selected?.name ?? (parent ? `${parent.name} itself` : undefined)}
      options={[
        ...(parent ? [{ label: `${parent.name} itself`, value: parent.id }] : []),
        ...options.map((c) => ({ label: `${c.name}${c.isArchived ? ' (archived)' : ''}`, value: c.id })),
      ]}
      onChange={onChange}
      placeholder={depth === 0 ? 'Choose' : undefined} />
  ));
}
