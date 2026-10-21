// Temporary: the old cards inside the new layout, until their pages are redesigned.
import { useRefresh } from '../data/refresh';
import AvalancheCard from '../components/AvalancheCard';
import SettingsCard from '../components/SettingsCard';

export function LegacyPlan() {
  const { version } = useRefresh();
  return <AvalancheCard key={version} />;
}

export function LegacySettings() {
  const { refresh } = useRefresh();
  return <SettingsCard onSaved={refresh} />;
}
