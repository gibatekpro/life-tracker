import {
  buildTransactionRequest, categoryLevels, currencySymbol, describeForm, formatMoney, initialFormValues, nextEntry,
  ukTodayIso, withAccount, withType,
  type Account, type FormData, type Transaction, type TransactionDraft, type TransactionFormValues,
} from '@lifetracker/core';
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createTransaction, deleteTransaction, updateTransaction } from '@/api';
import DateRow from '@/components/form/DateRow';
import FormSection from '@/components/form/FormSection';
import MoneyInput from '@/components/form/MoneyInput';
import SelectRow, { type SelectOption } from '@/components/form/SelectRow';
import TypeControl from '@/components/form/TypeControl';
import HeaderButton from '@/components/HeaderButton';
import Button from '@/components/ui/Button';
import { useRefresh } from '@/data/refresh';
import { useTokens } from '@/theme/tokens';

// Accounts in the order I think about them: money I have, then cards, then loans.
const groupOrder: Account['type'][] = ['Current', 'CreditCard', 'Loan'];
const accountOptions = (accounts: Account[]): SelectOption<number>[] =>
  groupOrder.flatMap((type) => accounts.filter((a) => a.type === type))
    .map((a) => ({ label: `${a.name}${a.currency !== 'GBP' ? ` (${a.currency})` : ''}`, value: a.id }));

