import { budgetLineNote, formatMoney, lineTone, plannedLabel, type BudgetLine } from '@lifetracker/core';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RowContext } from '@/components/tree/CollapsibleTree';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { useTokens } from '@/theme/tokens';
import NoteParts from './NoteParts';

// One category's line (web: BudgetLineRow): spent of planned (tap the planned amount to change it),
// a progress bar, and what's left. A line with subcategories opens and closes them by its name.
export default function BudgetLineRow({ line, context: { depth, expandable, expanded, toggle }, daysLeft, onEdit }: {
  line: BudgetLine;
  context: RowContext;
  daysLeft: number;
  onEdit: () => void;
}) {
  const t = useTokens();
  const tone = lineTone(line.planned, line.spent, line.projected, daysLeft);
  const name = (
    <Text style={[styles.name, { color: t.ink, fontWeight: depth === 0 ? '600' : '500' }]} numberOfLines={1}>{line.name}</Text>
  );

  return (
    <View style={[styles.row, { paddingLeft: Math.min(depth, 4) * 16 }]}>
      <View style={styles.top}>
        <View style={styles.title}>
          {expandable ? (
            <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle}
              accessibilityLabel={`${line.name}, ${line.children.length} subcategories`}>
              <SymbolView name={expanded ? 'chevron.down' : 'chevron.right'} size={11} tintColor={t.muted} />
              {name}
            </Pressable>
          ) : (
            <>{depth > 0 && <Text style={{ color: t.subtle }}>└</Text>}{name}</>
          )}
          {line.isArchived && <Badge>Archived</Badge>}
          {line.monthAmount !== null && <Badge tone="accent">This month</Badge>}
        </View>
        <Text style={[styles.figures, { color: t.ink }]}>
          {formatMoney(line.spent)} <Text style={{ color: t.muted }}>of </Text>
          <Text onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Change the ${line.name} budget`}
            style={[styles.planned, { textDecorationColor: t.subtle }]}>{plannedLabel(line.planned)}</Text>
        </Text>
      </View>
      {line.planned > 0 && <ProgressBar label={`${line.name} budget used`} value={line.spent / line.planned} tone={tone} />}
      <NoteParts parts={budgetLineNote(line, daysLeft, expandable && !expanded)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, gap: 6 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 15, flexShrink: 1 },
  figures: { fontSize: 14, fontVariant: ['tabular-nums'] },
  planned: { fontWeight: '600', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
