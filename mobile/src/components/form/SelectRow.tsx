import { SymbolView } from 'expo-symbols';
import { ActionSheetIOS, StyleSheet, Text, useColorScheme } from 'react-native';

import FormRow from './FormRow';
import { useTokens } from '@/theme/tokens';

export interface SelectOption<T> {
  label: string;
  value: T;
}

// A row that shows the current choice and, when tapped, lists the options in an iOS action sheet
// (React Native's ActionSheetIOS: the system's own menu sheet, no library needed).
export default function SelectRow<T>({ label, valueLabel, options, onChange, placeholder = 'Choose' }: {
  label: string;
  valueLabel: string | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const t = useTokens();
  const scheme = useColorScheme();

  const open = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label,
        options: [...options.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: options.length,
        tintColor: t.accent,
        userInterfaceStyle: scheme === 'dark' ? 'dark' : 'light',
      },
      (i) => { if (i < options.length) onChange(options[i].value); },
    );

  return (
    <FormRow label={label} onPress={open} accessibilityLabel={`${label}: ${valueLabel ?? placeholder}`}>
      <Text style={[styles.value, { color: valueLabel ? t.muted : t.subtle }]} numberOfLines={1}>
        {valueLabel ?? placeholder}
      </Text>
      <SymbolView name="chevron.up.chevron.down" size={13} tintColor={t.subtle} />
    </FormRow>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 16, flexShrink: 1, textAlign: 'right' },
});
