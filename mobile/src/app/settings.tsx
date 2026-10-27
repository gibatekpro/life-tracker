import { ActivityIndicator, Text } from 'react-native';

import { getAccounts, getSettings } from '@/api';
import ErrorCard from '@/components/ErrorCard';
import Screen from '@/components/Screen';
import Card from '@/components/ui/Card';
import { useRefresh } from '@/data/refresh';
import { useData } from '@/data/useData';
import ApplePayCard from '@/features/settings/ApplePayCard';
import BudgetSettingsForm from '@/features/settings/BudgetSettingsCard';
import CategoriesCard from '@/features/settings/CategoriesCard';
import CurrenciesCard from '@/features/settings/CurrenciesCard';
import ThisPhoneCard from '@/features/settings/ThisPhoneCard';
import { useTokens } from '@/theme/tokens';

// My personal settings (web: SettingsPage): the numbers the summary and debt plan use, categories,
// currencies, and how Apple Pay captures find their account. "This phone" comes first: it's how the
// phone reaches the API at all, and where a 401 sends you.
export default function SettingsScreen() {
  const t = useTokens();
  const { refresh } = useRefresh();
  const settings = useData('settings', getSettings);
  const accounts = useData('accounts', getAccounts);
  const failed = [settings, accounts].find((d) => d.error);
  const s = settings.data;

  return (
    <Screen description="Your income and budget, categories, and how Apple Pay payments find their account."
      refreshing={settings.loading && !!s} onRefresh={refresh}>
      <ThisPhoneCard />
      {failed && <ErrorCard message={failed.error!} status={failed.errorStatus} />}

      <Card title="Income and budget" description="What the monthly summary measures against, and when your month starts.">
        {s ? <BudgetSettingsForm key={s.updatedAt} settings={s} /> : <ActivityIndicator color={t.muted} />}
      </Card>

      <CategoriesCard />
      <CurrenciesCard />
      <ApplePayCard settings={s} accounts={accounts.data} />

      <Card title="Appearance">
        <Text style={{ color: t.muted, fontSize: 14 }}>Light and dark mode follow your device&apos;s setting.</Text>
      </Card>
    </Screen>
  );
}
