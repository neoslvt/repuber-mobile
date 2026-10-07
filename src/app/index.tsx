import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '@/components/cover';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { takeNotice } from '@/lib/build';
import { isDirectQuery, listSources, searchBooks } from '@/lib/cores';
import { deleteBook, listBooks, openBook, readSourceId, shareBook, writeSourceId } from '@/lib/library';
import { displayTitle, messageOf } from '@/lib/text';
import type { LibraryBook, SearchHit } from '@/lib/types';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sources] = useState(listSources);
  const [sourceId, setSourceId] = useState(() => sources[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const searchToken = useRef(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [results, setResults] = useState<{ query: string; hits: SearchHit[] } | null>(null);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const source = sources.find((item) => item.id === sourceId) ?? sources[0];
  const where = Platform.OS === 'web' ? 'In this browser' : 'On this phone';

  useEffect(() => {
    let alive = true;
    readSourceId().then((saved) => {
      if (!alive || !saved || !sources.some((item) => item.id === saved)) return;
      setSourceId(saved);
    });
    return () => {
      alive = false;
    };
  }, [sources]);

  const reloadBooks = useCallback(async () => {
    try {
      setBooks(await listBooks());
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const note = takeNotice();
      if (note) setToast(note);
      reloadBooks();
    }, [reloadBooks]),
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  function chooseSource(id: string) {
    searchToken.current += 1;
    setSearching(false);
    setSourceId(id);
    setResults(null);
    setError('');
    writeSourceId(id);
  }

  async function submit() {
    const text = query.trim();
    if (!text || !source) return;
    setError('');
    if (isDirectQuery(source.id, text)) {
      router.push({ pathname: '/book', params: { core: source.id, q: text } });
      return;
    }
    const token = ++searchToken.current;
    const requested = source.id;
    setSearching(true);
    try {
      const hits = await searchBooks(requested, text);
      if (token !== searchToken.current) return;
      setResults({ query: text, hits });
    } catch (err) {
      if (token !== searchToken.current) return;
      setError(messageOf(err));
    } finally {
      if (token === searchToken.current) setSearching(false);
    }
  }

  function openHit(hit: SearchHit) {
    router.push({ pathname: '/book', params: { core: hit.core, q: hit.slug } });
  }

  async function openSaved(book: LibraryBook) {
    try {
      await openBook(book.name);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function shareSaved(book: LibraryBook) {
    try {
      await shareBook(book.name);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function confirmRemove(book: LibraryBook) {
    const title = displayTitle(book.name);
    Alert.alert('Remove book', `Delete “${title}” from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBook(book.name);
            await reloadBooks();
          } catch (err) {
            setError(messageOf(err));
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.fill}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.accent}
            colors={[theme.accent]}
            onRefresh={async () => {
              setRefreshing(true);
              await reloadBooks();
              setRefreshing(false);
            }}
          />
        }>
        <View style={styles.frame}>
          <Text style={[styles.mark, { color: theme.accent, fontFamily: Fonts?.serif }]}>REPUBer</Text>
          <Text style={[styles.lead, { color: theme.textSecondary }]}>
            Search a title or paste a link, then save the book as an EPUB.
          </Text>

          <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {sources.map((item) => {
              const selected = item.id === source?.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => chooseSource(item.id)}
                  style={[styles.segmentItem, selected && { backgroundColor: theme.accent }]}>
                  <Text
                    numberOfLines={1}
                    style={[styles.segmentLabel, { color: selected ? theme.accentText : theme.text }]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {source?.description ? (
            <Text style={[styles.sourceHint, { color: theme.textSecondary }]}>{source.description}</Text>
          ) : null}

          <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submit}
              placeholder={source?.placeholder || 'Search by title or paste a link'}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={[styles.input, { color: theme.text }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={searching || !query.trim()}
              onPress={submit}
              style={({ pressed }) => [
                styles.searchButton,
                { backgroundColor: theme.accent, opacity: searching || !query.trim() ? 0.45 : pressed ? 0.85 : 1 },
              ]}>
              {searching ? (
                <ActivityIndicator color={theme.accentText} />
              ) : (
                <Text style={[styles.searchLabel, { color: theme.accentText }]}>Search</Text>
              )}
            </Pressable>
          </View>

          {error ? (
            <View style={[styles.banner, { backgroundColor: theme.dangerBg }]}>
              <Text style={[styles.bannerText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {results ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {results.hits.length ? 'Results' : 'Nothing found'}
                </Text>
                <Pressable onPress={() => setResults(null)} hitSlop={8}>
                  <Text style={[styles.textButton, { color: theme.accent }]}>Clear</Text>
                </Pressable>
              </View>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>for “{results.query}”</Text>
              {results.hits.length ? (
                results.hits.map((hit) => (
                  <Pressable
                    key={`${hit.core}-${hit.slug}`}
                    onPress={() => openHit(hit)}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}>
                    <Cover uri={hit.cover} title={hit.title} width={52} radius={6} />
                    <View style={styles.cardBody}>
                      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                        {hit.title}
                      </Text>
                      {hit.alt && hit.alt !== hit.title ? (
                        <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                          {hit.alt}
                        </Text>
                      ) : null}
                      <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                        {[hit.type, hit.year, hit.rating ? `★ ${hit.rating}` : '', hit.status]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={[styles.empty, { color: theme.textSecondary }]}>
                  Try another title, or paste a link.
                </Text>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your books</Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>{where}</Text>
            </View>
            {books.length ? (
              books.map((book) => (
                <View
                  key={book.name}
                  style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <View style={styles.cardBody}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${displayTitle(book.name)}`}
                      onPress={() => openSaved(book)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                        {displayTitle(book.name)}
                      </Text>
                      <Text style={[styles.meta, { color: theme.textSecondary }]}>{book.mb} MB</Text>
                    </Pressable>
                    <View style={styles.actions}>
                      <Pressable onPress={() => shareSaved(book)} hitSlop={6}>
                        <Text style={[styles.textButton, { color: theme.accent }]}>
                          {Platform.OS === 'web' ? 'Download' : 'Share'}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => confirmRemove(book)} hitSlop={6}>
                        <Text style={[styles.textButton, { color: theme.textSecondary }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                Books you build will appear here.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {toast ? (
        <View
          style={[
            styles.toast,
            { backgroundColor: theme.text, bottom: insets.bottom + 16 },
          ]}>
          <Text style={[styles.toastText, { color: theme.background }]}>{toast}</Text>
        </View>
      ) : null}
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
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: 20,
  },
  mark: {
    fontSize: 34,
    lineHeight: 40,
  },
  lead: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 460,
  },
  segment: {
    marginTop: 22,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  sourceHint: {
    marginTop: 8,
    fontSize: 13,
  },
  search: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  searchButton: {
    minWidth: 92,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  searchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  banner: {
    marginTop: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 32,
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  textButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 8,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    maxWidth: MaxContentWidth - 40,
    alignSelf: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toastText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
