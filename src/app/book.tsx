import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ColorValue,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '@/components/cover';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { startBuild } from '@/lib/build';
import { listSources, loadBook } from '@/lib/cores';
import { messageOf, plainText, sameId } from '@/lib/text';
import type { BookInfo } from '@/lib/types';

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

// Fade the blurred cover into the page color. A hex color can live in a CSS
// gradient. Android 12+ wallpaper colors are resource values, so those use the
// structured gradient, which resolves them on the native side.
function coverFade(color: ColorValue): ViewStyle {
  if (typeof color === 'string') {
    const image = `linear-gradient(to bottom, transparent 0%, transparent 34%, ${color} 76%, ${color} 100%)`;
    if (Platform.OS === 'web') return { backgroundImage: image } as ViewStyle;
    return { experimental_backgroundImage: image };
  }
  return {
    experimental_backgroundImage: [
      {
        type: 'linear-gradient',
        direction: 'to bottom',
        colorStops: [
          { color: 'transparent', positions: ['0%', '34%'] },
          { color, positions: ['76%', '100%'] },
        ],
      },
    ],
  };
}

export default function BookScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ core?: string; q?: string }>();
  const core = param(params.core);
  const query = param(params.q);
  const [loaded, setLoaded] = useState<{ key: string; book: BookInfo | null; error: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [branchId, setBranchId] = useState<string | number | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const requestKey = `${core}\n${query}`;
  const visible = loaded?.key === requestKey ? loaded : null;
  const loading = visible == null;
  const book = visible?.book ?? null;
  const error = visible?.error ?? '';

  useEffect(() => {
    let alive = true;
    loadBook(core, query)
      .then((info) => {
        if (!alive) return;
        setLoaded({ key: `${core}\n${query}`, book: info, error: '' });
        setSelected(new Set(info.volumes.map((volume) => volume.v)));
        setBranchId(info.branches[0]?.id ?? null);
        setAboutOpen(false);
        setTagsOpen(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setLoaded({ key: `${core}\n${query}`, book: null, error: messageOf(err) });
      });
    return () => {
      alive = false;
    };
  }, [core, query]);

  const sourceName = listSources().find((item) => item.id === (book?.core || core))?.name;
  const about = plainText(book?.summary || '');
  const longAbout = about.length > 280;
  const chosen = book?.volumes.filter((volume) => selected.has(volume.v)) ?? [];
  const chapterCount = chosen.reduce((sum, volume) => sum + volume.n, 0);
  const branch = book?.branches.find((item) => sameId(item.id, branchId)) ?? book?.branches[0];
  const canBuild = Boolean(chosen.length && book?.branches.length);

  function toggleVolume(volume: string) {
    if (!book) return;
    setSelected((current) => {
      const allOn = book.volumes.every((item) => current.has(item.v));
      if (allOn) return new Set([volume]);
      const next = new Set(current);
      if (next.has(volume)) next.delete(volume);
      else next.add(volume);
      return next;
    });
  }

  function build() {
    if (!book || !canBuild) return;
    const started = startBuild({
      core: book.core,
      slug: book.slug,
      title: book.title,
      cover: book.cover,
      branch: branch?.id ?? null,
      team: branch?.name ?? '',
      volumes: chosen.map((volume) => volume.v),
    });
    if (!started) {
      Alert.alert(
        'Still downloading',
        'Another book is being built right now. That one has to finish first.',
      );
    }
    router.push('/progress');
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top }]}>
        <View style={styles.frame}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <Text style={[styles.backLabel, { color: theme.accent }]}>Back</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : error || !book ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.danger }]}>{error || 'Could not open this book.'}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backLabel, { color: theme.accent }]}>Back to search</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 148 }]}>
            {book.cover ? (
              <View pointerEvents="none" style={[styles.wash, { width: windowWidth, height: insets.top + 560 }]}>
                <Image
                  source={{ uri: book.cover }}
                  style={styles.washImage}
                  contentFit="cover"
                  blurRadius={64}
                />
                <View style={[styles.washFade, coverFade(theme.background)]} />
              </View>
            ) : null}
            <View style={styles.frame}>
              <View style={styles.mast}>
                <View style={[styles.coverShadow, { backgroundColor: theme.backgroundElement }]}>
                  <Cover uri={book.cover} title={book.title} width={176} radius={6} />
                </View>
                {sourceName ? (
                  <Text style={[styles.kicker, { color: theme.textSecondary }]}>{sourceName}</Text>
                ) : null}
                <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.serif }]}>{book.title}</Text>
                {[book.alt, ...book.other].filter((name) => name && name !== book.title).length ? (
                  <Text style={[styles.alt, { color: theme.textSecondary }]}>
                    {[book.alt, ...book.other].filter((name) => name && name !== book.title).join(' · ')}
                  </Text>
                ) : null}
                {book.authors.length ? (
                  <Text style={[styles.by, { color: theme.text }]}>{book.authors.join(', ')}</Text>
                ) : null}
                {book.artists.length ? (
                  <Text style={[styles.by, { color: theme.textSecondary }]}>Art · {book.artists.join(', ')}</Text>
                ) : null}
                {book.genres.length ? (
                  <Text style={[styles.genres, { color: theme.textSecondary }]}>{book.genres.join('  ·  ')}</Text>
                ) : null}
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: theme.text }]}>{book.volumes.length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                      {book.volumes.length === 1 ? 'Volume' : 'Volumes'}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: theme.text }]}>{book.chapters}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                      {book.chapters === 1 ? 'Chapter' : 'Chapters'}
                    </Text>
                  </View>
                </View>
              </View>

              {book.facts.length ? (
                <View style={styles.facts}>
                  {book.facts.map(([label, value]) => (
                    <View key={label} style={styles.fact}>
                      <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text>
                      <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.heading, { color: theme.textSecondary }]}>About</Text>
              <Text
                style={[styles.about, { color: theme.text }]}
                numberOfLines={aboutOpen || !longAbout ? undefined : 5}>
                {about || 'No description available.'}
              </Text>
              {longAbout ? (
                <Pressable onPress={() => setAboutOpen((open) => !open)} hitSlop={8}>
                  <Text style={[styles.link, { color: theme.accent }]}>{aboutOpen ? 'Show less' : 'Read more'}</Text>
                </Pressable>
              ) : null}

              {book.tags.length ? (
                <View style={styles.tags}>
                  {book.tags.length > 8 ? (
                    <Pressable onPress={() => setTagsOpen((open) => !open)} hitSlop={8}>
                      <Text style={[styles.link, { color: theme.accent, marginTop: 0 }]}>
                        {tagsOpen ? 'Hide tags' : `Tags · ${book.tags.length}`}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.heading, { color: theme.textSecondary, marginTop: 0 }]}>Tags</Text>
                  )}
                  {book.tags.length <= 8 || tagsOpen ? (
                    <View style={styles.tagWrap}>
                      {book.tags.map((tag) => (
                        <Text key={tag} style={[styles.tag, { color: theme.text }]}>
                          {tag}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {book.notes.length ? (
                <View style={[styles.note, { backgroundColor: theme.dangerBg }]}>
                  <Text style={[styles.noteText, { color: theme.danger }]}>
                    Content notes: {book.notes.join('; ')}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.heading, { color: theme.textSecondary }]}>Translation</Text>
              {book.branches.length ? (
                <View style={styles.choices}>
                  {book.branches.map((item) => {
                    const on = sameId(item.id, branch?.id);
                    return (
                      <Pressable
                        key={String(item.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => setBranchId(item.id)}
                        style={[
                          styles.branch,
                          { backgroundColor: on ? theme.backgroundElement : theme.background, borderColor: theme.border },
                          { borderWidth: StyleSheet.hairlineWidth, borderColor: on ? theme.accent : theme.border }
                        ]}>
                        <Text style={[styles.branchName, { color: on ? theme.accent : theme.text }]}>{item.name}</Text>
                        <Text style={[styles.meta, { color: theme.textSecondary }]}>{item.chapters} chapters</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  No translation is available for this book.
                </Text>
              )}

              <View style={styles.volumeHead}>
                <Text style={[styles.heading, { color: theme.textSecondary, marginTop: 0, marginBottom: 0 }]}>
                  Volumes
                </Text>
                <View style={styles.volumeLinks}>
                  <Pressable onPress={() => setSelected(new Set(book.volumes.map((volume) => volume.v)))} hitSlop={8}>
                    <Text style={[styles.link, { color: theme.accent, marginTop: 0 }]}>All</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelected(new Set())} hitSlop={8}>
                    <Text style={[styles.link, { color: theme.accent, marginTop: 0 }]}>None</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.volumes} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
                {book.volumes.map((volume) => {
                  const on = selected.has(volume.v);
                  const columns = gridWidth >= 560 ? 3 : 2;
                  const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - 10 * (columns - 1)) / columns) : undefined;
                  return (
                    <Pressable
                      key={volume.v}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Volume ${volume.v}`}
                      onPress={() => toggleVolume(volume.v)}
                      style={[
                        styles.volume,
                        {
                          width: tileWidth ?? '48%',
                          backgroundColor: on ? theme.backgroundElement : theme.background,
                          borderColor: on ? theme.accent : theme.border, 
                          borderWidth: StyleSheet.hairlineWidth
                        },
                      ]}>
                      <Text style={[styles.volumeTitle, { color: on ? theme.accent : theme.text }]} numberOfLines={1}>
                        {volume.v}
                      </Text>
                      <Text style={[styles.meta, { color: theme.textSecondary }]}>
                        {volume.n} ch.
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.backgroundElement,
                paddingBottom: insets.bottom + 14,
              },
            ]}>
            <View style={styles.frame}>
              <Text style={[styles.summary, { color: theme.textSecondary }]}>
                {chosen.length
                  ? `${chosen.length} of ${book.volumes.length} · ${chapterCount} chapters`
                  : 'Select at least one volume'}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={!canBuild}
                onPress={build}
                style={({ pressed }) => [
                  styles.build,
                  { backgroundColor: theme.accent, opacity: !canBuild ? 0.4 : pressed ? 0.88 : 1 },
                ]}>
                <Text style={[styles.buildLabel, { color: theme.accentText }]}>Build EPUB</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingBottom: 4,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  washImage: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '120%',
    height: '120%',
  },
  washFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  frame: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  back: {
    minHeight: 40,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  error: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  scroll: {
    alignItems: 'center',
  },
  mast: {
    alignItems: 'center',
  },
  coverShadow: {
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  kicker: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  alt: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  by: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  genres: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  stats: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
  },
  facts: {
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  fact: {
    minWidth: 104,
    gap: 2,
  },
  factLabel: {
    fontSize: 12,
  },
  factValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  heading: {
    marginTop: 32,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  about: {
    fontSize: 16,
    lineHeight: 25,
  },
  link: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  tags: {
    marginTop: 28,
  },
  tagWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 8,
  },
  tag: {
    fontSize: 15,
    lineHeight: 20,
  },
  note: {
    marginTop: 20,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  choices: {
    gap: 8,
  },
  branch: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  volumeHead: {
    marginTop: 32,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeLinks: {
    flexDirection: 'row',
    gap: 16,
  },
  volumes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  volume: {
    minHeight: 76,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  volumeTitle: {
    fontSize: 22,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
  },
  summary: {
    fontSize: 13,
    marginBottom: 10,
  },
  build: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
