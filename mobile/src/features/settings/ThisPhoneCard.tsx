import { useEffect, useState } from 'react';
import { Alert as NativeAlert, StyleSheet, Text, TextInput } from 'react-native';

import KeyboardSaveBar from '@/components/form/KeyboardSaveBar';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { clearApiKey, getApiKey, saveApiKey } from '@/lib/apiKey';
import { useTokens } from '@/theme/tokens';

// The phone's own connection (there's no web equivalent): which API it talks to, and its API key.
// The key is pasted here once and kept in the Keychain (see lib/apiKey.ts); this only ever shows
// whether one is saved, never the key itself. A 401 anywhere offers to open this.
export default function ThisPhoneCard() {
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
    if (!draft.trim()) return;
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
    NativeAlert.alert('Clear the API key?', 'The app will stop reaching the API until you paste it again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
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
    <Card title="This phone" description="How this iPhone reaches your API.">
      <Text style={[styles.label, { color: t.muted }]}>API address</Text>
      <Text style={[styles.text, { color: t.ink }]} selectable>
        {process.env.EXPO_PUBLIC_API_URL ?? 'Not set: copy mobile/.env.example to mobile/.env'}
      </Text>

      <Text style={[styles.label, { color: t.muted }]}>API key</Text>
      <Text style={{ color: hasKey ? t.positive : t.warning }}>
        {hasKey === null ? 'Checking…' : hasKey ? 'A key is saved on this phone.' : 'No key saved yet.'}
      </Text>
      <Text style={[styles.hint, { color: t.muted }]}>
        The API asks for it on every request that doesn&apos;t come from the Mac itself. It&apos;s the Security:ApiKey value in the
        API&apos;s user secrets, and it stays in this phone&apos;s Keychain.
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
        inputAccessoryViewID="phone-key"
        accessibilityLabel="API key"
        style={[styles.input, { backgroundColor: t.surfaceMuted, borderColor: t.line, color: t.ink }]}
      />
      <KeyboardSaveBar id="phone-key" label="Save key" onSave={save} disabled={!draft.trim()} />
      <Button title="Save key" onPress={save} disabled={!draft.trim()} />
      {hasKey && <Button title="Clear key" variant="danger" onPress={clear} />}
      {error && <Alert tone="negative">{error}</Alert>}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  text: { fontSize: 15 },
  hint: { fontSize: 13, lineHeight: 18 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 16 },
});
