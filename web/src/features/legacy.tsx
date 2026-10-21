// Temporary: the old cards inside the new layout, until their pages are redesigned.
import { getAccounts, getDebts } from '../api';
import { useData } from '../data/useData';
import { useRefresh } from '../data/refresh';
import AccountsCard from '../components/AccountsCard';
import AvalancheCard from '../components/AvalancheCard';
import SettingsCard from '../components/SettingsCard';
import { EmptyState } from '../components/ui/Bits';

export function LegacyAccounts() {
  const accounts = useData('accounts', getAccounts);
  const debts = useData('debts', getDebts);
  const { refresh } = useRefresh();
  return accounts.data && debts.data
    ? <AccountsCard accounts={accounts.data} overview={debts.data} onChanged={refresh} /> : null;
}

export function LegacyPlan() {
  const { version } = useRefresh();
  return <AvalancheCard key={version} />;
}

export function LegacySettings() {
  const { refresh } = useRefresh();
  return <SettingsCard onSaved={refresh} />;
}

export function ComingNext() {
  return <EmptyState icon="list" title="Being redesigned">This page arrives in the next commit.</EmptyState>;
}
