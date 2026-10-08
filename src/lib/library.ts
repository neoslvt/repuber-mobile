import { coverBytes } from '@/lib/epub-cover';
import type { LibraryBook } from '@/lib/types';
import { epubBaseName } from '@/lib/text';

const DB_NAME = 'repuber';
const STORE = 'books';
const SOURCE_KEY = 'repuber-source';

type StoredBook = {
  name: string;
  mtime: number;
  size: number;
  bytes: ArrayBuffer;
  cover?: ArrayBuffer;
};

const coverUrls = new Map<string, string | null>();

function coverUrl(row: StoredBook) {
  const key = `${row.name}:${row.mtime}:${row.size}`;
  if (coverUrls.has(key)) return coverUrls.get(key) || undefined;
  const stored = row.cover ? new Uint8Array(row.cover) : coverBytes(new Uint8Array(row.bytes))?.bytes;
  if (!stored?.length) {
    coverUrls.set(key, null);
    return undefined;
  }
  const copy = stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([copy]));
  coverUrls.set(key, url);
  return url;
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open the library.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));
        request.onerror = () => reject(request.error ?? new Error('Library request failed.'));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Library request failed.'));
        };
      }),
  );
}

function toBook(row: StoredBook): LibraryBook {
  return {
    name: row.name,
    mb: Math.round((row.size / 1e6) * 10) / 10,
    mtime: row.mtime,
    cover: coverUrl(row),
  };
}

export async function listBooks(): Promise<LibraryBook[]> {
  const rows = await withStore<StoredBook[]>('readonly', (store) => store.getAll());
  return rows.map(toBook).sort((a, b) => b.mtime - a.mtime);
}

export async function saveBook(name: string, bytes: Uint8Array) {
  const fileName = epubBaseName(name);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const found = coverBytes(bytes);
  const cover = found
    ? (found.bytes.buffer.slice(found.bytes.byteOffset, found.bytes.byteOffset + found.bytes.byteLength) as ArrayBuffer)
    : undefined;
  const row: StoredBook = {
    name: fileName,
    mtime: Date.now(),
    size: bytes.byteLength,
    bytes: buffer,
    cover,
  };
  await withStore('readwrite', (store) => store.put(row, fileName));
}

export async function openBook(name: string) {
  await shareBook(name);
}

export async function shareBook(name: string) {
  const fileName = epubBaseName(name);
  const row = await withStore<StoredBook | undefined>('readonly', (store) => store.get(fileName));
  if (!row) throw new Error('That book is no longer in this browser.');
  const blob = new Blob([row.bytes], { type: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function deleteBook(name: string) {
  const fileName = epubBaseName(name);
  await withStore('readwrite', (store) => store.delete(fileName));
}

export async function readSourceId() {
  try {
    return localStorage.getItem(SOURCE_KEY);
  } catch {
    return null;
  }
}

export async function writeSourceId(id: string) {
  try {
    localStorage.setItem(SOURCE_KEY, id);
  } catch {
    // Private browsing can block storage. The choice still lasts for this visit.
  }
}
