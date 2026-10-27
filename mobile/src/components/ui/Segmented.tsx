import SegmentedControlNative, { type SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import type { ComponentType } from 'react';
import { useColorScheme } from 'react-native';

// The library's typings (written for React Native 0.63) declare it in a way today's TypeScript
// doesn't see as a component; the props are right and the component works, so type it as one.
const SegmentedControl = SegmentedControlNative as unknown as ComponentType<SegmentedControlProps>;

// A row of mutually exclusive choices as the iOS segmented control (web: SegmentedControl).
export default function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const scheme = useColorScheme();
  return (
    <SegmentedControl
      values={options.map((o) => o.label)}
      selectedIndex={options.findIndex((o) => o.value === value)}
      onChange={(e) => onChange(options[e.nativeEvent.selectedSegmentIndex].value)}
      appearance={scheme === 'dark' ? 'dark' : 'light'}
      accessibilityLabel={label}
    />
  );
}
