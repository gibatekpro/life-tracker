export type AccountType = 'Current' | 'CreditCard' | 'Loan';
export type TransactionType = 'Expense' | 'Income' | 'Transfer';

export interface AccountAlias {
  id: number;
  accountId: number;
  alias: string;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number; // Current: money held. CreditCard/Loan: amount owed.
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  creditLimit: number | null;
  availableCredit: number | null;
  createdAt: string;
  aliases: AccountAlias[];
}

export interface Transaction {
  id: number;
  amount: number;
  description: string;
  category: string;
  date: string;
  type: TransactionType;
  accountId: number;
  accountName: string;
  toAccountId: number | null;
  toAccountName: string | null;
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
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  totalSpent: number;
  monthlyIncome: number;
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
  updatedAt: string;
}