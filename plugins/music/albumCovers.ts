import { fetchJson } from '../../core/helpers';
import { artistKey } from './discogsBrowse';
import { albumKey } from './studioMatching';

/** Secondary artwork for Cover Art Archive records with unavailable thumbnails. */
export async function albumCoverFallbacks(artist: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  try {
    const params = new URLSearchParams({ term: artist, entity: 'album', limit: '200' });
    const data = await fetchJson('https://itunes.apple.com/search?' + params, {
      headers: { 'User-Agent': 'DVinyl-Catalog/1.0' },
      signal: AbortSignal.timeout(9000)
    });
    for (const item of data.results || []) {
      if (artistKey(String(item.artistName || '')) !== artistKey(artist)) continue;
      const key = albumKey(String(item.collectionName || ''));
      if (!key || found.has(key) || !item.artworkUrl100) continue;
      found.set(key, String(item.artworkUrl100).replace(/100x100(?:bb)?\.jpg(?:\?.*)?$/, '600x600bb.jpg'));
    }
  } catch (error: any) {
    console.warn('[studio-cover] Backup album artwork unavailable:', error.message);
  }
  return found;
}
