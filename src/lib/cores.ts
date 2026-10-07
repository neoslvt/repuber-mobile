import { allCores, getCore } from '../../ranobelib-epub/src/cores/index.js';

import type { BookInfo, BuildInput, BuildJob, SearchHit, SourceInfo } from '@/lib/types';

// The desktop project's source cores. This file only calls them.
type CoreLike = {
  id: string;
  name: string;
  linkRe: string;
  public: () => SourceInfo;
  search: (query: string) => Promise<SearchHit[] | null | undefined>;
  info: (query: string) => Promise<Partial<BookInfo>>;
  build: (job: BuildJob, data: BuildInput) => Promise<{ filename: string; bytes: Uint8Array }>;
};

function coreById(coreId: string) {
  return getCore(coreId) as CoreLike;
}

export function listSources(): SourceInfo[] {
  return (allCores() as CoreLike[]).map((core) => core.public());
}

export function isDirectQuery(coreId: string, query: string) {
  let pattern = '';
  try {
    pattern = coreById(coreId).linkRe || '';
  } catch {
    return /^https?:\/\//.test(query);
  }
  if (!pattern) return /^https?:\/\//.test(query);
  try {
    return new RegExp(pattern).test(query);
  } catch {
    return /^https?:\/\//.test(query);
  }
}

export async function searchBooks(coreId: string, query: string): Promise<SearchHit[]> {
  const core = coreById(coreId);
  const hits = (await core.search(query)) ?? [];
  return hits.map((hit) => ({
    ...hit,
    core: core.id,
    source: core.name,
  }));
}

export async function loadBook(coreId: string, query: string): Promise<BookInfo> {
  const core = coreById(coreId);
  const payload = await core.info(query);
  const facts = (payload.facts || [])
    .filter((pair): pair is [string, string] => Array.isArray(pair) && pair.length >= 2)
    .map(([label, value]) => [String(label), String(value ?? '')] as [string, string]);
  return {
    alt: payload.alt || '',
    other: payload.other || [],
    summary: payload.summary || '',
    genres: payload.genres || [],
    tags: payload.tags || [],
    authors: payload.authors || [],
    artists: payload.artists || [],
    notes: payload.notes || [],
    facts,
    slug: payload.slug || query,
    chapters: payload.chapters || 0,
    title: payload.title || query,
    cover: payload.cover || '',
    volumes: payload.volumes || [],
    branches: payload.branches || [],
    core: core.id,
  };
}

export function buildBook(coreId: string, job: BuildJob, data: BuildInput) {
  return coreById(coreId).build(job, data);
}
