import { NativeTabs } from 'expo-router/native-tabs';
import { DynamicColorIOS } from 'react-native';

import { tokens } from '@/theme/tokens';

// The iPhone's own tab bar (UITabBarController), not one drawn in JavaScript.
// DynamicColorIOS lets iOS pick the light or dark accent itself when the theme changes.
const accent = DynamicColorIOS({ light: tokens.light.accent, dark: tokens.dark.accent });

export default function TabLayout() {
  return (
    <NativeTabs tintColor={accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
