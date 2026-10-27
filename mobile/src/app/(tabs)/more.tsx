import { router, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Screen from '@/components/Screen';
import { useTokens } from '@/theme/tokens';

// The sections that don't fit on the tab bar, as on the web's phone layout (navItems' 'more').
const items: { href: Href; label: string; icon: SFSymbol }[] = [
  { href: '/accounts', label: 'Accounts', icon: 'wallet.bifold' },
  { href: '/insights', label: 'Insights', icon: 'sparkles' },
  { href: '/settings', label: 'Settings', icon: 'gearshape' },
];

export default function MoreScreen() {
  const t = useTokens();
  return (
    <Screen title="More">
      <View style={[styles.list, { backgroundColor: t.surface, borderColor: t.line }]}>
        {items.map((item, i) => (
          <Pressable key={item.label} onPress={() => router.push(item.href)} accessibilityRole="link"
            style={({ pressed }) => [styles.row, i > 0 && { borderTopColor: t.line, borderTopWidth: StyleSheet.hairlineWidth },
              pressed && { backgroundColor: t.surfaceMuted }]}>
            <SymbolView name={item.icon} size={20} tintColor={t.accent} />
            <Text style={[styles.label, { color: t.ink }]}>{item.label}</Text>
            <SymbolView name="chevron.right" size={12} tintColor={t.subtle} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  label: { flex: 1, fontSize: 16 },
});
