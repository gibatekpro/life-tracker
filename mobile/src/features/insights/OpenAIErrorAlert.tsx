import { isKeyNotConfigured } from '@lifetracker/core';
import { StyleSheet, Text } from 'react-native';

import ErrorAlert from '@/components/ErrorAlert';
import Alert from '@/components/ui/Alert';
import { useTokens } from '@/theme/tokens';

// An error from asking OpenAI (an insight or advice; web: OpenAIError): with no key set up, how to set
// one; otherwise the API's own friendly message.
export default function OpenAIErrorAlert({ error }: { error: string }) {
  const t = useTokens();
  if (!isKeyNotConfigured(error)) return <ErrorAlert message={error} />;
  return (
    <Alert tone="negative">
      <Text style={[styles.strong, { color: t.ink }]}>No OpenAI key is set up yet.</Text>
      <Text style={[styles.text, { color: t.ink }]}>
        In the <Text style={styles.mono}>api</Text> folder, run{' '}
        <Text style={styles.mono} selectable>dotnet user-secrets set &quot;OpenAI:ApiKey&quot; &quot;&lt;your key&gt;&quot;</Text>{' '}
        and restart the API. The key stays in the API; this app never sees it.
      </Text>
    </Alert>
  );
}

const styles = StyleSheet.create({
  strong: { fontSize: 14, fontWeight: '600' },
  text: { fontSize: 14, lineHeight: 21 },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
});
