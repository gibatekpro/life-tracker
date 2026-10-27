import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A tab's large title and description (web: PageHeader), with an optional "+" (onAdd) that opens
// a new transaction. Used by Screen, and as the header of a list (which can't sit inside a ScrollView).
export default function ScreenHeader({ title, description, onAdd }: { title: string; description?: string; onAdd?: () => void }) {
  const t = useTokens();
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">{title}</Text>
        {onAdd && (
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="New transaction" hitSlop={12}>
            <SymbolView name="plus.circle.fill" size={30} tintColor={t.accent} />
          </Pressable>
        )}
      </View>
      {description ? <Text style={[styles.description, { color: t.muted }]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 32, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 20 },
});
