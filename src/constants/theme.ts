import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1712',
    textSecondary: '#74695F',
    background: '#F3EEE6',
    backgroundElement: '#FFFCF8',
    backgroundSelected: '#F4E6D8',
    border: '#E3D8CB',
    accent: '#9C4221',
    accentText: '#FFFCF8',
    danger: '#9F2D2D',
    dangerBg: '#F8E6E3',
    shadow: 'rgba(28, 23, 18, 0.08)',
  },
  dark: {
    text: '#F6F1EA',
    textSecondary: '#B3A79B',
    background: '#100E0C',
    backgroundElement: '#1C1916',
    backgroundSelected: '#2C241E',
    border: '#322C27',
    accent: '#E7B089',
    accentText: '#1C1712',
    danger: '#F0B4AE',
    dangerBg: '#3A2220',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type Palette = {
  [K in keyof typeof Colors.light]: string;
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
