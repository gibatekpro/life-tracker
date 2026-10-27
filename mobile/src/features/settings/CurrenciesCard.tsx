import { describeSource, rateCurrencies, rateEditLabel, rateEditStart, rateLabel, type ExchangeRate } from '@lifetracker/core';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { clearExchangeRate, getExchangeRates, getSettings, setExchangeRate, updateSettings } from '@/api';
import KeyboardSaveBar from '@/components/form/KeyboardSaveBar';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// One direction: "£1 = ₦1,811.5", where it comes from, and changing my own rate in place (web: RateRow).
function RateRow({ r }: { r: ExchangeRate }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const barId = `rate-${r.from}-${r.to}`;

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      setEditing(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const save = () => run(() => setExchangeRate(r.from, r.to, Number(value)));
  const link = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}><Text style={[styles.link, { color: t.accent }]}>{label}</Text></Pressable>
  );

  return (
    <View style={styles.row}>
      <Text style={[styles.rate, { color: t.ink }]}>{rateLabel(r)}<Text style={[styles.small, { color: t.muted }]}>   {r.from} → {r.to}</Text></Text>
      <View style={styles.source}>
        {r.source === 'Manual' && <Badge tone="accent">Yours</Badge>}
        <Text style={[styles.small, { color: t.muted }]}>{describeSource(r)}</Text>
      </View>
      {editing ? (
        <View style={styles.edit}>
          <TextInput value={value} onChangeText={(s) => setValue(s.replace(',', '.'))} keyboardType="decimal-pad" autoFocus
            accessibilityLabel={`${r.from} to ${r.to} rate`} inputAccessoryViewID={barId}
            style={[styles.input, { color: t.ink, backgroundColor: t.surfaceMuted, borderColor: t.line }]} />
          <KeyboardSaveBar id={barId} label="Save rate" onSave={save} disabled={value.trim() === ''} />
          {link('Save', save)}
          {link('Cancel', () => setEditing(false))}
        </View>
      ) : (
        <View style={styles.edit}>
          {link(rateEditLabel(r), () => { setValue(rateEditStart(r)); setEditing(true); })}
          {r.manualRate !== null && link('Clear', () => run(() => clearExchangeRate(r.from, r.to)))}
        </View>
      )}
      {error && <Text style={[styles.small, { color: t.negative }]}>{error}</Text>}
    </View>
  );
}

// The exchange rates used to value other currencies in pounds and pre-fill transfers (web: CurrenciesCard),
// one per direction, since sending money and converting it back are usually at different rates.
export default function CurrenciesCard() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const rates = useData('rates', getExchangeRates);
  const settings = useData('settings', getSettings);
  const [error, setError] = useState<string | null>(null);
  const currencies = rateCurrencies(rates.data ?? []);
  const s = settings.data;

  async function toggleTransferRates(useTransferRates: boolean) {
    if (!s) return;
    setError(null);
    try {
      await updateSettings({ monthlyIncome: s.monthlyIncome, monthlyDebtBudget: s.monthlyDebtBudget, useTransferRates });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card title="Currencies"
      description="Rates for valuing other currencies in pounds and pre-filling transfers. Each direction can differ; set one and the other uses its inverse.">
      {!rates.data ? <ActivityIndicator color={t.muted} /> : currencies.length === 0 ? (
        <EmptyState icon="arrow.left.arrow.right" title="Only pounds so far">Add an account in another currency to set its rates.</EmptyState>
      ) : currencies.map((c) => (
        <View key={c}>
          <Text style={[styles.heading, { color: t.muted }]}>{c}</Text>
          {rates.data!.filter((r) => r.from === c || r.to === c).map((r, i) => (
            <View key={`${r.from}-${r.to}`} style={i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth }}>
              <RateRow r={r} />
            </View>
          ))}
        </View>
      ))}

      {s && (
        <View style={[styles.toggle, { backgroundColor: t.surfaceMuted }]}>
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: t.ink }]}>Always use my latest transfer&apos;s rate</Text>
            <Text style={[styles.small, { color: t.muted }]}>Your own rates are then only used until there&apos;s a transfer to take a rate from.</Text>
          </View>
          <Switch value={s.useTransferRates} onValueChange={toggleTransferRates} trackColor={{ true: t.accent }}
            accessibilityLabel="Always use my latest transfer's rate" />
        </View>
      )}
      {error && <Alert tone="negative">{error}</Alert>}
      <Text style={[styles.small, { color: t.muted }]}>Changing a rate never changes the £ value already stored on past transactions.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },
  row: { paddingVertical: 10, gap: 4 },
  rate: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  source: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { fontSize: 12, lineHeight: 17, fontWeight: '400' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  link: { fontSize: 15, fontWeight: '500' },
  input: { width: 120, fontSize: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12 },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 14, fontWeight: '500' },
});
