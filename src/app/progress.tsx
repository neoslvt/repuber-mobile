import { Stack, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '@/components/cover';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { subscribeBuild } from '@/lib/build';
import { openBook, shareBook } from '@/lib/library';
import { messageOf } from '@/lib/text';
import type { BuildSnapshot } from '@/lib/types';

export default function ProgressScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const [job, setJob] = useState<BuildSnapshot | null>(null);
  const [shareError, setShareError] = useState('');
  const building = job?.state === 'running';

  useEffect(() => subscribeBuild(setJob), []);

  useEffect(() => {
    if (!building) return;
    return navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
    });
  }, [building, navigation]);

  const pct = !job
    ? 0
    : job.state === 'done'
      ? 100
      : job.total
        ? Math.min(100, Math.round((job.done / job.total) * 100))
        : 0;

  async function open() {
    if (!job?.file) return;
    setShareError('');
    try {
      await openBook(job.file);
    } catch (err) {
      setShareError(messageOf(err));
    }
  }

  async function share() {
    if (!job?.file) return;
    setShareError('');
    try {
      await shareBook(job.file);
    } catch (err) {
      setShareError(messageOf(err));
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 },
      ]}>
      <Stack.Screen options={{ gestureEnabled: !building }} />
      <ScrollView style={styles.scroller} contentContainerStyle={styles.frame}>
        {!job ? (
          <View style={styles.center}>
            <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.serif }]}>Nothing is building</Text>
            <Pressable onPress={() => router.back()} style={styles.secondary}>
              <Text style={[styles.secondaryLabel, { color: theme.accent }]}>Back</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Cover uri={job.cover} title={job.title} width={84} radius={8} />
            <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.serif }]}>{job.title}</Text>
            {job.team ? (
              <Text style={[styles.team, { color: theme.textSecondary }]}>Translated by {job.team}</Text>
            ) : null}

            <Text style={[styles.percent, { color: theme.text, fontFamily: Fonts?.serif }]}>{pct}%</Text>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
            </View>

            <Text style={[styles.msg, { color: theme.text }]}>
              {job.state === 'error' ? 'Build stopped' : job.msg}
            </Text>
            {job.state === 'running' ? <ActivityIndicator color={theme.accent} style={styles.spinner} /> : null}
            {job.total ? (
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {job.done} of {job.total} chapters
              </Text>
            ) : null}

            {building ? (
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Downloading chapters and packing the EPUB. Keep the app open until it finishes.
              </Text>
            ) : null}

            {job.state === 'error' ? (
              <View style={[styles.banner, { backgroundColor: theme.dangerBg }]}>
                <Text style={[styles.bannerText, { color: theme.danger }]}>{job.msg}</Text>
              </View>
            ) : null}
            {shareError ? (
              <View style={[styles.banner, { backgroundColor: theme.dangerBg }]}>
                <Text style={[styles.bannerText, { color: theme.danger }]}>{shareError}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {job.state === 'done' && job.file ? (
                <>
                  <Pressable
                    onPress={open}
                    style={({ pressed }) => [
                      styles.primary,
                      { backgroundColor: theme.accent, opacity: pressed ? 0.88 : 1 },
                    ]}>
                    <Text style={[styles.primaryLabel, { color: theme.accentText }]}>
                      {Platform.OS === 'web' ? 'Download EPUB' : 'Open EPUB'}
                    </Text>
                  </Pressable>
                  {Platform.OS === 'web' ? null : (
                    <Pressable onPress={share} style={styles.secondary}>
                      <Text style={[styles.secondaryLabel, { color: theme.accent }]}>Share</Text>
                    </Pressable>
                  )}
                </>
              ) : null}
              {building ? null : (
                <Pressable
                  onPress={() => (job.state === 'done' ? router.dismissTo('/') : router.back())}
                  style={styles.secondary}>
                  <Text style={[styles.secondaryLabel, { color: theme.accent }]}>
                    {job.state === 'done' ? 'Done' : 'Back to the book'}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  frame: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    marginTop: 18,
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  team: {
    marginTop: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  percent: {
    marginTop: 28,
    fontSize: 64,
    lineHeight: 72,
  },
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    borderRadius: 99,
  },
  msg: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
  },
  spinner: {
    marginTop: 16,
  },
  hint: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  banner: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderRadius: 12,
    padding: 12,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: 'auto',
    gap: 8,
    paddingTop: 24,
  },
  primary: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
