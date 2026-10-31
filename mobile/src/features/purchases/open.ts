import { router } from 'expo-router';

// Opening the planned purchase modals: adding one (or editing with its id, optionally starting from
// advice's suggested monthly amount), and marking one bought (web: the Modals on PlannedPurchasesPage
// and PlannedPurchaseDetailPage).
export const openPurchaseForm = (id?: number, suggestedMonthly?: number) =>
  router.push(id === undefined ? '/planned-purchase-form' : {
    pathname: '/planned-purchase-form',
    params: suggestedMonthly === undefined ? { id: String(id) } : { id: String(id), suggestedMonthly: String(suggestedMonthly) },
  });

export const openMarkBought = (id: number) =>
  router.push({ pathname: '/planned-purchase-bought', params: { id: String(id) } });
