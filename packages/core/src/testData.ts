// Builders for tests only (not exported from the package): each fills in every field with
// something plausible, so a test only spells out what it's about.
import type {
  Account, BudgetLine, BudgetMonth, Category, DebtLine, DebtsOverview, ExchangeRate, MonthlySummary, PlannedPurchase, PurchaseAdvice,
  SavingsLine,
  Transaction,
} from './types';

export const category = (c: Partial<Category> & Pick<Category, 'id' | 'name'>): Category => ({
  kind: 'Expense', parentId: null, path: c.name, depth: 0, sortOrder: 0, isArchived: false,
  defaultMonthlyAmount: null, transactionCount: 0, childCount: 0, isEssential: false, essential: false, ...c,
});

export const account = (a: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  type: 'Current', currency: 'GBP', balance: 0, apr: 0, minimumPayment: 0, monthlyPayment: 0,
  creditLimit: null, availableCredit: null, createdAt: '2026-01-01T00:00:00Z', aliases: [], ...a,
});

export const transaction = (t: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction => ({
  amount: 10, currency: 'GBP', gbpAmount: 10, description: 'Tesco', categoryId: 1, category: 'Food',
  date: '2026-10-21', type: 'Expense', accountId: 1, accountName: 'Lloyds Current',
  toAccountId: null, toAccountName: null, toAmount: null, toCurrency: null,
  createdAt: '2026-10-21T12:00:00Z', ...t,
});

export const rate = (from: string, to: string, value: number | null): ExchangeRate => ({
  from, to, rate: value, source: value === null ? 'None' : 'Manual', updatedAt: null, transferDate: null, manualRate: value,
});

export const budgetLine = (l: Partial<BudgetLine> & Pick<BudgetLine, 'categoryId' | 'name'>): BudgetLine => ({
  isArchived: false, defaultAmount: null, monthAmount: null, ownPlanned: 0, ownSpent: 0, planned: 0, spent: 0,
  remaining: 0, percentUsed: null, projected: 0, dailyAllowance: 0, children: [], ...l,
});

export const debtLine = (l: Partial<DebtLine> & Pick<DebtLine, 'accountId' | 'name'>): DebtLine => ({
  defaultAmount: null, monthAmount: null, planned: 0, paid: 0, remaining: 0, percentUsed: null, suggested: null,
  currency: 'GBP', rate: 1, nativeDefault: null, nativeMonthAmount: null, nativePlanned: 0, nativePaid: 0,
  nativeRemaining: 0, nativeSuggested: null, ...l,
});

export const budgetMonth = (b: Partial<BudgetMonth> = {}): BudgetMonth => ({
  year: 2026, month: 10, periodStart: '2026-09-28', periodEnd: '2026-10-27', daysInPeriod: 30, daysElapsed: 20, daysLeft: 10,
  income: 2500, plannedSpending: 0, plannedDebts: 0, plannedSavings: 0, totalPlanned: 0, unallocated: 2500, spent: 0,
  debtPaid: 0, savingsPaid: 0, safeToSpend: 0, safeToSpendPerDay: 0, hasMonthDebtAmounts: false, debtBudget: null,
  avalancheExtra: 0, avalancheExtraPaid: 0, lines: [], debts: [], savings: [], ...b,
});

export const summary = (s: Partial<MonthlySummary> = {}): MonthlySummary => ({
  year: 2026, month: 10, periodStart: '2026-09-28', periodEnd: '2026-10-27', totalSpent: 0, monthlyIncome: 2500,
  incomeMode: 'Fixed', remaining: 2500, byCategory: [], ...s,
});

export const debtsOverview = (d: Partial<DebtsOverview> = {}): DebtsOverview => ({
  totalBalance: 0, totalMonthlyPayment: 0, totalInterest: 0, debtFreeDate: null, debts: [], currenciesWithoutRate: [], ...d,
});

// Visa fees: £3,990 at £1,330 a month, November to January, nothing saved yet.
export const plannedPurchase = (p: Partial<PlannedPurchase> = {}): PlannedPurchase => ({
  id: 1, name: 'Visa fees', targetAmount: 3990, monthlyAmount: 1330, startMonth: '2026-11', targetMonth: '2027-01',
  isEssential: true, status: 'Active', notes: null, createdAt: '2026-11-01T00:00:00Z', accountId: 9, accountName: 'Visa fees',
  saved: 0, remaining: 3990, percent: 0, neededByNow: 0, onTrack: true, monthsLeft: 3, expectedFinish: '2027-01', ...p,
});

export const savingsLine = (l: Partial<SavingsLine> = {}): SavingsLine => ({
  plannedPurchaseId: 1, accountId: 9, name: 'Visa fees', isEssential: true, defaultAmount: 1330, monthAmount: null,
  stillNeeded: 3990, planned: 1330, paid: 0, remaining: 1330, percentUsed: 0, ...l,
});

export const purchaseAdvice = (r: Partial<PurchaseAdvice['result']> = {}, a: Partial<PurchaseAdvice> = {}): PurchaseAdvice => ({
  id: 1, plannedPurchaseId: 1, name: 'Visa fees', createdAt: '2026-11-01T10:30:00Z', model: 'gpt-5.4-mini', inputTokens: 1800, outputTokens: 320,
  promptSent: 'Purchase to advise on: ...',
  result: { verdict: 'GoodIdea', suggestedMonthlyAmount: 1000, suggestedMonths: 4, reasoning: 'It fits.', risks: [], alternatives: [], ...r },
  ...a,
});
