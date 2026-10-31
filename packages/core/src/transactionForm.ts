import { isDebt } from './accounts';
import { formatMoney } from './format';
import { describeSource, formatRate, quoteFor } from './rates';
import type {
  Account, Category, CategoryKind, CreateTransaction, ExchangeRate, Transaction, TransactionType,
} from './types';

// The rules of the transaction form, shared by the phone's form (and matching
// web/src/features/transactions/TransactionForm.tsx): what it starts with, what follows from what's
// been entered, and the request it sends. The apps only draw it.

// Opening the form for a new transaction partly filled in, e.g. "Pay" on a card opens a transfer to it.
export interface TransactionDraft {
  type?: TransactionType;
  accountId?: number;
  toAccountId?: number;
  amount?: number;
  description?: string;
}

// What the form holds. Amounts are kept as typed, so "12." survives until the next key.
export interface TransactionFormValues {
  type: TransactionType;
  amount: string;
  description: string;
  categoryId: number | undefined;
  accountId: number | undefined;
  toAccountId: number | undefined;
  toAmount: string;
  // Until I type a received amount myself, it follows the amount sent at the exchange rate.
  toAmountTyped: boolean;
  gbpAmount: string;
  date: string; // "2026-10-21"
}

export interface FormData {
  accounts: Account[];
  categories: Category[];
  rates: ExchangeRate[];
}

export const categoryKindFor = (type: TransactionType): CategoryKind => (type === 'Income' ? 'Income' : 'Expense');

// The first usable category of a kind: what a new expense or income starts on. None for a transfer.
export const firstCategoryFor = (categories: Category[], type: TransactionType) =>
  type === 'Transfer' ? undefined
    : categories.find((c) => c.kind === categoryKindFor(type) && !c.isArchived)?.id;

// A blank form (on my first current account), a draft, or an existing transaction to edit.
export function initialFormValues({ accounts, categories, draft, transaction: t, today }: {
  accounts: Account[];
  categories: Category[];
  draft?: TransactionDraft;
  transaction?: Transaction;
  today: string;
}): TransactionFormValues {
  const firstCurrent = accounts.find((a) => a.type === 'Current') ?? accounts[0];
  const type = t?.type ?? draft?.type ?? 'Expense';
  return {
    type,
    amount: t ? String(t.amount) : draft?.amount ? String(draft.amount) : '',
    description: t?.description ?? draft?.description ?? '',
    categoryId: t?.categoryId ?? firstCategoryFor(categories, type),
    accountId: t?.accountId ?? draft?.accountId ?? firstCurrent?.id,
    toAccountId: t?.toAccountId ?? draft?.toAccountId,
    toAmount: t?.toAmount != null ? String(t.toAmount) : '',
    toAmountTyped: t?.toAmount != null,
    // Keep the £ value an edited naira transaction already has, unless I change or clear it.
    gbpAmount: t && t.currency !== 'GBP' && t.toCurrency !== 'GBP' ? String(t.gbpAmount) : '',
    date: t?.date ?? today,
  };
}

// Switching between expense, income and transfer starts on that kind's first category.
export const withType = (v: TransactionFormValues, type: TransactionType, categories: Category[]): TransactionFormValues =>
  ({ ...v, type, categoryId: firstCategoryFor(categories, type) });

// Money can't move to the account it comes from, so choosing that account clears the destination.
export const withAccount = (v: TransactionFormValues, accountId: number): TransactionFormValues =>
  ({ ...v, accountId, toAccountId: v.toAccountId === accountId ? undefined : v.toAccountId });

// What arrives for `sent` at `rate`, to the penny ("" when there's nothing to go on).
export const suggestReceived = (sent: number, rate: number | null | undefined) =>
  rate && sent > 0 ? (sent * rate).toFixed(2) : '';

// Everything the form shows that follows from what's been entered.
export interface TransactionFormView {
  isTransfer: boolean;
  categoryKind: CategoryKind;
  chosenCategoryId: number | undefined; // categories that arrive after the form opens: the first one
  from: Account | undefined;
  to: Account | undefined; // transfers only
  fromCurrency: string;
  crossesCurrencies: boolean; // a transfer between two currencies: asks what arrived
  asksForPounds: boolean; // neither side in pounds: may take a £ value
  receivedShown: string; // what I typed, or the suggestion from the rate
  receivedHint: string;
  estimatedPounds: string | null; // the £ value it gets if I don't type one
}

