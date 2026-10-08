import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  const { width: windowWidth } = useWindowDimensions();
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
  const [shelfWidth, setShelfWidth] = useState(0);
  const sourceRef = useRef<View>(null);
  const [sourceMenu, setSourceMenu] = useState<{ top: number; right: number } | null>(null);

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
    setSourceMenu(null);
  }

  function openSourceMenu() {
    sourceRef.current?.measureInWindow((x, y, width, height) => {
      setSourceMenu({
        top: y + height + 6,
        right: Math.max(12, windowWidth - x - width),
      });
    });
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
          <View style={styles.header}>
            <Text style={[styles.mark, { color: theme.text, fontFamily: Fonts?.serif }]}>REPUBer</Text>
            <View ref={sourceRef} collapsable={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={source?.name || 'Source'}
                onPress={openSourceMenu}
                hitSlop={8}
                style={[styles.sourceButton, 
                { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.sourceName, { color: theme.text }]}>{source?.name}</Text>
              </Pressable>
            </View>
          </View>

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
              hitSlop={6}
              style={styles.searchButton}>
              {searching ? (
                <ActivityIndicator color={theme.accent} />
              ) : (
                <Text
                  style={[
                    styles.searchLabel,
                    { color: query.trim() ? theme.accent : theme.textSecondary },
                  ]}>
                  Search
                </Text>
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
                <View style={styles.results}>
                  {results.hits.map((hit) => (
                    <Pressable
                      key={`${hit.core}-${hit.slug}`}
                      onPress={() => openHit(hit)}
                      android_ripple={{ color: theme.border }}
                      style={({ pressed }) => [styles.row, pressed && { opacity: 0.72 }]}>
                      <Cover uri={hit.cover} title={hit.title} width={64} radius={4} />
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
                  ))}
                </View>
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
              <View style={styles.shelf} onLayout={(event) => setShelfWidth(event.nativeEvent.layout.width)}>
                {books.map((book) => {
                  const title = displayTitle(book.name);
                  const column = shelfWidth > 0 ? Math.floor((shelfWidth - 16) / 2) : 156;
                  return (
                    <View key={book.name} style={[styles.shelfItem, { width: column }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${title}`}
                        onPress={() => openSaved(book)}
                        style={({ pressed }) => pressed && { opacity: 0.75 }}>
                        {book.cover ? <Cover uri={book.cover} title={title} width={column} radius={4} /> : null}
                        <Text style={[styles.cardTitle, { color: theme.text, marginTop: book.cover ? 8 : 0 }]} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text style={[styles.meta, { color: theme.textSecondary }]}>{book.mb} MB</Text>
                      </Pressable>
                      <View style={styles.shelfActions}>
                        <Pressable onPress={() => shareSaved(book)} hitSlop={8}>
                          <Text style={[styles.textButton, { color: theme.accent }]}>
                            {Platform.OS === 'web' ? 'Download' : 'Share'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => confirmRemove(book)} hitSlop={8}>
                          <Text style={[styles.textButton, { color: theme.textSecondary }]}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                Books you build will appear here.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={sourceMenu != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSourceMenu(null)}>
        <View style={styles.menuLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSourceMenu(null)} />
          <View
            style={[
              styles.menu,
              sourceMenu,
              { backgroundColor: theme.backgroundElement },
            ]}>
            {sources.map((item) => {
              const selected = item.id === source?.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => chooseSource(item.id)}
                  style={[styles.menuRow, selected && { backgroundColor: theme.backgroundSelected }]}>
                  <Text style={[styles.menuLabel, { color: selected ? theme.accent : theme.text }]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mark: {
    flexShrink: 1,
    fontSize: 32,
    lineHeight: 38,
  },
  sourceButton: {
    flexShrink: 1,
    paddingVertical: 8,
    paddingLeft: 12,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuLayer: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    zIndex: 2,
    minWidth: 196,
    borderRadius: 12,
    paddingVertical: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  menuRow: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  search: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  searchButton: {
    minWidth: 72,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  searchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  banner: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 16,
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 13,
  },
  results: {
    gap: 18,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 4,
  },
  shelfItem: {
    gap: 4,
  },
  shelfActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toastText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
