import {
  buildPurchaseRequest, essentialHint, formatMoney, freeSavingsAccounts, monthsHint, newAccountLabel, planChoices, purchaseFormValues,
  purchaseNamePlaceholder, purchasePreview, targetMonthChoices, toYm, type Account, type PlannedPurchase, type PurchaseFormValues,
} from '@lifetracker/core';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { createPlannedPurchase, getAccounts, getBudgetMonth, getPlannedPurchases, updatePlannedPurchase } from '@/api';
import ErrorAlert from '@/components/ErrorAlert';
import ErrorCard from '@/components/ErrorCard';
import { Field, TextField } from '@/components/form/Field';
import FormRow from '@/components/form/FormRow';
import FormSection from '@/components/form/FormSection';
import MoneyInput from '@/components/form/MoneyInput';
import SelectRow from '@/components/form/SelectRow';
import HeaderButton from '@/components/HeaderButton';
import Segmented from '@/components/ui/Segmented';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// Adding or editing a planned purchase, as a modal (web: PlannedPurchaseForm): /planned-purchase-form
// to add, ?id=3 to edit. One way to plan it (monthly amount, months, or the last month to save in) and
// the other two worked out as I type, by core's calculator. Adding opens the new one.
export default function PlannedPurchaseFormModal() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : undefined;
  // The plan starts from the budget month I'm in now, which follows payday.
  const view = useData('budget-now', () => getBudgetMonth());
  const accounts = useData('accounts', getAccounts);
  const purchases = useData('planned-purchases', getPlannedPurchases);
  const b = view.data?.budget;
  const purchase = purchases.data?.find((p) => p.id === editingId);
  const failed = [view, accounts, purchases].find((d) => d.error);

  if (!b || !accounts.data || !purchases.data || (editingId !== undefined && !purchase)) {
    return (
      <ScrollView style={{ backgroundColor: t.canvas }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title: editingId ? 'Edit' : 'Add a planned purchase', headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />
        {failed ? <ErrorCard message={failed.error!} status={failed.errorStatus} />
          : purchases.data && editingId !== undefined ? <ErrorCard message={`Planned purchase ${editingId} doesn't exist.`} />
          : <ActivityIndicator color={t.muted} />}
      </ScrollView>
    );
  }
  return <PurchaseForm purchase={purchase} currentMonth={toYm(b.year, b.month)} savingsAccounts={freeSavingsAccounts(accounts.data, purchases.data)} />;
}

function PurchaseForm({ purchase, currentMonth, savingsAccounts }: {
  purchase?: PlannedPurchase;
  currentMonth: string;
  savingsAccounts: Account[];
}) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [values, setValues] = useState<PurchaseFormValues>(() => purchaseFormValues(purchase, currentMonth));
  const set = (patch: Partial<PurchaseFormValues>) => { setValues((v) => ({ ...v, ...patch })); setError(null); };
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = purchase !== undefined;
  const saved = purchase?.saved ?? savingsAccounts.find((a) => a.id === values.accountId)?.balance ?? 0;
  const preview = purchasePreview(values, saved, currentMonth, editing);
  const months = targetMonthChoices(currentMonth);
  const chosenAccount = savingsAccounts.find((a) => a.id === values.accountId);

  async function save() {
    const built = buildPurchaseRequest(values, saved, currentMonth, editing);
    if (built.error !== undefined) {
      setError(built.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (purchase) {
        await updatePlannedPurchase(purchase.id, built.request);
        router.back();
      } else {
        const created = await createPlannedPurchase(built.request);
        router.replace(`/planned-purchases/${created.id}`);
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
        title: purchase ? `Edit ${purchase.name}` : 'Add a planned purchase',
        headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
        headerRight: () => <HeaderButton primary title={saving ? 'Saving…' : purchase ? 'Save' : 'Add'} onPress={save} disabled={saving} />,
      }} />
      {!editing && <Text style={[styles.subtitle, { color: t.muted }]}>Its money builds up in a savings account, filled by transfers.</Text>}
      {error && <ErrorAlert message={error} />}

      <FormSection>
        <Field label="Name">
          <TextField value={values.name} onChangeText={(name) => set({ name })} placeholder={purchaseNamePlaceholder} maxLength={100} autoFocus={!editing} />
        </Field>
        <Field label="Target">
          <MoneyInput symbol="£" value={values.target} onChangeText={(target) => set({ target })} accessibilityLabel="Target" />
        </Field>
      </FormSection>

      {preview.kind !== 'reached' && (
        <>
          <Segmented label="Plan by" options={planChoices} value={values.choice} onChange={(choice) => set({ choice })} />
          <FormSection>
            {values.choice === 'monthly' && (
              <Field label="Monthly amount">
                <MoneyInput symbol="£" value={values.monthly} onChangeText={(monthly) => set({ monthly })} accessibilityLabel="Monthly amount" />
              </Field>
            )}
            {values.choice === 'months' && (
              <Field label="Number of months" hint={monthsHint}>
                <TextField value={values.months} onChangeText={(m) => set({ months: m.replace(/[^0-9]/g, '') })} keyboardType="number-pad"
                  placeholder="e.g. 6" accessibilityLabel="Number of months" />
              </Field>
            )}
            {values.choice === 'targetMonth' && (
              <SelectRow label="Last month to save in" valueLabel={months.find((m) => m.value === values.targetMonth)?.label}
                placeholder="Choose a month" options={months} onChange={(targetMonth) => set({ targetMonth })} />
            )}
          </FormSection>
        </>
      )}

      <View style={[styles.preview, { backgroundColor: t.surfaceMuted }]} accessibilityLiveRegion="polite">
        {preview.kind === 'plan' ? (
          <>
            <View style={styles.figures}>
              {preview.figures.map((f) => (
                <View key={f.label} style={styles.figure}>
                  <Text style={[styles.caption, { color: t.muted }]}>{f.label}</Text>
                  <Text style={[styles.figureValue, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit>{f.value}</Text>
                </View>
              ))}
            </View>
            {preview.note && <Text style={[styles.caption, { color: t.muted }]}>{preview.note}</Text>}
          </>
        ) : (
          <Text style={[styles.text, { color: preview.kind === 'error' ? t.negative : t.muted }]}>{preview.message}</Text>
        )}
      </View>

      <FormSection footer={essentialHint}>
        <FormRow label="Essential">
          <Switch value={values.isEssential} onValueChange={(isEssential) => set({ isEssential })} trackColor={{ true: t.accent }}
            accessibilityLabel="Essential" />
        </FormRow>
      </FormSection>

      {!editing && (
        <FormSection footer="Money goes in as transfers from a current account.">
          <SelectRow label="Save into" valueLabel={chosenAccount ? `${chosenAccount.name} (${formatMoney(chosenAccount.balance)})` : newAccountLabel}
            options={[{ label: newAccountLabel, value: null as number | null },
              ...savingsAccounts.map((a) => ({ label: `${a.name} (${formatMoney(a.balance)})`, value: a.id as number | null }))]}
            onChange={(accountId) => set({ accountId })} />
        </FormSection>
      )}

      <FormSection footer="Optional, e.g. when it's due.">
        <Field label="Notes">
          <TextField value={values.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={1000} accessibilityLabel="Notes" />
        </Field>
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  text: { fontSize: 14, lineHeight: 20 },
  preview: { borderRadius: 14, padding: 14, gap: 8 },
  figures: { flexDirection: 'row', gap: 12 },
  figure: { flex: 1, gap: 2 },
  caption: { fontSize: 12, lineHeight: 16 },
  figureValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
