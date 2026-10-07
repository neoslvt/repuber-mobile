import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { useScheme, useTheme } from '@/hooks/use-theme';

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useScheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="book" />
        <Stack.Screen name="progress" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
