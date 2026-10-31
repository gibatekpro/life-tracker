import { router } from 'expo-router';

// Opening the planned purchase modals: adding one (or editing with its id), and marking one bought
// (web: the Modals on PlannedPurchasesPage and PlannedPurchaseDetailPage).
export const openPurchaseForm = (id?: number) =>
  router.push(id === undefined ? '/planned-purchase-form' : { pathname: '/planned-purchase-form', params: { id: String(id) } });

export const openMarkBought = (id: number) =>
  router.push({ pathname: '/planned-purchase-bought', params: { id: String(id) } });
