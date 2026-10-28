export type AccountType = 'Current' | 'CreditCard' | 'Loan';
export type TransactionType = 'Expense' | 'Income' | 'Transfer';
// What the summary measures spending against: the take-home pay setting, or recorded Income.
export type IncomeMode = 'Fixed' | 'Recorded';

export interface AccountAlias {
  id: number;
  accountId: number;
  alias: string;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string; // e.g. 'GBP', 'NGN'; balance and payments are in this currency
  balance: number; // Current: money held. CreditCard/Loan: amount owed.
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  creditLimit: number | null;
  availableCredit: number | null;
  createdAt: string;
  aliases: AccountAlias[];
}

export type CategoryKind = 'Expense' | 'Income';

// A category in the tree (Subscriptions › AI › Claude). Path and depth come from the API;
// the counts say whether it can be deleted or must be archived. isEssential is its own setting;
// essential also counts one inherited from a category above it.
export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  parentId: number | null;
  path: string;
  depth: number;
  sortOrder: number;
  isArchived: boolean;
  defaultMonthlyAmount: number | null; // spending categories only, in £
  transactionCount: number;
  childCount: number;
  isEssential: boolean;
  essential: boolean;
}

export interface SaveCategory {
  name: string;
  kind: CategoryKind;
  parentId: number | null;
  defaultMonthlyAmount: number | null;
  isEssential: boolean; // spending categories only
}

// What the API takes to create or replace an account.
export interface SaveAccount {
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  creditLimit: number | null;
}

// A repayment into a card or loan; amount is what the debt received, in its currency.
export interface AccountPayment {
  id: number;
  amount: number;
  date: string;
  fromAccountId: number;
  fromAccountName: string;
}

export interface Transaction {
  id: number;
  amount: number; // in the account's currency
  currency: string;
  gbpAmount: number; // the amount in pounds, as counted in the summary
  description: string;
  categoryId: number | null; // null for transfers
  category: string | null; // the category's path, e.g. "Subscriptions › AI › Claude"
  date: string;
  type: TransactionType;
  accountId: number;
  accountName: string;
  toAccountId: number | null;
  toAccountName: string | null;
  toAmount: number | null; // a transfer between currencies: what arrived
  toCurrency: string | null;
  createdAt: string;
}

export interface CreateTransaction {
  amount: number;
  description: string;
  categoryId: number | null; // required for spending and income, null for transfers
  date: string;
  type: TransactionType;
  accountId: number;
  toAccountId?: number | null;
  toAmount?: number | null; // required for a transfer between currencies
  gbpAmount?: number | null; // optional £ value for something not in pounds
}

export interface CategoryTotal {
  category: string;
  total: number;
}

// One budget month. With payday set, it runs from payday to the day before the next one.
export interface MonthlySummary {
  year: number;
  month: number;
  periodStart: string; // first day, e.g. "2026-10-25"
  periodEnd: string; // last day, e.g. "2026-11-24"
  totalSpent: number;
  monthlyIncome: number; // take-home pay or recorded income, as incomeMode says
  incomeMode: IncomeMode;
  remaining: number;
  byCategory: CategoryTotal[];
}

export interface PayoffProjection {
  canBePaidOff: boolean;
  months: number;
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
}

export interface DebtWithProjection {
  debt: Account; // a CreditCard or Loan account
  projection: PayoffProjection;
}

export interface DebtsOverview {
  totalBalance: number;
  totalMonthlyPayment: number;
  totalInterest: number;
  debtFreeDate: string | null;
  debts: DebtWithProjection[];
  currenciesWithoutRate: string[]; // debts in these aren't in the £ totals yet
}

export interface WhatIfComparison {
  current: PayoffProjection;
  whatIf: PayoffProjection;
  monthsSaved: number;
  interestSaved: number;
}

export interface PlannedPayoff {
  id: number;
  name: string;
  month: number;
  payoffDate: string;
  interestPaid: number;
}

export interface AvalanchePlan {
  canBePaidOff: boolean;
  months: number;
  debtFreeDate: string | null;
  totalInterest: number;
  monthlyBudget: number;
  payoffs: PlannedPayoff[];
}

