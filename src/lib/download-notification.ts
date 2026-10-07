import { requireNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

import type { BuildSnapshot } from '@/lib/types';

type DownloadProgressNative = {
  start: (title: string, text: string, current: number, max: number) => boolean;
  update: (title: string, text: string, current: number, max: number) => void;
  finish: (title: string, text: string, success: boolean) => void;
};

let chain: Promise<void> = Promise.resolve();
let started = false;
let skipped = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: BuildSnapshot | null = null;
let lastSentAt = 0;
let lastKey = '';

function nativeModule(): DownloadProgressNative | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<DownloadProgressNative>('DownloadProgress');
  } catch {
    return null;
  }
}

function statusText(snap: BuildSnapshot) {
  if (snap.state === 'done') return 'Saved to your library';
  if (snap.state === 'error') return snap.msg;
  if (snap.total > 0) {
    const pct = Math.min(100, Math.round((snap.done / snap.total) * 100));
    return `${pct}% · ${snap.done} of ${snap.total} · ${snap.msg}`;
  }
  return snap.msg || 'Starting…';
}

async function ensurePermission() {
  if (Platform.OS !== 'android') return true;
  const version = Platform.Version;
  if (typeof version !== 'number' || version < 33) return true;
  const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (already) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function reset() {
  started = false;
  skipped = false;
  lastKey = '';
  lastSentAt = 0;
}

async function apply(snap: BuildSnapshot) {
  const native = nativeModule();
  if (!native || skipped) {
    if (snap.state !== 'running') reset();
    return;
  }

  const text = statusText(snap);
  if (snap.state !== 'running') {
    if (started) {
      try {
        native.finish(snap.title, text, snap.state === 'done');
      } catch {
        // The book is already saved or failed. The shade can miss the last update.
      }
    }
    reset();
    return;
  }

  if (!started) {
    const allowed = await ensurePermission();
    if (!allowed) {
      skipped = true;
      return;
    }
    try {
      started = native.start(snap.title, text, snap.done, snap.total);
    } catch {
      started = false;
    }
    if (!started) {
      skipped = true;
      return;
    }
    lastKey = `${snap.done}:${snap.total}:${snap.msg}`;
    return;
  }

  const key = `${snap.done}:${snap.total}:${snap.msg}`;
  if (key === lastKey) return;
  lastKey = key;
  try {
    native.update(snap.title, text, snap.done, snap.total);
  } catch {
    skipped = true;
  }
}

function enqueue(snap: BuildSnapshot) {
  chain = chain.then(() => apply(snap)).catch(() => {});
}

/** Shows an Android download notification. Other platforms keep the in-app progress only. */
export function syncDownloadNotification(snap: BuildSnapshot) {
  if (Platform.OS !== 'android') return;

  if (snap.state !== 'running') {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    enqueue(snap);
    return;
  }

  pending = snap;
  const elapsed = Date.now() - lastSentAt;
  if (elapsed >= 400) {
    lastSentAt = Date.now();
    pending = null;
    enqueue(snap);
    return;
  }

  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const next = pending;
    pending = null;
    if (!next) return;
    lastSentAt = Date.now();
    enqueue(next);
  }, 400 - elapsed);
}