export function describeForm(v: TransactionFormValues, { accounts, categories, rates }: FormData): TransactionFormView {
  const isTransfer = v.type === 'Transfer';
  const from = accounts.find((a) => a.id === v.accountId);
  const to = isTransfer ? accounts.find((a) => a.id === v.toAccountId) : undefined;
  const fromCurrency = from?.currency ?? 'GBP';
  const crossesCurrencies = to !== undefined && to.currency !== fromCurrency;
  // A transfer into pounds already has an exact £ value; anything else not in pounds may need one.
  const asksForPounds = fromCurrency !== 'GBP' && to?.currency !== 'GBP';

  // The rate for this transfer's direction (e.g. GBP -> NGN), to suggest what will arrive.
  const sent = Number(v.amount);
  const quote = crossesCurrencies ? quoteFor(rates, fromCurrency, to!.currency) : undefined;
  const receivedShown = v.toAmountTyped ? v.toAmount : suggestReceived(sent, quote?.rate);

  // £10 sent, ₦18,000 received: the rate that implies, as a sanity check.
  const got = Number(receivedShown);
  const implied = crossesCurrencies && sent > 0 && got > 0 ? got / sent : null;
  const receivedHint = !crossesCurrencies ? ''
    : v.toAmountTyped
      ? (implied ? `1 ${fromCurrency} = ${formatRate(implied)} ${to!.currency}` : 'What arrived, after the exchange rate')
      : quote?.rate
        ? `At ${formatRate(quote.rate)} (${describeSource(quote).replace(/^./, (c) => c.toLowerCase())}). Change it to what actually arrived.`
        : 'What arrived, after the exchange rate';

  const toPounds = quoteFor(rates, fromCurrency, 'GBP')?.rate;
  const estimatedPounds = asksForPounds && toPounds && sent > 0 ? formatMoney(sent * toPounds) : null;

  return {
    isTransfer,
    categoryKind: categoryKindFor(v.type),
    chosenCategoryId: isTransfer ? undefined : v.categoryId ?? firstCategoryFor(categories, v.type),
    from, to, fromCurrency, crossesCurrencies, asksForPounds, receivedShown, receivedHint, estimatedPounds,
  };
}

// The request to send, or what's missing first (what the web form's required fields catch;
// the API checks the rest, e.g. an amount of zero, and its message is shown as it is).
export function buildTransactionRequest(v: TransactionFormValues, view: TransactionFormView):
  { request: CreateTransaction; error?: undefined } | { request?: undefined; error: string } {
  const { isTransfer, to, crossesCurrencies, asksForPounds, receivedShown, chosenCategoryId } = view;
  if (v.accountId === undefined) return { error: 'Choose an account.' };
  if (isTransfer && v.toAccountId === undefined) return { error: 'Choose the account the money went to.' };
  if (!isTransfer && chosenCategoryId === undefined) return { error: 'Choose a category.' };
  if (v.amount.trim() === '' || Number.isNaN(Number(v.amount))) return { error: 'Enter the amount.' };
  if (crossesCurrencies && (receivedShown.trim() === '' || Number.isNaN(Number(receivedShown))))
    return { error: 'Enter the amount that arrived.' };
  if (!isTransfer && v.description.trim() === '') return { error: 'Enter a description.' };
  if (v.gbpAmount.trim() !== '' && Number.isNaN(Number(v.gbpAmount))) return { error: 'Enter the value in pounds as a number.' };

  return {
    request: {
      type: v.type,
      amount: Number(v.amount),
      // A transfer's description can be left blank: it's clear from the accounts.
      description: v.description.trim() || (to ? `${isDebt(to) ? 'Payment' : 'Transfer'} to ${to.name}` : ''),
      // Spending and income need a category; a transfer between my accounts has none.
      categoryId: isTransfer ? null : chosenCategoryId ?? null,
      date: v.date,
      accountId: v.accountId,
      toAccountId: isTransfer ? v.toAccountId : null,
      toAmount: crossesCurrencies ? Number(receivedShown) : null,
      gbpAmount: asksForPounds && v.gbpAmount.trim() !== '' ? Number(v.gbpAmount) : null,
    },
  };
}
