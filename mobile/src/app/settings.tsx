import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { clearApiKey, getApiKey, saveApiKey } from '@/lib/apiKey';
import { useTokens } from '@/theme/tokens';

// Pushed over the tabs from the gear button; the stack gives it a native header.
// The API key is pasted here once and kept in the Keychain (see lib/apiKey.ts). The screen
// only ever shows whether a key is saved, never the key itself.
export default function SettingsScreen() {
  const t = useTokens();
  const { refresh } = useRefresh(); // so screens behind this one reload with the new key
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null while checking
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApiKey().then(
      (key) => setHasKey(!!key),
      () => setError("Couldn't read the Keychain."),
    );
  }, []);

  const save = async () => {
    setError(null);
    try {
      await saveApiKey(draft);
      setDraft('');
      setHasKey(true);
      refresh();
    } catch {
      setError("Couldn't save the key.");
    }
  };

  const clear = () =>
    Alert.alert('Clear the API key?', 'The app will stop reaching the API until you paste it again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await clearApiKey();
            setHasKey(false);
            refresh();
          } catch {
            setError("Couldn't clear the key.");
          }
        },
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: t.canvas }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <Text style={[styles.heading, { color: t.ink }]}>API key</Text>
        <Text style={{ color: hasKey ? t.positive : t.warning }}>
          {hasKey === null ? 'Checking…' : hasKey ? 'A key is saved on this phone.' : 'No key saved yet.'}
        </Text>
        <Text style={[styles.hint, { color: t.muted }]}>
          The API asks for it on every request that doesn&apos;t come from the Mac itself. It&apos;s the
          Security:ApiKey value in the API&apos;s user secrets, and it stays in this phone&apos;s Keychain.
        </Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={hasKey ? 'Paste a new key to replace it' : 'Paste the API key'}
          placeholderTextColor={t.subtle}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          style={[styles.input, { backgroundColor: t.surfaceMuted, borderColor: t.line, color: t.ink }]}
        />
        <Button title="Save key" onPress={save} disabled={!draft.trim()} />
        {hasKey && <Button title="Clear key" variant="danger" onPress={clear} />}
        {error && <Text style={{ color: t.negative }}>{error}</Text>}
      </Card>

      <Card>
        <Text style={[styles.heading, { color: t.ink }]}>API address</Text>
        <Text style={{ color: t.muted }} selectable>
          {process.env.EXPO_PUBLIC_API_URL ?? 'Not set: copy mobile/.env.example to mobile/.env'}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 17, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 16 },
});
