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
  category: string;
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
  category: string;
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
  updatedAt: string;
}