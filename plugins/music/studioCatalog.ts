import { fetchJson } from '../../core/helpers';
import type { SearchResult } from '../../core/types';
import { artistKey } from './discogsBrowse';

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
    nextRequestAt = Date.now() + 1200;
    return await fetchJson(MB + path, { headers: {
      'User-Agent': AGENT, 'Accept': 'application/json'
    } });
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
  catalogCache.set(cacheKey, { expires: Date.now() + 30 * 60 * 1000, results });
  if (catalogCache.size > 250) catalogCache.clear();
  return results;
}

/** Resolve a selected canonical studio album to its Discogs master releases. */
export async function discogsMastersForStudioAlbum(artist: string, album: string): Promise<string[]> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) throw new Error('Discogs token is missing');
  const params = new URLSearchParams({
    artist, release_title: album, type: 'master', per_page: '100'
  });
  const payload = await fetchJson('https://api.discogs.com/database/search?' + params.toString(), {
    headers: { 'User-Agent': 'DVinylApp/1.0', 'Authorization': 'Discogs token=' + token }
  });
  const albumKey = (value: string) => value.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]/g,'');
  const expected = albumKey(album);
  return (payload.results || []).filter((item: any) => {
    const full = String(item.title || '');
    const split = full.indexOf(' - ');
    if (split < 0) return false;
    const name = full.slice(0,split);
    const title = full.slice(split+3);
    return artistKey(name) === artistKey(artist) && albumKey(title) === expected;
  }).map((item: any) => String(item.id))
    .filter((id: string) => /^[1-9]\d{0,11}$/.test(id)).slice(0,8);
}
