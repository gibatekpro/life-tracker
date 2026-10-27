import type { Category, CategoryKind } from './types';

// A category and its parents, from the top: Claude -> [Subscriptions, AI, Claude].
// Empty when id is undefined or not in the list.
export function categoryChain(categories: Category[], id: number | undefined): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Category[] = [];
  for (let c = id !== undefined ? byId.get(id) : undefined; c; c = c.parentId !== null ? byId.get(c.parentId) : undefined)
    chain.unshift(c);
  return chain;
}

// One level of a picker that drills down a level at a time: the choices under `parent`
// (null = top level) and which of them is chosen, if any.
export interface CategoryLevel {
  parent: Category | null;
  options: Category[];
  selected: Category | undefined;
}

// The levels to show for `value`: the top level, then each chosen category that has
// subcategories, stopping at the first level with nothing chosen. Only categories of `kind`;
// archived ones only if already chosen; in the API's tree order. Choosing a parent itself is
// allowed, since spending can be filed on a parent too.
export function categoryLevels(categories: Category[], kind: CategoryKind, value: number | undefined): CategoryLevel[] {
  const chain = categoryChain(categories, value);

  const childrenOf = (parentId: number | null) =>
    categories.filter((c) => c.kind === kind && c.parentId === parentId && (!c.isArchived || chain.includes(c)));

  const levels: CategoryLevel[] = [];
  for (let parent: Category | null = null, depth = 0; depth < 20; depth++) {
    const options = childrenOf(parent?.id ?? null);
    if (options.length === 0) break;
    const selected = chain[depth];
    levels.push({ parent, options, selected });
    if (!selected) break;
    parent = selected;
  }
  return levels;
}

// The categories a picker offers, in the API's tree order, each labelled with its path (web:
// CategorySelect): only `kind`; archived ones hidden unless one is the current value; `exclude`
// left out (e.g. a category and its subcategories, when choosing its parent).
export const selectableCategories = (categories: Category[], kind: CategoryKind, value: number | null | undefined, exclude?: Set<number>) =>
  categories.filter((c) => c.kind === kind && (!c.isArchived || c.id === value) && !exclude?.has(c.id));
