import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text } from 'react-native';

import FormRow from './FormRow';
import { useChooser, type Choice } from './useChooser';
import { useTokens } from '@/theme/tokens';

export type SelectOption<T> = Choice<T>;

// A form row that shows the current choice and lists the options in an action sheet when tapped.
export default function SelectRow<T>({ label, valueLabel, options, onChange, placeholder = 'Choose' }: {
  label: string;
  valueLabel: string | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const t = useTokens();
  const choose = useChooser();
  return (
    <FormRow label={label} onPress={() => choose(label, options, onChange)} accessibilityLabel={`${label}: ${valueLabel ?? placeholder}`}>
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
