import { router, Stack, useLocalSearchParams } from 'expo-router';

import HeaderButton from '@/components/HeaderButton';
import TransactionFormScreen from '@/features/transactions/TransactionFormScreen';
import { draftFromParams, type TransactionParams } from '@/features/transactions/open';

// The transaction form as a modal: /transaction for a new one, /transaction?type=Transfer&… for a
// draft, /transaction?id=42 to edit (and delete). Open it with features/transactions/open.ts.
export default function TransactionModal() {
  const params = useLocalSearchParams<TransactionParams>();
  const id = params.id ? Number(params.id) : undefined;

  return (
    <>
      <Stack.Screen options={{
        title: id !== undefined ? 'Edit transaction' : 'New transaction',
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
      }} />
      <TransactionFormScreen
        transactionId={id}
        draft={id === undefined ? draftFromParams(params) : undefined}
        onDone={() => router.back()}
      />
    </>
  );
}
