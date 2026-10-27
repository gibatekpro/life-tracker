import { router } from 'expo-router';

// Opening the budget line modal: changing a line's figure for a month (web: AmountEditor, inline), or
// adding a category to the month (web: AddLineForm). Route params are strings.
export interface AmountTarget {
  year: number;
  month: number;
  categoryId?: number;
  accountId?: number;
  name: string;
  currency?: string;
  current: number; // what editing starts from (a parent's own amount)
  defaultAmount: number | null;
  monthAmount: number | null;
}

export function openAmountEditor(a: AmountTarget) {
  const params: Record<string, string> = { mode: 'edit', year: String(a.year), month: String(a.month), name: a.name,
    currency: a.currency ?? 'GBP', current: String(a.current) };
  if (a.categoryId !== undefined) params.categoryId = String(a.categoryId);
  if (a.accountId !== undefined) params.accountId = String(a.accountId);
  if (a.defaultAmount !== null) params.defaultAmount = String(a.defaultAmount);
  if (a.monthAmount !== null) params.monthAmount = String(a.monthAmount);
  router.push({ pathname: '/budget-line', params });
}

export function openAddLine(year: number, month: number) {
  router.push({ pathname: '/budget-line', params: { mode: 'add', year: String(year), month: String(month) } });
}
