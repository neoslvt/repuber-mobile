import '@/global.css';

import { Platform, PlatformColor, type ColorValue } from 'react-native';

// Android 12+ publishes the wallpaper palette as system_accent* and system_neutral*.
// Older phones, iOS, and web keep the paper palette.
function sys(name: string, fallback: string): ColorValue {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
    return PlatformColor(`@android:color/${name}`);
  }
  return fallback;
}

export const Colors = {
  light: {
    text: sys('system_neutral1_900', '#1C1712'),
    textSecondary: sys('system_neutral2_700', '#74695F'),
    background: sys('system_neutral1_50', '#F3EEE6'),
    backgroundElement: sys('system_neutral1_0', '#FFFCF8'),
    backgroundSelected: sys('system_accent1_100', '#F4E6D8'),
    border: sys('system_neutral2_200', '#E3D8CB'),
    accent: sys('system_accent1_600', '#9C4221'),
    accentText: sys('system_accent1_0', '#FFFCF8'),
    danger: '#9F2D2D',
    dangerBg: '#F8E6E3',
    shadow: 'rgba(28, 23, 18, 0.08)',
  },
  dark: {
    text: sys('system_neutral1_50', '#F6F1EA'),
    textSecondary: sys('system_neutral2_200', '#B3A79B'),
    background: sys('system_neutral1_900', '#100E0C'),
    backgroundElement: sys('system_neutral1_800', '#1C1916'),
    backgroundSelected: sys('system_accent1_800', '#2C241E'),
    border: sys('system_neutral1_700', '#322C27'),
    accent: sys('system_accent1_200', '#E7B089'),
    accentText: sys('system_neutral1_900', '#1C1712'),
    danger: '#F0B4AE',
    dangerBg: '#3A2220',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
};

export type Palette = {
  [K in keyof typeof Colors.light]: ColorValue;
};
export type ThemeColor = keyof Palette;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'Georgia',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'Georgia, "Iowan Old Style", Palatino, serif',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 720;
