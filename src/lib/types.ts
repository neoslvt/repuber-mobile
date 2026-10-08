export type SourceInfo = {
  id: string;
  name: string;
  description: string;
  link: string;
  placeholder: string;
};

export type SearchHit = {
  slug: string;
  title: string;
  alt: string;
  cover: string;
  type: string;
  year: string | number;
  rating: string;
  status: string;
  core: string;
  source: string;
};

export type VolumeInfo = {
  v: string;
  n: number;
};

export type BranchInfo = {
  id: string | number | null;
  chapters: number;
  name: string;
};

export type BookInfo = {
  alt: string;
  other: string[];
  summary: string;
  genres: string[];
  tags: string[];
  authors: string[];
  artists: string[];
  notes: string[];
  facts: [string, string][];
  slug: string;
  chapters: number;
  title: string;
  cover: string;
  volumes: VolumeInfo[];
  branches: BranchInfo[];
  core: string;
};

export type BuildInput = {
  core: string;
  slug: string;
  title: string;
  cover: string;
  branch: string | number | null;
  team: string;
  volumes: string[];
};

export type BuildJob = {
  done: number;
  total: number;
  msg: string;
};

export type LibraryBook = {
  name: string;
  mb: number;
  mtime: number;
  cover?: string;
};

export type BuildSnapshot = {
  title: string;
  cover: string;
  team: string;
  done: number;
  total: number;
  state: 'running' | 'done' | 'error';
  msg: string;
  file: string | null;
};
