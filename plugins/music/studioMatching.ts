import { artistKey } from './discogsBrowse';

/** Match album spellings like "12 × 5", "12 X 5", and "12x5". */
export function albumKey(value: string): string {
  return value.normalize('NFKD').toLowerCase()
    .replace(/\u00d7|\u2715|\u2716/g, 'x')
    .replace(/\([^)]*(?:remaster|deluxe|reissue|edition)[^)]*\)/gi, '')
    .replace(/[^a-z0-9]/g, '');
}
export function masterLinks(relations: any[]): string[] {
  const result: string[] = [];
  for (const relation of relations || []) {
    const url = String(relation?.url?.resource || '');
    const match = url.match(/discogs\.com\/(?:[a-z]{2}\/)?master\/([1-9][0-9]{0,11})(?:[-/?#]|$)/i);
    if (match && !result.includes(match[1])) result.push(match[1]);
  }
  return result;
}
export function matchingMasters(results: any[], artist: string, album: string, fromReleases = false): string[] {
  const result: string[] = [];
  for (const item of results || []) {
    const title = String(item.title || '');
    const sep = title.indexOf(' - ');
    const itemArtist = sep < 0 ? String(item.artist || '') : title.slice(0, sep);
    const itemAlbum = sep < 0 ? title : title.slice(sep + 3);
    if (artistKey(itemArtist) !== artistKey(artist) || albumKey(itemAlbum) !== albumKey(album)) continue;
    const id = String(fromReleases ? (item.master_id || '') : (item.id || ''));
    if (/^[1-9][0-9]{0,11}$/.test(id) && !result.includes(id)) result.push(id);
  }
  return result;
}
export function transientApiError(error: any): boolean {
  return [429, 500, 502, 503, 504].includes(Number(error?.status));
}
