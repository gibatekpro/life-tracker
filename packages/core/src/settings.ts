import { currencySymbol, formatMoney, ordinal } from './format';
import { formatRate } from './rates';
import type { Category, CategoryKind, ExchangeRate, IncomeMode, SaveCategory, Settings } from './types';

// ---- Settings (web: SettingsPage, CategoriesCard, CategoryForm, CurrenciesCard) ----

// Income and budget: what the monthly summary measures against, and when a budget month starts.
export const incomeModeChoices: { value: IncomeMode; label: string }[] = [
  { value: 'Fixed', label: 'Take-home pay' },
  { value: 'Recorded', label: 'Recorded income' },
];

export const incomeModeHint = (mode: IncomeMode) => (mode === 'Fixed'
  ? 'A set monthly amount. Simple, and right if your pay is the same every month.'
  : 'The Income transactions you record each month. Right if your pay varies or you have more than one income.');

export const earlyIncomeChoices = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => ({
  value: d, label: d === 0 ? 'No, only within the month' : `Up to ${d} day${d === 1 ? '' : 's'} before`,
}));

export const startDayChoices = Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({
  value: d, label: d === 1 ? '1st (calendar month)' : `${ordinal(d)} (payday)`,
}));

export const startDayHint = (day: number) =>
  day === 1 ? 'Calendar months.' : `Each month runs from the ${ordinal(day)} to the day before the next ${ordinal(day)}.`;

export interface BudgetSettingsValues {
  incomeMode: IncomeMode;
  income: string;
  debtBudget: string;
  startDay: number;
  earlyDays: number;
}

export const budgetSettingsValues = (s: Settings): BudgetSettingsValues => ({
  incomeMode: s.incomeMode,
  income: String(s.monthlyIncome),
  debtBudget: s.monthlyDebtBudget?.toString() ?? '',
  startDay: s.monthStartDay,
  earlyDays: s.earlyIncomeDays,
});

// The settings update, or what's wrong first (take-home pay is required while it's what's measured against).
export function buildBudgetSettings(v: BudgetSettingsValues) {
  if (v.incomeMode === 'Fixed' && v.income.trim() === '') return { error: 'Enter your monthly take-home pay.' };
  if ([v.income, v.debtBudget].some((s) => s.trim() !== '' && Number.isNaN(Number(s)))) return { error: 'Amounts must be numbers.' };
  return {
    request: {
      monthlyIncome: Number(v.income || 0),
      monthlyDebtBudget: v.debtBudget.trim() === '' ? null : Number(v.debtBudget),
      incomeMode: v.incomeMode,
      monthStartDay: v.startDay,
      earlyIncomeDays: v.earlyDays,
    },
  };
}

// Categories: the tree for one kind, archived ones only when asked for.
export const visibleCategories = (all: Category[], kind: CategoryKind, showArchived: boolean) =>
  all.filter((c) => c.kind === kind && (showArchived || !c.isArchived));

export const archivedCount = (all: Category[], kind: CategoryKind) => all.filter((c) => c.kind === kind && c.isArchived).length;

// The line under a category: its default budget (spending only), how many transactions, and how
// many subcategories when they're hidden.
export function categoryNote(c: Category, collapsedChildren?: number) {
  const parts = [
    ...(c.kind === 'Expense' ? [c.defaultMonthlyAmount !== null ? `${formatMoney(c.defaultMonthlyAmount)} a month` : 'No default budget'] : []),
    `${c.transactionCount} transaction${c.transactionCount === 1 ? '' : 's'}`,
  ];
  if (collapsedChildren) parts.push(`${collapsedChildren} subcategor${collapsedChildren === 1 ? 'y' : 'ies'}`);
  return parts.join(' · ');
}

// What can be done to a category besides editing it: bring back an archived one, delete one nothing
// uses, or archive one with transactions or subcategories (the API refuses to delete those: 409).
export const categoryRemoval = (c: Category): 'unarchive' | 'delete' | 'archive' =>
  c.isArchived ? 'unarchive' : c.transactionCount === 0 && c.childCount === 0 ? 'delete' : 'archive';

// A category and everything under it, so it can't be moved under one of its own subcategories.
export function withDescendants(id: number, categories: Category[]) {
  const found = new Set([id]);
  for (let added = true; added;) {
    added = false;
    for (const c of categories)
      if (c.parentId !== null && found.has(c.parentId) && !found.has(c.id)) { found.add(c.id); added = true; }
  }
  return found;
}

export interface CategoryFormValues {
  name: string;
  parentId: number | null;
  amount: string;
}

export const categoryFormValues = (category?: Category, parentId?: number | null): CategoryFormValues => ({
  name: category?.name ?? '',
  parentId: category?.parentId ?? parentId ?? null,
  amount: category?.defaultMonthlyAmount?.toString() ?? '',
});

export const categoryNamePlaceholder = (kind: CategoryKind) => (kind === 'Expense' ? 'e.g. Subscriptions' : 'e.g. Side job');

export function buildCategoryRequest(v: CategoryFormValues, kind: CategoryKind):
  { request: SaveCategory; error?: undefined } | { request?: undefined; error: string } {
  if (v.name.trim() === '') return { error: 'Enter a name.' };
  if (v.amount.trim() !== '' && Number.isNaN(Number(v.amount))) return { error: 'The default budget must be a number.' };
  return {
    request: {
      name: v.name.trim(),
      kind,
      parentId: v.parentId,
      defaultMonthlyAmount: kind === 'Expense' && v.amount.trim() !== '' ? Number(v.amount) : null,
    },
  };
}

// Currencies: each currency I have rates for (other than pounds), once, in the API's order.
export const rateCurrencies = (rates: ExchangeRate[]) => [...new Set(rates.map((r) => (r.from === 'GBP' ? r.to : r.from)))];

// "£1 = ₦1,811.5" (or "—" with no rate yet).
export const rateLabel = (r: ExchangeRate) =>
  `${currencySymbol(r.from)}1 = ${r.rate !== null ? `${currencySymbol(r.to)}${formatRate(r.rate)}` : '—'}`;

export const rateEditLabel = (r: ExchangeRate) => (r.manualRate !== null ? 'Change' : 'Set my rate');

// What editing a rate starts from: my own figure, or the one in use.
export const rateEditStart = (r: ExchangeRate) => String(r.manualRate ?? r.rate ?? '');
