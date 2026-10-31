import type { IconName } from '../ui/Icon';

// The app's sections. The desktop sidebar shows them all; on phones the bottom bar has room for
// four tabs, and the rest are under More (phone: 'more').
export interface NavItem {
  to: string;
  label: string;
  short: string;      // the label on the phone's bottom bar
  icon: IconName;
  phone: 'tab' | 'more';
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Overview', short: 'Home', icon: 'home', phone: 'tab' },
  { to: '/transactions', label: 'Transactions', short: 'Activity', icon: 'list', phone: 'tab' },
  { to: '/budget', label: 'Budget', short: 'Budget', icon: 'budget', phone: 'tab' },
  { to: '/plan', label: 'Debt plan', short: 'Plan', icon: 'target', phone: 'tab' },
  { to: '/planned-purchases', label: 'Planned purchases', short: 'Saving', icon: 'gift', phone: 'more' },
  { to: '/accounts', label: 'Accounts', short: 'Accounts', icon: 'wallet', phone: 'more' },
  { to: '/insights', label: 'Insights', short: 'Insights', icon: 'sparkles', phone: 'more' },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: 'settings', phone: 'more' },
];
