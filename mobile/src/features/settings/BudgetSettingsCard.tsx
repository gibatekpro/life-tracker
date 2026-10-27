import {
  budgetSettingsValues, buildBudgetSettings, earlyIncomeChoices, incomeModeChoices, incomeModeHint, startDayChoices, startDayHint,
  type BudgetSettingsValues, type Settings,
} from '@lifetracker/core';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { updateSettings } from '@/api';
import { Field } from '@/components/form/Field';
import FormSection from '@/components/form/FormSection';
import KeyboardSaveBar from '@/components/form/KeyboardSaveBar';
import MoneyInput from '@/components/form/MoneyInput';
import SelectRow from '@/components/form/SelectRow';
import Button from '@/components/ui/Button';
import Segmented from '@/components/ui/Segmented';
import { useRefresh } from '@/data/refresh';
import { useTokens } from '@/theme/tokens';

// Income, the debt budget and when a budget month starts (web: BudgetForm in SettingsPage). Keyed by
// the settings' updatedAt by its parent, so the inputs start from the saved values.
export default function BudgetSettingsForm({ settings }: { settings: Settings }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [values, setValues] = useState<BudgetSettingsValues>(() => budgetSettingsValues(settings));
  const set = (patch: Partial<BudgetSettingsValues>) => { setValues((v) => ({ ...v, ...patch })); setStatus(null); };
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setStatus(null);
    const built = buildBudgetSettings(values);
    if (built.error !== undefined) return setStatus({ ok: false, text: built.error });
    try {
      await updateSettings(built.request);
      setStatus({ ok: true, text: 'Saved' });
      refresh();
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[styles.label, { color: t.ink }]}>Measure spending against</Text>
      <Segmented label="Measure spending against" options={incomeModeChoices} value={values.incomeMode}
        onChange={(incomeMode) => set({ incomeMode })} />
      <Text style={[styles.hint, { color: t.muted }]}>{incomeModeHint(values.incomeMode)}</Text>

      <FormSection>
        {values.incomeMode === 'Fixed' && (
          <Field label="Monthly take-home pay">
            <MoneyInput symbol="£" value={values.income} onChangeText={(income) => set({ income })}
              accessibilityLabel="Monthly take-home pay" inputAccessoryViewID="budget-settings" />
          </Field>
        )}
        {values.incomeMode === 'Recorded' && (
          <SelectRow label="Count income paid early" valueLabel={earlyIncomeChoices.find((c) => c.value === values.earlyDays)?.label}
            options={earlyIncomeChoices} onChange={(earlyDays) => set({ earlyDays })} />
        )}
        <SelectRow label="Budget month starts on" valueLabel={startDayChoices.find((c) => c.value === values.startDay)?.label}
          options={startDayChoices} onChange={(startDay) => set({ startDay })} />
        <Field label="Monthly debt budget" hint="Optional. A fixed amount for all debts; when one is cleared, its payment rolls on to the rest.">
          <MoneyInput symbol="£" placeholder="Not set" value={values.debtBudget} onChangeText={(debtBudget) => set({ debtBudget })}
            accessibilityLabel="Monthly debt budget" inputAccessoryViewID="budget-settings" />
        </Field>
      </FormSection>
      <Text style={[styles.hint, { color: t.muted }]}>
        {values.incomeMode === 'Recorded' ? "A salary paid a few days before payday (a weekend) counts towards the month it's for. " : ''}
        {startDayHint(values.startDay)}
      </Text>

      <KeyboardSaveBar id="budget-settings" label="Save budget" onSave={save} />
      <View style={styles.footer}>
        {status && (
          <View style={styles.status}>
            {status.ok && <SymbolView name="checkmark" size={14} tintColor={t.positive} />}
            <Text accessibilityRole="text" style={{ color: status.ok ? t.positive : t.negative, fontSize: 14 }}>{status.text}</Text>
          </View>
        )}
        <Button title="Save budget" onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  label: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 12, lineHeight: 17 },
  footer: { gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
});
