import {
  buildCategoryRequest, categoryFormValues, categoryNamePlaceholder, selectableCategories, withDescendants,
  type Category, type CategoryFormValues, type CategoryKind,
} from '@lifetracker/core';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { createCategory, getCategories, updateCategory } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import { Field, TextField } from '@/components/form/Field';
import FormSection from '@/components/form/FormSection';
import MoneyInput from '@/components/form/MoneyInput';
import SelectRow from '@/components/form/SelectRow';
import HeaderButton from '@/components/HeaderButton';
import Alert from '@/components/ui/Alert';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// Adding or editing a category, as a modal (web: CategoryForm in a Modal): its name, where it sits in
// the tree, and (for spending) the default monthly budget every month starts from.
// /category-form?kind=Expense, &parentId=3 to add a subcategory, &id=5 to edit.
export default function CategoryFormModal() {
  const t = useTokens();
  const p = useLocalSearchParams<{ kind: CategoryKind; id?: string; parentId?: string }>();
  const categories = useData('categories', getCategories);
  if (!categories.data) {
    return (
      <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: 'Category', headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />
        {categories.error ? <ErrorCard message={categories.error} status={categories.errorStatus} /> : <ActivityIndicator color={t.muted} />}
      </ScrollView>
    );
  }
  const category = p.id ? categories.data.find((c) => c.id === Number(p.id)) : undefined;
  return <CategoryForm kind={p.kind ?? 'Expense'} categories={categories.data} category={category}
    parentId={p.parentId ? Number(p.parentId) : null} />;
}

function CategoryForm({ kind, categories, category, parentId }: {
  kind: CategoryKind;
  categories: Category[];
  category?: Category;
  parentId: number | null;
}) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [values, setValues] = useState<CategoryFormValues>(() => categoryFormValues(category, parentId));
  const set = (patch: Partial<CategoryFormValues>) => { setValues((v) => ({ ...v, ...patch })); setError(null); };
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parents = selectableCategories(categories, kind, values.parentId, category ? withDescendants(category.id, categories) : undefined);
  const parentOf = categories.find((c) => c.id === parentId);

  async function save() {
    const built = buildCategoryRequest(values, kind);
    if (built.error !== undefined) {
      setError(built.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (category) await updateCategory(category.id, built.request);
      else await createCategory(built.request);
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
      automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{
        title: category ? `Edit ${category.name}` : 'Add category',
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
        headerRight: () => <HeaderButton primary title={saving ? 'Saving…' : category ? 'Save' : 'Add'} onPress={save} disabled={saving} />,
      }} />
      {!category && parentOf && <Text style={[styles.subtitle, { color: t.muted }]}>Inside {parentOf.path}</Text>}
      {error && <Alert tone="negative">{error}</Alert>}

      <FormSection footer="Put it under another category to make it a subcategory.">
        <Field label="Name">
          <TextField value={values.name} onChangeText={(name) => set({ name })} placeholder={categoryNamePlaceholder(kind)}
            maxLength={100} autoFocus />
        </Field>
        <SelectRow label="Inside"
          valueLabel={values.parentId === null ? 'Top level (no parent)' : categories.find((c) => c.id === values.parentId)?.path}
          options={[{ label: 'Top level (no parent)', value: null as number | null },
            ...parents.map((c) => ({ label: `${c.path}${c.isArchived ? ' (archived)' : ''}`, value: c.id as number | null }))]}
          onChange={(parent) => set({ parentId: parent })} />
      </FormSection>

      {kind === 'Expense' && (
        <FormSection footer="Optional. Every month starts with this; you can change a single month on the Budget tab.">
          <Field label="Default monthly budget">
            <MoneyInput symbol="£" placeholder="No default" value={values.amount} onChangeText={(amount) => set({ amount })}
              accessibilityLabel="Default monthly budget" />
          </Field>
        </FormSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  subtitle: { fontSize: 15, lineHeight: 20 },
});
