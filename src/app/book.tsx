import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

export default function BookScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ core?: string; q?: string }>();
  const core = param(params.core);
  const query = param(params.q);
  const [loaded, setLoaded] = useState<{ key: string; book: BookInfo | null; error: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [branchId, setBranchId] = useState<string | number | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tileWidth, setTileWidth] = useState(0);

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
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
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
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 132 }]}>
            <View style={styles.frame}>
              <View style={styles.hero}>
                <Cover uri={book.cover} title={book.title} width={148} radius={12} />
                {sourceName ? (
                  <Text style={[styles.kicker, { color: theme.accent }]}>{sourceName}</Text>
                ) : null}
                <Text style={[styles.title, { color: theme.text, fontFamily: Fonts?.serif }]}>{book.title}</Text>
                {[book.alt, ...book.other].filter((name) => name && name !== book.title).length ? (
                  <Text style={[styles.alt, { color: theme.textSecondary }]}>
                    {[book.alt, ...book.other].filter((name) => name && name !== book.title).join(' · ')}
                  </Text>
                ) : null}
                {book.authors.length || book.artists.length ? (
                  <Text style={[styles.by, { color: theme.text }]}>
                    {book.authors.join(', ')}
                    {book.artists.length ? (
                      <Text style={{ color: theme.textSecondary }}> · Art: {book.artists.join(', ')}</Text>
                    ) : null}
                  </Text>
                ) : null}
              </View>

              {book.genres.length ? (
                <View style={styles.chips}>
                  {book.genres.map((genre) => (
                    <View key={genre} style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
                      <Text style={[styles.chipText, { color: theme.text }]}>{genre}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.facts}>
                {[
                  ...book.facts,
                  [
                    'Chapters',
                    `${book.chapters} in ${book.volumes.length} volume${book.volumes.length === 1 ? '' : 's'}`,
                  ] as [string, string],
                ].map(([label, value]) => (
                  <View key={label} style={styles.fact}>
                    <Text style={[styles.factLabel, { color: theme.textSecondary }]}>{label}</Text>
                    <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.heading, { color: theme.text }]}>About</Text>
              <Text
                style={[styles.about, { color: theme.text }]}
                numberOfLines={aboutOpen || !longAbout ? undefined : 6}>
                {about || 'No description available.'}
              </Text>
              {longAbout ? (
                <Pressable onPress={() => setAboutOpen((open) => !open)} hitSlop={8}>
                  <Text style={[styles.link, { color: theme.accent }]}>{aboutOpen ? 'Show less' : 'Read more'}</Text>
                </Pressable>
              ) : null}

              {book.tags.length ? (
                <View style={styles.tags}>
                  <Pressable onPress={() => setTagsOpen((open) => !open)}>
                    <Text style={[styles.link, { color: theme.textSecondary }]}>
                      {tagsOpen ? 'Hide tags' : `Tags (${book.tags.length})`}
                    </Text>
                  </Pressable>
                  {tagsOpen ? (
                    <Text style={[styles.tagList, { color: theme.textSecondary }]}>{book.tags.join(', ')}</Text>
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

              <Text style={[styles.heading, { color: theme.text }]}>Translation</Text>
              {book.branches.length ? (
                book.branches.map((item) => {
                  const on = sameId(item.id, branch?.id);
                  return (
                    <Pressable
                      key={String(item.id)}
                      onPress={() => setBranchId(item.id)}
                      style={[
                        styles.branch,
                        {
                          backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                          borderColor: on ? theme.accent : theme.border,
                        },
                      ]}>
                      <View style={[styles.radio, { borderColor: on ? theme.accent : theme.textSecondary }]}>
                        {on ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
                      </View>
                      <View style={styles.branchBody}>
                        <Text style={[styles.branchName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.meta, { color: theme.textSecondary }]}>
                          {item.chapters} chapters
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  No translation is available for this book.
                </Text>
              )}

              <View style={styles.volumeHead}>
                <Text style={[styles.heading, { color: theme.text, marginTop: 0 }]}>Volumes</Text>
                <View style={styles.volumeLinks}>
                  <Pressable onPress={() => setSelected(new Set(book.volumes.map((volume) => volume.v)))} hitSlop={8}>
                    <Text style={[styles.link, { color: theme.accent }]}>All</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelected(new Set())} hitSlop={8}>
                    <Text style={[styles.link, { color: theme.accent }]}>Clear</Text>
                  </Pressable>
                </View>
              </View>
              <View
                style={styles.tiles}
                onLayout={(event) => setTileWidth(Math.floor((event.nativeEvent.layout.width - 10) / 2))}>
                {book.volumes.map((volume) => {
                  const on = selected.has(volume.v);
                  return (
                    <Pressable
                      key={volume.v}
                      onPress={() => toggleVolume(volume.v)}
                      style={[
                        styles.tile,
                        {
                          width: tileWidth || '48%',
                          backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                          borderColor: on ? theme.accent : theme.border,
                        },
                      ]}>
                      <Text style={[styles.tileTitle, { color: theme.text }]}>Volume {volume.v}</Text>
                      <Text style={[styles.meta, { color: theme.textSecondary }]}>
                        {volume.n} chapter{volume.n === 1 ? '' : 's'}
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
                backgroundColor: theme.background,
                borderColor: theme.border,
                paddingBottom: insets.bottom + 12,
              },
            ]}>
            <View style={styles.frame}>
              <Text style={[styles.summary, { color: theme.textSecondary }]}>
                {chosen.length
                  ? `${chosen.length} volume${chosen.length === 1 ? '' : 's'} · ${chapterCount} chapters`
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
    paddingBottom: 4,
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
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  alt: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  by: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 13,
  },
  facts: {
    marginTop: 20,
    gap: 8,
  },
  fact: {
    flexDirection: 'row',
    gap: 12,
  },
  factLabel: {
    width: 108,
    fontSize: 14,
  },
  factValue: {
    flex: 1,
    fontSize: 14,
  },
  heading: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: '600',
  },
  about: {
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  tags: {
    marginTop: 16,
  },
  tagList: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  branch: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  branchBody: {
    flex: 1,
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
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeLinks: {
    flexDirection: 'row',
    gap: 16,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  summary: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
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
