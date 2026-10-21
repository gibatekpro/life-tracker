// Temporary: the old cards inside the new layout, until their pages are redesigned.
import { useRefresh } from '../data/refresh';
import SettingsCard from '../components/SettingsCard';

export function LegacySettings() {
  const { refresh } = useRefresh();
  return <SettingsCard onSaved={refresh} />;
}
