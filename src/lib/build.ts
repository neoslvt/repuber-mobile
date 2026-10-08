import { buildBook } from '@/lib/cores';
import { syncDownloadNotification } from '@/lib/download-notification';
import { saveBook } from '@/lib/library';
import { messageOf } from '@/lib/text';
import type { BuildInput, BuildJob, BuildSnapshot } from '@/lib/types';
import { releaseDownloads } from '../../ranobelib-epub/src/cores/http.js';

type Listener = (snapshot: BuildSnapshot | null) => void;

let listeners = new Set<Listener>();
let snapshot: BuildSnapshot | null = null;
let running = false;
let notice = '';

function publish(next: BuildSnapshot | null) {
  snapshot = next;
  for (const listener of listeners) listener(next);
  if (next) syncDownloadNotification(next);
}

export function subscribeBuild(listener: Listener) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function isBuilding() {
  return running;
}

export function takeNotice() {
  const message = notice;
  notice = '';
  return message;
}

export function startBuild(input: BuildInput) {
  if (running) return false;
  running = true;
  let finished = false;
  const job: BuildJob = { done: 0, total: 0, msg: 'Starting…' };
  const base = {
    title: input.title,
    cover: input.cover,
    team: input.team,
  };

  const runningSnap = (): BuildSnapshot => ({
    ...base,
    done: job.done,
    total: job.total,
    state: 'running',
    msg: job.msg || 'Starting…',
    file: null,
  });

  publish(runningSnap());
  const timer = setInterval(() => {
    if (finished) return;
    publish(runningSnap());
  }, 300);

  void (async () => {
    try {
      const result = await buildBook(input.core, job, input);
      job.msg = 'Saving…';
      publish(runningSnap());
      await saveBook(result.filename, result.bytes);
      finished = true;
      clearInterval(timer);
      running = false;
      notice = `“${input.title}” was saved to your library.`;
      publish({
        ...base,
        done: job.total || job.done,
        total: job.total || job.done,
        state: 'done',
        msg: 'Saved to your library',
        file: result.filename,
      });
    } catch (err) {
      finished = true;
      clearInterval(timer);
      running = false;
      publish({
        ...base,
        done: job.done,
        total: job.total,
        state: 'error',
        msg: messageOf(err),
        file: null,
      });
    } finally {
      releaseDownloads();
    }
  })();

  return true;
}
