import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

function subscribe() {
  return () => {};
}

/**
 * Static web rendering does not know the device scheme. After hydration, use the real one.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const colorScheme = useRNColorScheme();
  return hydrated ? colorScheme : 'light';
}
