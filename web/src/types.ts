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