import { router } from 'expo-router';
import { Text } from 'react-native';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { useTokens } from '@/theme/tokens';

// A load that failed: the message, then "Open Settings" when the API key is the problem (401),
// otherwise "Try again" (which reloads everything on screen).
export default function ErrorCard({ message, status }: { message: string; status?: number }) {
  const t = useTokens();
  const { refresh } = useRefresh();
  return (
    <Card style={{ backgroundColor: t.negativeSoft, borderColor: t.negativeSoft }}>
      <Text style={{ color: t.negative, fontSize: 15 }}>{message}</Text>
      {status === 401
        ? <Button title="Open Settings" onPress={() => router.push('/settings')} />
        : <Button title="Try again" variant="secondary" onPress={refresh} />}
    </Card>
  );
}
