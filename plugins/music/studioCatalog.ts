import { fetchJson } from '../../core/helpers';
import type { SearchResult } from '../../core/types';
import { artistKey } from './discogsBrowse';
import { albumKey, masterLinks, matchingMasters, transientApiError } from './studioMatching';
import { albumCoverFallbacks } from './albumCovers';

const MB = 'https://musicbrainz.org/ws/2';
const AGENT = 'DVinyl-Catalog/1.0 (https://github.com/JabbaDaHutt762/DVinyl)';
const catalogCache = new Map<string, { expires: number; results: StudioAlbum[] }>();
let nextRequestAt = 0;
let queue = Promise.resolve();

export interface StudioAlbum extends SearchResult {
  id: string;
  title: string;
  creator: string;
  artist: string;
  year: string;
  cover_image: string;
  cover_image_fallback?: string;
  is_studio_album: boolean;
  is_master: false;
}

/** MusicBrainz supports primary Album and secondary Live/Compilation/Demo/etc. */
export function officialStudioGroups(groups: any[], artistName: string): StudioAlbum[] {
  const used = new Set<string>();
  const results: StudioAlbum[] = [];
  for (const group of groups) {
    if (group['primary-type'] !== 'Album') continue;
    if ((group['secondary-types'] || []).length) continue;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(String(group.id))) continue;
    const title = String(group.title || '').trim();
    const date = String(group['first-release-date'] || '');
    const year = date.match(/^(\d{4})/)?.[1] || '';
    if (!title || !year) continue;
    // Some unclassified collector/bootleg entries have no secondary type.
    if (/\b(?:live at|live in|in concert|unplugged|greatest hits|best of|anthology|bootleg|demos?|outtakes?|radio sessions?|interview|rehearsals?|rarities)\b/i.test(title)) continue;
    const key = title.normalize('NFKC').trim().toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    results.push({
      id: String(group.id), title, creator: artistName, artist: artistName,
      year, cover_image: 'https://coverartarchive.org/release-group/' + group.id + '/front-250',
      is_studio_album: true, is_master: false
    });
  }
  return results.sort((a,b)=>Number(a.year)-Number(b.year) || a.title.localeCompare(b.title));
}

/** MusicBrainz publicly asks clients to average no more than one request per second. */
async function mbJson(path: string): Promise<any> {
  const previous = queue;
  let finished: () => void = () => {};
  queue = new Promise<void>(resolve => { finished = resolve; });
  await previous;
  try {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    for (let attempt = 0; attempt < 3; attempt++) {
      nextRequestAt = Date.now() + 1200;
      try {
        return await fetchJson(MB + path, { headers: {
          'User-Agent': AGENT, 'Accept': 'application/json'
        }, signal: AbortSignal.timeout(15000) });
      } catch (error: any) {
        if (!transientApiError(error) || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(error.retryAfterMs || 1500 * (attempt + 1), 7000)));
      }
    }
    throw new Error('MusicBrainz retries exhausted');
  } finally { finished(); }
}

/**
 * Returns null only when query is not an exact artist name (e.g. an album title).
 * A matching artist with no official studio albums returns [] instead of
 * silently falling back to noisy Discogs search results.
 */
export async function studioAlbumsForArtist(query: string): Promise<StudioAlbum[] | null> {
  const term = query.trim();
  if (!term || term.length > 120) return null;
  const cacheKey = artistKey(term);
  const cached = catalogCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.results;
  const artists = await mbJson('/artist/?query=' + encodeURIComponent('artist:"' + term.replace(/"/g, '') + '"') + '&fmt=json&limit=25');
  const exact = (artists.artists || [])
    .filter((artist: any) => artistKey(String(artist.name || '')) === cacheKey)
    .sort((a: any,b: any) => Number(b.type === 'Group') - Number(a.type === 'Group') || (b.score || 0)-(a.score || 0))[0];
  if (!exact?.id) return null;
  const groups: any[] = [];
  for (let offset=0; offset<300; offset+=100) {
    const payload = await mbJson('/release-group/?artist=' + encodeURIComponent(exact.id)
      + '&type=album&release-group-status=website-default&limit=100&offset=' + offset + '&fmt=json');
    groups.push(...(payload['release-groups'] || []));
    if (offset+100 >= (payload['release-group-count'] || 0)) break;
  }
  const results = officialStudioGroups(groups, String(exact.name));
  const backups = await albumCoverFallbacks(String(exact.name));
  for (const album of results) album.cover_image_fallback = backups.get(albumKey(album.title));
  catalogCache.set(cacheKey, { expires: Date.now() + 30 * 60 * 1000, results });
  if (catalogCache.size > 250) catalogCache.clear();
  return results;
}

/** Look up a selected studio album without relying on exact punctuation. */
export async function discogsMastersForStudioAlbum(
  artist: string, album: string, releaseGroupId?: string
): Promise<string[]> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) throw new Error('Discogs token is missing');

  // Prefer the MusicBrainz relationship: this also handles variants such as
  // The Rolling Stones "12 × 5" vs Discogs "12 X 5".
  if (releaseGroupId && /^[0-9a-f-]{36}$/i.test(releaseGroupId)) {
    try {
      const group = await mbJson('/release-group/' + encodeURIComponent(releaseGroupId) + '?inc=url-rels&fmt=json');
      const linked = masterLinks(group.relations || []);
      if (linked.length) return linked.slice(0, 8);
    } catch (error: any) {
      console.warn('[studio-lookup] MB relationship unavailable:', error.message);
    }
  }

  const discogsLookup = async (params: URLSearchParams): Promise<any> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fetchJson('https://api.discogs.com/database/search?' + params, {
          headers: { 'User-Agent': AGENT, Authorization: 'Discogs token=' + token },
          signal: AbortSignal.timeout(15000)
        });
      } catch (error: any) {
        if (!transientApiError(error) || attempt === 1) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(error.retryAfterMs || 2000, 7000)));
      }
    }
    return { results: [] };
  };

  // First search masters using Discogs' structured title fields. Try the
  // punctuation variant when the database doesn't return the canonical name.
  const spellings = [...new Set([album, album.replace(/\u00d7/g, 'X')])];
  for (const title of spellings) {
    const params = new URLSearchParams({
      artist, release_title: title, type: 'master', per_page: '100'
    });
    const data = await discogsLookup(params);
    const matches = matchingMasters(data.results || [], artist, album);
    if (matches.length) return matches.slice(0, 8);
  }

  // As a final fallback, search physical releases and follow their master_id.
  // Discogs does not always index older album masters under the title spelling.
  const data = await discogsLookup(new URLSearchParams({
    artist, release_title: album, type: 'release', per_page: '100'
  }));
  return matchingMasters(data.results || [], artist, album, true).slice(0, 8);
}
