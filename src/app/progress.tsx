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
            <View style={styles.book}>
              <Cover uri={job.cover} title={job.title} width={64} radius={3} />
              <View style={styles.bookText}>
                <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.serif }]}>{job.title}</Text>
                {job.team ? (
                  <Text style={[styles.team, { color: theme.textSecondary }]}>Translated by {job.team}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.progressHead}>
              <Text style={[styles.msg, { color: theme.text }]}>
                {job.state === 'error' ? 'Build stopped' : job.msg}
              </Text>
              <Text style={[styles.percent, { color: theme.text }]}>{pct}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
            </View>
            {job.total ? (
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {job.done} of {job.total} chapters
              </Text>
            ) : null}
            {job.state === 'running' ? <ActivityIndicator color={theme.accent} style={styles.spinner} /> : null}

            {building ? (
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                {Platform.OS === 'android'
                  ? 'Downloading chapters and packing the EPUB. You can leave the app — progress stays in the notification.'
                  : 'Downloading chapters and packing the EPUB. Keep the app open until it finishes.'}
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
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bookText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  team: {
    fontSize: 14,
    lineHeight: 20,
  },
  progressHead: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  percent: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
  },
  msg: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  meta: {
    marginTop: 8,
    fontSize: 14,
  },
  spinner: {
    marginTop: 16,
  },
  hint: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
  },
  banner: {
    marginTop: 18,
    borderRadius: 8,
    padding: 12,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: 'auto',
    gap: 8,
    paddingTop: 24,
  },
  primary: {
    height: 48,
    borderRadius: 8,
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