export interface Settings {
  id: number;
  monthlyIncome: number;
  monthlyDebtBudget: number | null;
  defaultAccountId: number | null;
  incomeMode: IncomeMode;
  monthStartDay: number; // 1-28; budget months start on this day
  useTransferRates: boolean; // true: my latest transfer's rate first, my own rates as fallback
  earlyIncomeDays: number; // recorded income this many days before a month counts towards it
  updatedAt: string;
}
// One category's line in a budget month. own* is the category itself; planned and spent
// include its subcategories. monthAmount is this month's own figure (null = using the default).
export interface BudgetLine {
  categoryId: number;
  name: string;
  isArchived: boolean;
  defaultAmount: number | null;
  monthAmount: number | null;
  ownPlanned: number;
  ownSpent: number;
  planned: number;
  spent: number;
  remaining: number;
  percentUsed: number | null;
  projected: number; // month-end spending at today's pace
  dailyAllowance: number; // what can go per day for the rest of the month
  children: BudgetLine[];
}

// A card or loan's line: default = its monthly payment in £ (null for a naira loan with no rate yet).
export interface DebtLine {
  accountId: number;
  name: string;
  defaultAmount: number | null;
  monthAmount: number | null;
  planned: number;
  paid: number;
  remaining: number;
  percentUsed: number | null;
  suggested: number | null; // what the avalanche plan would pay it this month
  // The same in the account's own currency (₦ for a naira loan): what I see and set.
  currency: string;
  rate: number | null; // its currency -> GBP rate; null with no rate yet
  nativeDefault: number | null;
  nativeMonthAmount: number | null;
  nativePlanned: number;
  nativePaid: number;
  nativeRemaining: number;
  nativeSuggested: number | null;
}

export interface BudgetMonth {
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  daysInPeriod: number;
  daysElapsed: number;
  daysLeft: number;
  income: number;
  plannedSpending: number;
  plannedDebts: number;
  totalPlanned: number;
  unallocated: number;
  spent: number;
  debtPaid: number;
  safeToSpend: number;
  safeToSpendPerDay: number;
  hasMonthDebtAmounts: boolean; // true once a debt figure is set: the debt lines are the avalanche budget
  debtBudget: number | null;
  avalancheExtra: number; // what the avalanche pays beyond the debt lines
  avalancheExtraPaid: number;
  lines: BudgetLine[];
  debts: DebtLine[];
}

export interface BudgetMonthView {
  budget: BudgetMonth;
  incomeMode: IncomeMode;
  settingsDebtBudget: number | null;
}

// A budget line is a spending category or a debt account.
export type BudgetLineKey = { categoryId: number; accountId?: undefined } | { accountId: number; categoryId?: undefined };

// Where an exchange rate comes from: my own rate, the inverse of my rate for the other direction,
// my latest transfer between the two currencies, or nothing yet.
export type RateSource = 'Same' | 'Manual' | 'InverseOfManual' | 'Transfer' | 'None';

// One direction's rate: units of `to` per 1 `from`.
export interface ExchangeRate {
  from: string;
  to: string;
  rate: number | null;
  source: RateSource;
  updatedAt: string | null; // when I set it (Manual, InverseOfManual)
  transferDate: string | null; // the transfer it came from (Transfer)
  manualRate: number | null; // my own figure for this direction, if I've set one
}

// An AI insight for a budget month: the checked answer, what it cost, and exactly what was sent.
export interface WasteItem {
  name: string;
  monthlyAmount: number;
  reason: string;
}

export interface SavingTip {
  tip: string;
  estimatedMonthlySaving: number;
  line?: string | null; // the budget line it would reduce (insights saved before it was asked for have none)
}

export interface Insight {
  id: number;
  year: number;
  month: number;
  periodStart: string;
  createdAt: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  promptSent: string;
  result: {
    summary: string;
    wasteItems: WasteItem[];
    savingTips: SavingTip[];
    debtAdvice: string;
  };
}