// The phone's transaction form, the native counterpart of the web's TransactionForm: the rules
// (what it starts with, the received amount from the rate, the request) are core's transactionForm.ts.
//
// Save sits in the navigation bar, where the keyboard can't cover it. With onDone (the modal), saving
// or deleting closes it; without (the Add tab), saving clears the form for the next entry on the
// same account and type.
export default function TransactionForm({ data, draft, transaction, onDone }: {
  data: FormData;
  draft?: TransactionDraft;
  transaction?: Transaction;
  onDone?: () => void;
}) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const editing = transaction !== undefined;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [values, setValues] = useState<TransactionFormValues>(() =>
    initialFormValues({ ...data, draft, transaction, today: ukTodayIso() }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null); // "Saved Tesco, £12.40" on the Add tab
  const [busy, setBusy] = useState(false);

  const view = describeForm(values, data);
  const { isTransfer, from, to, fromCurrency, crossesCurrencies, asksForPounds } = view;
  const levels = isTransfer ? [] : categoryLevels(data.categories, view.categoryKind, view.chosenCategoryId);

  const change = (next: TransactionFormValues) => {
    setValues(next);
    setError(null);
    setSaved(null);
  };

  const fail = (message: string) => {
    setError(message);
    scrollRef.current?.scrollTo({ y: 0 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  async function save() {
    const built = buildTransactionRequest(values, view);
    if (built.error !== undefined) return fail(built.error);
    setBusy(true);
    setError(null);
    try {
      if (transaction) await updateTransaction(transaction.id, built.request);
      else await createTransaction(built.request);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (onDone) onDone();
      else {
        setValues(nextEntry(values, data.categories, ukTodayIso()));
        setSaved(`Saved ${built.request.description}, ${formatMoney(built.request.amount, fromCurrency)}`);
        amountRef.current?.focus();
      }
      refresh();
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!transaction) return;
    Alert.alert(
      `Delete ${transaction.description || 'this transaction'}?`,
      `${formatMoney(transaction.amount, transaction.currency)}. Balances go back as if it never happened.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteTransaction(transaction.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onDone?.();
              refresh();
            } catch (e) {
              fail((e as Error).message);
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  const noAccounts = data.accounts.length === 0;

  return (
    <>
      <Stack.Screen options={{
        headerRight: () => (
          <HeaderButton primary title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy || noAccounts} />
        ),
      }} />

      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: t.canvas }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {error && <Text style={[styles.banner, { color: t.negative, backgroundColor: t.negativeSoft }]}>{error}</Text>}
        {saved && <Text style={[styles.banner, { color: t.positive, backgroundColor: t.accentSoft }]}>{saved}</Text>}
        {noAccounts && <Text style={[styles.banner, { color: t.warning, backgroundColor: t.surfaceMuted }]}>
          Add an account on the web first.
        </Text>}

        <TypeControl value={values.type} onChange={(type) => change(withType(values, type, data.categories))} />

        <FormSection footer={crossesCurrencies ? view.receivedHint : undefined}>
          <View>
            <Text style={[styles.caption, { color: t.muted }]}>{crossesCurrencies ? `Sent (${fromCurrency})` : 'Amount'}</Text>
            <MoneyInput large ref={amountRef} symbol={currencySymbol(fromCurrency)} autoFocus={!editing}
              accessibilityLabel={crossesCurrencies ? 'Amount sent' : 'Amount'}
              value={values.amount} onChangeText={(amount) => change({ ...values, amount })} />
          </View>
          {crossesCurrencies && (
            <View>
              <Text style={[styles.caption, { color: t.muted }]}>Received ({to!.currency})</Text>
              <MoneyInput symbol={currencySymbol(to!.currency)} accessibilityLabel="Amount received"
                value={view.receivedShown}
                onChangeText={(toAmount) => change({ ...values, toAmount, toAmountTyped: true })} />
            </View>
          )}
        </FormSection>

        <FormSection>
          <SelectRow label={isTransfer ? 'From' : 'Account'} options={accountOptions(data.accounts)}
            valueLabel={from && accountOptions([from])[0].label}
            onChange={(id) => change(withAccount(values, id))} />
          {isTransfer && (
            <SelectRow label="To" options={accountOptions(data.accounts.filter((a) => a.id !== values.accountId))}
              valueLabel={to && accountOptions([to])[0].label} placeholder="Choose an account"
              onChange={(toAccountId) => change({ ...values, toAccountId })} />
          )}
          {levels.map(({ parent, options, selected }, depth) => (
            <SelectRow key={parent?.id ?? 'top'} label={parent ? `Within ${parent.name}` : 'Category'}
              valueLabel={selected?.name ?? (parent ? `${parent.name} itself` : undefined)}
              options={[
                // Spending can be filed on a parent too.
                ...(parent ? [{ label: `${parent.name} itself`, value: parent.id }] : []),
                ...options.map((c) => ({ label: `${c.name}${c.isArchived ? ' (archived)' : ''}`, value: c.id })),
              ]}
              onChange={(categoryId) => change({ ...values, categoryId })}
              placeholder={depth === 0 ? 'Choose' : undefined} />
          ))}
          <DateRow label="Date" value={values.date} onChange={(date) => change({ ...values, date })} />
        </FormSection>

        <FormSection footer={isTransfer ? 'Optional for transfers' : undefined}>
          <View>
            <Text style={[styles.caption, { color: t.muted }]}>Description</Text>
            <TextInput
              value={values.description}
              onChangeText={(description) => change({ ...values, description })}
              placeholder={isTransfer ? (to ? `Payment to ${to.name}` : 'e.g. Card repayment') : 'e.g. Tesco'}
              placeholderTextColor={t.subtle}
              maxLength={200}
              returnKeyType="done"
              style={[styles.text, { color: t.ink }]}
            />
          </View>
        </FormSection>

        {asksForPounds && (
          <FormSection footer={editing
            ? 'Clear it to recalculate at the exchange rate.'
            : "Optional. Left blank, it's worked out at the exchange rate (set on the web in Settings → Currencies)."}>
            <View>
              <Text style={[styles.caption, { color: t.muted }]}>Value in pounds</Text>
              <MoneyInput symbol="£" accessibilityLabel="Value in pounds" value={values.gbpAmount}
                placeholder={view.estimatedPounds ? `Automatic: ≈ ${view.estimatedPounds}` : 'Automatic'}
                onChangeText={(gbpAmount) => change({ ...values, gbpAmount })} />
            </View>
          </FormSection>
        )}

        {editing && <Button title="Delete transaction" variant="danger" onPress={confirmDelete} disabled={busy} />}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  banner: { fontSize: 15, lineHeight: 20, padding: 12, borderRadius: 10, overflow: 'hidden' },
  caption: { fontSize: 13, fontWeight: '500', paddingTop: 10 },
  text: { fontSize: 17, paddingVertical: 10, minHeight: 44 },
});
