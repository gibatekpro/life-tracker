import type { TransactionDraft } from '@lifetracker/core';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { getAccounts, getCategories, getExchangeRates, getTransaction } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';
import TransactionForm from './TransactionForm';

// Loads what the form needs (accounts, categories, rates, and the transaction when editing),
// then shows it. Used by the Add tab and by the transaction modal.
export default function TransactionFormScreen({ transactionId, draft, onDone }: {
  transactionId?: number;
  draft?: TransactionDraft;
  onDone?: () => void;
}) {
  const t = useTokens();
  // Once saved or deleted in the modal, stop loading: the refresh() that follows would otherwise
  // reload a transaction that no longer exists while the modal slides away.
  const [closing, setClosing] = useState(false);
  const enabled = !closing;

  const accounts = useData('accounts', getAccounts, enabled);
  const categories = useData('categories', getCategories, enabled);
  const rates = useData('exchange-rates', getExchangeRates, enabled);
  const editing = transactionId !== undefined;
  const transaction = useData(`transaction-${transactionId}`, () => getTransaction(transactionId!), enabled && editing);

  const failed = [accounts, categories, rates, ...(editing ? [transaction] : [])].find((d) => d.error);
  const ready = accounts.data && categories.data && rates.data && (!editing || transaction.data);

  if (ready) {
    return (
      <TransactionForm
        data={{ accounts: accounts.data!, categories: categories.data!, rates: rates.data! }}
        draft={draft}
        transaction={transaction.data}
        onDone={onDone && (() => { setClosing(true); onDone(); })}
      />
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {failed
        ? <ErrorCard message={failed.error!} status={failed.errorStatus} />
        : <ActivityIndicator style={styles.spinner} color={t.muted} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  spinner: { marginTop: 48 },
});
