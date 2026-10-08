import { unzipSync } from 'fflate';

// Pulls the cover image out of an EPUB without unpacking the chapters.
export function coverBytes(epub: Uint8Array): { ext: string; bytes: Uint8Array } | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(epub, {
      filter: (file) => /(?:^|\/)cover\.(jpe?g|png|webp)$/i.test(file.name),
    });
  } catch {
    return null;
  }
  const name = Object.keys(files).sort((a, b) => Number(b.includes('OEBPS/')) - Number(a.includes('OEBPS/')))[0];
  const bytes = name ? files[name] : undefined;
  if (!name || !bytes?.length) return null;
  const raw = name.split('.').pop()?.toLowerCase() || 'jpg';
  return { ext: raw === 'jpeg' ? 'jpg' : raw, bytes };
}
