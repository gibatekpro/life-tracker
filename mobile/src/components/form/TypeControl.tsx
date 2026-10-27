import SegmentedControlNative, { type SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import type { TransactionType } from '@lifetracker/core';
import type { ComponentType } from 'react';
import { useColorScheme } from 'react-native';

// The library's typings (written for React Native 0.63) declare it in a way today's TypeScript
// doesn't see as a component; the props are right and the component works, so type it as one.
const SegmentedControl = SegmentedControlNative as unknown as ComponentType<SegmentedControlProps>;

const types: TransactionType[] = ['Expense', 'Income', 'Transfer'];

// Expense / Income / Transfer as the iOS segmented control (UISegmentedControl).
export default function TypeControl({ value, onChange }: { value: TransactionType; onChange: (type: TransactionType) => void }) {
  const scheme = useColorScheme();
  return (
    <SegmentedControl
      values={types}
      selectedIndex={types.indexOf(value)}
      onChange={(e) => onChange(types[e.nativeEvent.selectedSegmentIndex])}
      appearance={scheme === 'dark' ? 'dark' : 'light'}
      accessibilityLabel="Type"
    />
  );
}
