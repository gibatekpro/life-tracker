import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import RefreshProvider from '@/data/RefreshProvider';
import { tokens } from '@/theme/tokens';

// The app's outer navigator: a stack holding the tabs and the screens over them (Settings, and the
// transaction form as a modal). ThemeProvider gives the native headers and backgrounds our colours.
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
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
          <Stack.Screen name="transaction" options={{ presentation: 'modal' }} />
        </Stack>
      </RefreshProvider>
    </ThemeProvider>
  );
}
