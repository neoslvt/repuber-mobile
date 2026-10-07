import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CoverProps = {
  uri?: string;
  width: number;
  title?: string;
  radius?: number;
};

export function Cover({ uri, width, title, radius = 10 }: CoverProps) {
  const theme = useTheme();
  const height = Math.round(width * 1.48);
  const letter = (title || 'R').trim().charAt(0).toUpperCase() || 'R';

  return (
    <View
      style={[
        styles.frame,
        {
          width,
          height,
          borderRadius: radius,
          borderColor: theme.border,
          backgroundColor: theme.backgroundSelected,
        },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" transition={180} />
      ) : (
        <Text style={[styles.letter, { color: theme.textSecondary, fontFamily: Fonts?.serif }]}>{letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  letter: {
    fontSize: 28,
  },
});
