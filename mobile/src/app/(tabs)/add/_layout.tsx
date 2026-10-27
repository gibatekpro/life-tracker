import { Stack } from 'expo-router';

// The Add tab has its own stack only for the navigation bar, which holds Save above the keyboard.
export default function AddLayout() {
  return <Stack screenOptions={{ title: 'Add' }} />;
}
