import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { unauthorizedMessage } from '@/api';
import Alert from '@/components/ui/Alert';
import { useTokens } from '@/theme/tokens';

// A save or action that failed: the API's message, and "Open Settings" when it was a 401 (the API key
// missing or wrong), where the key can be set. Loads that fail use ErrorCard, which does the same.
export default function ErrorAlert({ message }: { message: string }) {
  const t = useTokens();
  return (
    <Alert tone="negative">
      <Text style={[styles.text, { color: t.ink }]}>{message}</Text>
      {message === unauthorizedMessage && (
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: t.accent }]}>Open Settings</Text>
        </Pressable>
      )}
    </Alert>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600' },
});
