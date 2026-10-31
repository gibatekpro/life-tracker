import {
  boughtFormValues, boughtNote, buildBoughtRequest, ukTodayIso, type BoughtFormValues, type Category, type PlannedPurchase,
} from '@lifetracker/core';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { getCategories, getPlannedPurchase, markPlannedPurchaseBought } from '@/api';
import ErrorAlert from '@/components/ErrorAlert';
import ErrorCard from '@/components/ErrorCard';
import { categoryPickerRows } from '@/components/form/CategoryPicker';
import DateRow from '@/components/form/DateRow';
import { Field, TextField } from '@/components/form/Field';
import FormSection from '@/components/form/FormSection';
import MoneyInput from '@/components/form/MoneyInput';
import HeaderButton from '@/components/HeaderButton';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// "Mark as bought", as a modal (web: BoughtForm): what it cost, recorded as an expense from its savings
// account, and the planned purchase marked bought. Anything left over stays in the account.
export default function MarkBoughtModal() {
  const t = useTokens();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const purchase = useData(`planned-purchase-${id}`, () => getPlannedPurchase(id));
  const categories = useData('categories', getCategories);
  const p = purchase.data?.id === id ? purchase.data : undefined;
  const failed = [purchase, categories].find((d) => d.error);

  if (!p || !categories.data) {
    return (
      <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: 'Mark as bought', headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />
        {failed ? <ErrorCard message={failed.error!} status={failed.errorStatus} /> : <ActivityIndicator color={t.muted} />}
      </ScrollView>
    );
  }
  return <BoughtForm purchase={p} categories={categories.data} />;
}

function BoughtForm({ purchase, categories }: { purchase: PlannedPurchase; categories: Category[] }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [values, setValues] = useState<BoughtFormValues>(() => boughtFormValues(purchase, categories, ukTodayIso()));
  const set = (patch: Partial<BoughtFormValues>) => { setValues((v) => ({ ...v, ...patch })); setError(null); };
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const built = buildBoughtRequest(values);
    if (built.error !== undefined) {
      setError(built.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await markPlannedPurchaseBought(purchase.id, built.request);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
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
        title: `Mark ${purchase.name} as bought`,
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
        headerRight: () => <HeaderButton primary title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />,
      }} />
      <Text style={[styles.subtitle, { color: t.muted }]}>{boughtNote(purchase)}</Text>
      {error && <ErrorAlert message={error} />}

      <FormSection>
        <Field label="What it cost">
          <MoneyInput large symbol="£" value={values.amount} onChangeText={(amount) => set({ amount })} autoFocus accessibilityLabel="What it cost" />
        </Field>
      </FormSection>
      <FormSection>
        {categoryPickerRows({ categories, kind: 'Expense', value: values.categoryId, onChange: (categoryId) => set({ categoryId }) })}
        <DateRow label="Date" value={values.date} onChange={(date) => set({ date })} />
      </FormSection>
      <FormSection>
        <Field label="Description">
          <TextField value={values.description} onChangeText={(description) => set({ description })} maxLength={200} accessibilityLabel="Description" />
        </Field>
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  subtitle: { fontSize: 15, lineHeight: 20 },
});
