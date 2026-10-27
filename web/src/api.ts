import { createApi } from '@lifetracker/core';

// The web's API client (the endpoints live in packages/core/src/api.ts). The Vite dev server
// forwards /api to the API on port 5080, so requests come from this Mac and need no key.
// Errors are ApiErrors whose message is ready to show.
export const {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getAccounts, getAccount, createAccount, updateAccount, deleteAccount, addAlias, removeAlias, getAccountPayments,
  getCategories, createCategory, updateCategory, archiveCategory, unarchiveCategory, deleteCategory,
  getBudgetMonth, setBudgetAmount, resetBudgetAmount, copyPreviousBudget,
  getInsights, generateInsight, deleteInsight,
  getDebts, getAvalanchePlan, getWhatIf,
  getMonthlySummary,
  getSettings, updateSettings, setDefaultAccount,
  getExchangeRates, setExchangeRate, clearExchangeRate,
} = createApi({ baseUrl: '/api' });
