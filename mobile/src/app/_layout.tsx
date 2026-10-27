import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import RefreshProvider from '@/data/RefreshProvider';
import { tokens } from '@/theme/tokens';

// The app's outer navigator: a stack holding the tabs, the sections pushed over them (from More,
// or from links on other screens) and the forms as modals. ThemeProvider gives the native headers
// and backgrounds our colours.
export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const t = isDark ? tokens.dark : tokens.light;
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: t.accent, background: t.canvas, card: t.surface, text: t.ink, border: t.line },
  };

  return (
    <ThemeProvider value={theme}>
      <RefreshProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerBackTitle: 'Back' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="accounts/index" options={{ title: 'Accounts' }} />
          <Stack.Screen name="accounts/[id]" options={{ title: 'Account' }} />
          <Stack.Screen name="insights" options={{ title: 'Insights' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account-form" options={{ presentation: 'modal' }} />
        </Stack>
      </RefreshProvider>
    </ThemeProvider>
  );
}
