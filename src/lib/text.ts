const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function plainText(html: string) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED[name.toLowerCase()] ?? match)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function messageOf(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Try again.';
}

export function epubBaseName(name: string) {
  const base = String(name || '').split(/[/\\]/).pop() || '';
  if (!base.toLowerCase().endsWith('.epub') || base === '.epub' || base.includes('\0')) {
    throw new Error('Invalid book file.');
  }
  return base;
}

export function displayTitle(name: string) {
  return name.replace(/\.epub$/i, '');
}

export function sameId(a: string | number | null | undefined, b: string | number | null | undefined) {
  return String(a ?? '') === String(b ?? '');
}
