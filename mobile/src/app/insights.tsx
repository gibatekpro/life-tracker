import {
  formatDateTime, formatMoney, generateLabel, generatingNote, insightFooter, insightsForMonth, isKeyNotConfigured, monthName,
  parseYm, periodLabel, savingsNote, shiftMonth, shownInsight, toYm, type Insight,
} from '@lifetracker/core';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert as NativeAlert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteInsight, generateInsight, getBudgetMonth, getInsights } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import MonthNav from '@/components/MonthNav';
import Screen from '@/components/Screen';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import { useTokens } from '@/theme/tokens';

// AI insights for a budget month (web: InsightsPage). Generate asks my API, which sends OpenAI a summary
// of the month (categories, merchants, budgets and debts; no account numbers, ids or aliases) and saves
// the answer. The phone never talks to OpenAI. A month's latest insight is shown until I regenerate it,
// and "What was sent" shows exactly what OpenAI saw.
export default function InsightsScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const [ym, setYm] = useState<string | null>(null); // null: the budget month I'm in now
  const view = useData(`budget-${ym ?? 'now'}`, () => {
    if (!ym) return getBudgetMonth();
    const { year, month } = parseYm(ym);
    return getBudgetMonth(year, month);
  });
  const insights = useData('insights', getInsights);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const b = view.data?.budget;
  const shownYm = b ? toYm(b.year, b.month) : null;
  const forMonth = b ? insightsForMonth(insights.data ?? [], b.year, b.month) : [];
  const shown = shownInsight(forMonth, selectedId);
  const failed = [view, insights].find((d) => d.error);

  function goTo(month: string, id: number | null = null) {
    setSelectedId(id);
    setError(null);
    setShowPrompt(false);
    setYm(month);
  }

  async function generate() {
    if (!b) return;
    setGenerating(true);
    setError(null);
    try {
      const insight = await generateInsight(b.year, b.month, shown !== undefined);
      setSelectedId(insight.id);
      setShowPrompt(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const confirmDelete = (insight: Insight) =>
    NativeAlert.alert('Delete this insight?', 'Generating again asks OpenAI afresh.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setError(null);
          try {
            await deleteInsight(insight.id);
            setSelectedId(null);
            refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);

  return (
    <Screen description="An AI read of a budget month: possible waste, ways to save, and how it fits with paying off debt."
      refreshing={insights.loading && !!insights.data} onRefresh={refresh}>
      {b && <Button title={generateLabel(generating, shown !== undefined)} onPress={generate} disabled={generating || (insights.loading && !insights.data)} />}

      <MonthNav label={b ? periodLabel(b) : '…'}
        onPrevious={() => shownYm && goTo(shiftMonth(shownYm, -1))} onNext={() => shownYm && goTo(shiftMonth(shownYm, 1))}
        previousDisabled={!shownYm || generating} nextDisabled={!shownYm || generating} />

      {failed && <ErrorCard message={failed.error!} status={failed.errorStatus} />}
      {error && (isKeyNotConfigured(error) ? (
        <Alert tone="negative">
          <Text style={[styles.strong, { color: t.ink }]}>No OpenAI key is set up yet.</Text>
          <Text style={[styles.text, { color: t.ink }]}>
            In the <Text style={styles.mono}>api</Text> folder, run{' '}
            <Text style={styles.mono} selectable>dotnet user-secrets set &quot;OpenAI:ApiKey&quot; &quot;&lt;your key&gt;&quot;</Text>{' '}
            and restart the API. The key stays in the API; this app never sees it.
          </Text>
        </Alert>
      ) : <Alert tone="negative">{error}</Alert>)}
      {generating && <Alert>{generatingNote(b?.year, b?.month)}</Alert>}

      {!b || !insights.data ? <ActivityIndicator color={t.muted} /> : (
        <>
          <View style={generating && styles.dimmed}>
            {!shown ? (
              <Card>
                <EmptyState icon="sparkles" title="No insight for this month yet"
                  action={<Button title="Generate" onPress={generate} disabled={generating} />}>
                  Your API sends OpenAI a summary of this month&apos;s spending, budgets and debts, and saves what comes back. Account numbers, ids and aliases are left out.
                </EmptyState>
              </Card>
            ) : (
              <InsightView insight={shown} showPrompt={showPrompt} onTogglePrompt={() => setShowPrompt((s) => !s)}
                onDelete={() => confirmDelete(shown)} />
            )}
          </View>

          <Card title="Past insights">
            {insights.data.length === 0 ? <Text style={[styles.text, { color: t.muted }]}>None yet.</Text> : insights.data.map((i) => (
              <Pressable key={i.id} onPress={() => goTo(toYm(i.year, i.month), i.id)} accessibilityRole="button"
                accessibilityState={{ selected: shown?.id === i.id }}
                style={({ pressed }) => [styles.past, shown?.id === i.id && { backgroundColor: t.accentSoft }, pressed && { opacity: 0.6 }]}>
                <Text style={[styles.pastMonth, { color: t.ink }]}>{monthName(i.year, i.month)}</Text>
                <Text style={[styles.small, { color: t.muted }]}>{formatDateTime(i.createdAt)}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function InsightView({ insight, showPrompt, onTogglePrompt, onDelete }: {
  insight: Insight;
  showPrompt: boolean;
  onTogglePrompt: () => void;
  onDelete: () => void;
}) {
  const t = useTokens();
  const r = insight.result;
  const line = { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth };

  return (
    <View style={styles.view}>
      <Card title="Summary"><Text style={[styles.text, { color: t.ink }]}>{r.summary}</Text></Card>

      <Card title="Possible waste" description="Spending that might not be worth what it costs.">
        {r.wasteItems.length === 0 ? <Text style={[styles.text, { color: t.muted }]}>Nothing stood out this month.</Text>
          : r.wasteItems.map((w, n) => (
            <View key={n} style={[styles.item, n > 0 && line]}>
              <View style={styles.itemTop}>
                <Text style={[styles.itemName, { color: t.ink }]}>{w.name}</Text>
                <Text style={[styles.money, { color: t.ink }]}>{formatMoney(w.monthlyAmount)}<Text style={{ color: t.muted }}>/month</Text></Text>
              </View>
              {w.reason ? <Text style={[styles.text, { color: t.muted }]}>{w.reason}</Text> : null}
            </View>
          ))}
      </Card>

      <Card title="Ways to save" description={savingsNote(insight) ?? undefined}>
        {r.savingTips.length === 0 ? <Text style={[styles.text, { color: t.muted }]}>No suggestions this time.</Text>
          : r.savingTips.map((tip, n) => (
            <View key={n} style={[styles.itemTop, styles.item, n > 0 && line]}>
              <Text style={[styles.text, styles.tip, { color: t.ink }]}>{tip.tip}</Text>
              <Text style={[styles.money, { color: t.positive, fontWeight: '500' }]}>
                {formatMoney(tip.estimatedMonthlySaving)}<Text style={{ color: t.muted, fontWeight: '400' }}>/month</Text>
              </Text>
            </View>
          ))}
      </Card>

      <Card title="Debt advice"><Text style={[styles.text, { color: t.ink }]}>{r.debtAdvice}</Text></Card>

      <View style={[styles.footer, { backgroundColor: t.surfaceMuted }]}>
        <Text style={[styles.small, { color: t.muted }]}>{insightFooter(insight)}</Text>
        <Pressable onPress={onDelete} accessibilityRole="button" style={styles.delete} hitSlop={8}>
          <SymbolView name="trash" size={14} tintColor={t.negative} />
          <Text style={[styles.deleteText, { color: t.negative }]}>Delete</Text>
        </Pressable>
        <Text style={[styles.small, { color: t.muted }]}>General information from an AI, not financial advice.</Text>
        <View style={[styles.prompt, line]}>
          <Pressable onPress={onTogglePrompt} accessibilityRole="button" accessibilityState={{ expanded: showPrompt }} style={styles.toggle}>
            <SymbolView name={showPrompt ? 'chevron.down' : 'chevron.right'} size={11} tintColor={t.ink} />
            <Text style={[styles.strong, { color: t.ink }]}>What was sent</Text>
          </Pressable>
          {showPrompt && (
            <Text selectable style={[styles.sent, { color: t.ink, backgroundColor: t.surface, borderColor: t.line }]}>{insight.promptSent}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: 16 },
  dimmed: { opacity: 0.6 },
  text: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 17 },
  strong: { fontSize: 14, fontWeight: '600' },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
  item: { paddingVertical: 10, gap: 4 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '500' },
  tip: { flex: 1 },
  money: { fontSize: 14, fontVariant: ['tabular-nums'] },
  footer: { borderRadius: 12, padding: 14, gap: 8 },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  deleteText: { fontSize: 14, fontWeight: '500' },
  prompt: { paddingTop: 10, gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sent: { fontFamily: 'Menlo', fontSize: 11, lineHeight: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 10 },
  past: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, marginHorizontal: -8 },
  pastMonth: { fontSize: 14, fontWeight: '500' },
});
