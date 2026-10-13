export interface Transaction {
  id: number;
  amount: number;
  description: string;
  category: string;
  date: string;
  createdAt: string;
}

export type CreateTransaction = Omit<Transaction, 'id' | 'createdAt'>;