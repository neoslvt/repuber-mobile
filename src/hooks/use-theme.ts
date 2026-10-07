import { Colors, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}

export function useScheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}
