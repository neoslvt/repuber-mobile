import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { LibraryBook } from '@/lib/types';
import { epubBaseName } from '@/lib/text';

const EPUB_MIME = 'application/epub+zip';
// Intent.FLAG_GRANT_READ_URI_PERMISSION. The reader needs permission to read our file.
const GRANT_READ = 1;

const SOURCE_FILE = 'repuber-source.txt';

function libraryDir() {
  const dir = new Directory(Paths.document, 'RanobeLibrary');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function bookFile(name: string) {
  return new File(libraryDir(), epubBaseName(name));
}

export async function listBooks(): Promise<LibraryBook[]> {
  const books: LibraryBook[] = [];
  for (const item of libraryDir().list()) {
    if (!(item instanceof File)) continue;
    if (!item.name.toLowerCase().endsWith('.epub')) continue;
    books.push({
      name: item.name,
      mb: Math.round((item.size / 1e6) * 10) / 10,
      mtime: item.lastModified ?? 0,
    });
  }
  books.sort((a, b) => b.mtime - a.mtime);
  return books;
}

export async function saveBook(name: string, bytes: Uint8Array) {
  const file = bookFile(name);
  if (!file.exists) file.create();
  const handle = file.open(FileMode.Truncate);
  try {
    // One giant write copies the whole EPUB across the native bridge and freezes the UI.
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      handle.writeBytes(bytes.slice(offset, offset + chunkSize));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    handle.close();
  }
}

export async function shareBook(name: string) {
  const file = bookFile(name);
  if (!file.exists) throw new Error('That book is no longer on this phone.');
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device.');
  // shareAsync only accepts file:// URLs. It turns that into a content URI for the Android share sheet.
  await Sharing.shareAsync(file.uri, {
    mimeType: EPUB_MIME,
    UTI: 'org.idpf.epub-container',
    dialogTitle: 'Share EPUB',
  });
}

export async function openBook(name: string) {
  const file = bookFile(name);
  if (!file.exists) throw new Error('That book is no longer on this phone.');

  // Android can hand the file straight to an EPUB reader. iOS opens files through the share sheet.
  if (Platform.OS !== 'android') {
    await shareBook(name);
    return;
  }

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: EPUB_MIME,
      flags: GRANT_READ,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/no activity found|activitynotfound/i.test(message)) {
      throw new Error('No app on this phone can open EPUB files. Use Share to send the book to one.');
    }
    throw err;
  }
}

export async function deleteBook(name: string) {
  const file = bookFile(name);
  if (file.exists) file.delete();
}

export async function readSourceId() {
  const file = new File(Paths.document, SOURCE_FILE);
  if (!file.exists) return null;
  const text = file.textSync().trim();
  return text || null;
}

export async function writeSourceId(id: string) {
  const file = new File(Paths.document, SOURCE_FILE);
  if (!file.exists) file.create();
  file.write(id);
}
