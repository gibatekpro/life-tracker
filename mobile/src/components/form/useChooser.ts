import { ActionSheetIOS, useColorScheme } from 'react-native';

import { useTokens } from '@/theme/tokens';

export interface Choice<T> {
  label: string;
  value: T;
}

// Lists choices in an iOS action sheet (React Native's ActionSheetIOS: the system's own menu,
// no library needed) and calls back with the one picked; Cancel picks nothing.
// destructive: the index of a choice to show in red (e.g. Delete).
export function useChooser() {
  const t = useTokens();
  const scheme = useColorScheme();
  return function choose<T>(title: string, choices: Choice<T>[], onChoose: (value: T) => void, opts?: { message?: string; destructive?: number }) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message: opts?.message,
        options: [...choices.map((c) => c.label), 'Cancel'],
        cancelButtonIndex: choices.length,
        destructiveButtonIndex: opts?.destructive,
        tintColor: t.accent,
        userInterfaceStyle: scheme === 'dark' ? 'dark' : 'light',
      },
      (i) => { if (i < choices.length) onChoose(choices[i].value); },
    );
  };
}
