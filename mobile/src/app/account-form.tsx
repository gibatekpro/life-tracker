import {
  accountFormValues, accountNamePlaceholder, buildAccountRequest, currencyChoices, currencySymbol, showsLoanAppHint,
  type Account, type AccountFormValues, type AccountType,
} from '@lifetracker/core';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { createAccount, getAccount, updateAccount } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import { Field, TextField } from '@/components/form/Field';
import FormSection from '@/components/form/FormSection';
import MoneyInput from '@/components/form/MoneyInput';
import SelectRow from '@/components/form/SelectRow';
import HeaderButton from '@/components/HeaderButton';
import Alert from '@/components/ui/Alert';
import Segmented from '@/components/ui/Segmented';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';
import ErrorAlert from '@/components/ErrorAlert';

const types: { value: AccountType; label: string }[] = [
  { value: 'Current', label: 'Current' },
  { value: 'CreditCard', label: 'Credit card' },
  { value: 'Loan', label: 'Loan' },
];

// Adding or editing an account, as a modal (web: AccountForm in a Modal): /account-form to add,
// /account-form?id=5 to edit. The rules are core's accountForm.ts. Adding opens the new account.
export default function AccountFormModal() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : undefined;
  const account = useData(`account-${editingId}`, () => getAccount(editingId!), editingId !== undefined);

  if (editingId !== undefined && !account.data) {
    return (
      <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: 'Edit account', headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />
        {account.error ? <ErrorCard message={account.error} status={account.errorStatus} /> : <ActivityIndicator color={t.muted} />}
      </ScrollView>
    );
  }
  return <AccountForm account={account.data} />;
}

function AccountForm({ account }: { account?: Account }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [values, setValues] = useState<AccountFormValues>(() => accountFormValues(account));
  const set = (patch: Partial<AccountFormValues>) => { setValues((v) => ({ ...v, ...patch })); setError(null); };
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDebt = values.type !== 'Current';
  const symbol = currencySymbol(values.currency);

  async function save() {
    const built = buildAccountRequest(values);
    if (built.error !== undefined) {
      setError(built.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (account) {
        await updateAccount(account.id, built.request);
        router.back();
      } else {
        const created = await createAccount(built.request);
        router.replace(`/accounts/${created.id}`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } catch (e) {
      setError((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <Stack.Screen options={{
        title: account ? `Edit ${account.name}` : 'Add account',
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
        headerRight: () => <HeaderButton primary title={saving ? 'Saving…' : account ? 'Save' : 'Add'} onPress={save} disabled={saving} />,
      }} />
      {!account && <Text style={[styles.subtitle, { color: t.muted }]}>A bank account, a credit card, or a loan.</Text>}
      {error && <ErrorAlert message={error} />}

      <Segmented label="Account type" options={types} value={values.type} onChange={(type) => set({ type })} />

      <FormSection>
        <Field label="Name">
          <TextField value={values.name} onChangeText={(name) => set({ name })} placeholder={accountNamePlaceholder(values.type)}
            maxLength={100} autoFocus={!account} />
        </Field>
        <SelectRow label="Currency" valueLabel={currencyChoices.find((c) => c.code === values.currency)?.label}
          options={currencyChoices.map((c) => ({ label: c.label, value: c.code }))} onChange={(currency) => set({ currency })} />
      </FormSection>

      {showsLoanAppHint(values) && (
        <Alert tone="info">
          <Text style={[styles.text, { color: t.ink }]}>
            For a loan app, enter the <Text style={styles.bold}>total repayable</Text> the app shows as the amount owed, an APR
            of <Text style={styles.bold}>0</Text>, and the <Text style={styles.bold}>instalment</Text> as the monthly payment. Its
            fees and interest are already in the total.
          </Text>
        </Alert>
      )}

      <FormSection>
        <Field label={isDebt ? 'Amount owed' : 'Balance'} hint={isDebt ? undefined : 'Can be negative if overdrawn'}>
          <MoneyInput symbol={symbol} value={values.balance} onChangeText={(balance) => set({ balance })} allowNegative={!isDebt}
            accessibilityLabel={isDebt ? 'Amount owed' : 'Balance'} />
        </Field>
        {isDebt && (
          <Field label="APR" hint="Yearly interest rate, e.g. 24.9">
            <MoneyInput symbol="" suffix="%" placeholder="0" value={values.apr} onChangeText={(apr) => set({ apr })} accessibilityLabel="APR" />
          </Field>
        )}
      </FormSection>

      {isDebt && (
        <FormSection>
          <Field label="Monthly payment" hint="What you plan to pay each month">
            <MoneyInput symbol={symbol} value={values.monthlyPayment} onChangeText={(monthlyPayment) => set({ monthlyPayment })}
              accessibilityLabel="Monthly payment" />
          </Field>
          <Field label="Minimum payment">
            <MoneyInput symbol={symbol} value={values.minimumPayment} onChangeText={(minimumPayment) => set({ minimumPayment })}
              accessibilityLabel="Minimum payment" />
          </Field>
        </FormSection>
      )}

      {values.type === 'CreditCard' && (
        <FormSection>
          <Field label="Credit limit" hint="Optional. Shows how much credit is left.">
            <MoneyInput symbol={symbol} value={values.creditLimit} onChangeText={(creditLimit) => set({ creditLimit })}
              accessibilityLabel="Credit limit" />
          </Field>
        </FormSection>
      )}

      {account && (
        <Text style={[styles.note, { color: t.muted }]}>
          Changing the balance here sets it directly; it isn&apos;t recorded as a transaction. Type and currency can&apos;t change once
          the account has transactions.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  text: { fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 18 },
});
