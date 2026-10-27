import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import RefreshProvider from '@/data/RefreshProvider';
import { tokens } from '@/theme/tokens';

// Development only: EXPO_PUBLIC_DEV_START_ROUTE=/plan opens that screen on launch, for checking a screen on
// the iOS Simulator, where a script can't tap. Unset (always, on the phone) it does nothing.
const devStartRoute = __DEV__ ? process.env.EXPO_PUBLIC_DEV_START_ROUTE : undefined;

// The app's outer navigator: a stack holding the tabs, the sections pushed over them (from More,
// or from links on other screens) and the forms as modals. ThemeProvider gives the native headers
// and backgrounds our colours.
export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  useEffect(() => {
    if (!devStartRoute) return;
    const id = setTimeout(() => router.push(devStartRoute as Href), 1000);
    return () => clearTimeout(id);
  }, []);
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
          <Stack.Screen name="budget-line" options={{ presentation: 'modal' }} />
        </Stack>
      </RefreshProvider>
    </ThemeProvider>
  );
}
