export interface Transaction {
  id: number;
  amount: number;
  description: string;
  category: string;
  date: string;
  createdAt: string;
}

export type CreateTransaction = Omit<Transaction, 'id' | 'createdAt'>;

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

export interface Debt {
  id: number;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  createdAt: string;
}

export interface PayoffProjection {
  canBePaidOff: boolean;
  months: number;
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
}

export interface DebtWithProjection {
  debt: Debt;
  projection: PayoffProjection;
}

export interface DebtsOverview {
  totalBalance: number;
  totalMonthlyPayment: number;
  totalInterest: number;
  debtFreeDate: string | null;
  debts: DebtWithProjection[];
}