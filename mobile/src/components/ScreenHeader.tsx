import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A tab's large title with its buttons: an optional "+" (onAdd) and Settings.
// Used by Screen, and as the header of a list (which can't sit inside Screen's ScrollView).
export default function ScreenHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  const t = useTokens();
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">{title}</Text>
      <View style={styles.buttons}>
        {onAdd && (
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="New transaction" hitSlop={12}>
            <SymbolView name="plus.circle.fill" size={28} tintColor={t.accent} />
          </Pressable>
        )}
        <Link href="/settings" asChild>
          <Pressable accessibilityLabel="Settings" hitSlop={12}>
            <SymbolView name="gearshape" size={24} tintColor={t.muted} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  title: { fontSize: 32, fontWeight: '700' },
});
