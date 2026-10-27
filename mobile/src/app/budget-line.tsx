import {
  addLineDefaults, addLineHint, currencySymbol, monthName, resetLabel, type BudgetLineKey, type Category,
} from '@lifetracker/core';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { getCategories, resetBudgetAmount, setBudgetAmount } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import { categoryPickerRows } from '@/components/form/CategoryPicker';
import { Field } from '@/components/form/Field';
import FormSection from '@/components/form/FormSection';
import MoneyInput from '@/components/form/MoneyInput';
import HeaderButton from '@/components/HeaderButton';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

type Params = {
  mode: 'edit' | 'add'; year: string; month: string; name?: string; currency?: string; current?: string;
  categoryId?: string; accountId?: string; defaultAmount?: string; monthAmount?: string;
};

// A budget line for one month, as a modal (open it with features/budget/open.ts):
// - edit: a line's figure for this month (web: AmountEditor, which edits in place), with Reset when the
//   month has its own figure. Save is in the navigation bar, where the keyboard can't hide it.
// - add: a spending category added to this month, starting from its default (web: AddLineForm).
export default function BudgetLineModal() {
  const p = useLocalSearchParams<Params>();
  const year = Number(p.year);
  const month = Number(p.month);
  return p.mode === 'add' ? <AddLine year={year} month={month} /> : <EditAmount p={p} year={year} month={month} />;
}

function useSave() {
  const { refresh } = useRefresh();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      refresh();
    } catch (e) {
      setError((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setBusy(false);
    }
  }
  return { error, busy, run };
}

function EditAmount({ p, year, month }: { p: Params; year: number; month: number }) {
  const t = useTokens();
  const currency = p.currency ?? 'GBP';
  const key: BudgetLineKey = p.accountId ? { accountId: Number(p.accountId) } : { categoryId: Number(p.categoryId) };
  const defaultAmount = p.defaultAmount !== undefined ? Number(p.defaultAmount) : null;
  const [value, setValue] = useState(p.current ?? '');
  const { error, busy, run } = useSave();
  const save = () => run(() => setBudgetAmount(year, month, key, Number(value || 0)));

  return (
    <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{
        title: p.name ?? 'Budget',
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
        headerRight: () => <HeaderButton primary title="Save" onPress={save} disabled={busy} />,
      }} />
      <Text style={[styles.subtitle, { color: t.muted }]}>For {monthName(year, month)}.</Text>
      {error && <Alert tone="negative">{error}</Alert>}
      <FormSection>
        <Field label={`${p.name} budget this month`}>
          <MoneyInput large symbol={currencySymbol(currency)} value={value} onChangeText={setValue} autoFocus
            accessibilityLabel={`${p.name} budget this month`} />
        </Field>
      </FormSection>
      {p.monthAmount !== undefined && (
        <Button title={resetLabel(defaultAmount, currency)} variant="secondary" disabled={busy}
          onPress={() => run(() => resetBudgetAmount(year, month, key))} />
      )}
    </ScrollView>
  );
}

function AddLine({ year, month }: { year: number; month: number }) {
  const t = useTokens();
  const categories = useData('categories', getCategories);
  const header = <Stack.Screen options={{ title: 'Add a budget line', headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />;
  if (!categories.data) {
    return (
      <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {header}
        {categories.error ? <ErrorCard message={categories.error} status={categories.errorStatus} /> : <ActivityIndicator color={t.muted} />}
      </ScrollView>
    );
  }
  return <AddLineForm categories={categories.data} year={year} month={month} />;
}

function AddLineForm({ categories, year, month }: { categories: Category[]; year: number; month: number }) {
  const t = useTokens();
  const [initial] = useState(() => addLineDefaults(categories));
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [amount, setAmount] = useState(initial.amount);
  const { error, busy, run } = useSave();
  const chosen = categories.find((c) => c.id === categoryId);
  const name = monthName(year, month);
  const save = () => categoryId !== undefined && run(() => setBudgetAmount(year, month, { categoryId }, Number(amount || 0)));

  return (
    <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{
        title: 'Add a budget line',
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
        headerRight: () => <HeaderButton primary title="Add" onPress={save} disabled={busy || categoryId === undefined} />,
      }} />
      <Text style={[styles.subtitle, { color: t.muted }]}>For {name}.</Text>
      {error && <Alert tone="negative">{error}</Alert>}
      <FormSection>
        {categoryPickerRows({
          categories, kind: 'Expense', value: categoryId,
          onChange: (id) => {
            setCategoryId(id);
            setAmount(categories.find((c) => c.id === id)?.defaultMonthlyAmount?.toString() ?? ''); // pre-filled with its default
          },
        })}
      </FormSection>
      <FormSection footer={addLineHint(chosen, name)}>
        <Field label={`Budget for ${name}`}>
          <MoneyInput symbol="£" value={amount} onChangeText={setAmount} accessibilityLabel={`Budget for ${name}`} />
        </Field>
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  subtitle: { fontSize: 15, lineHeight: 20 },
});
