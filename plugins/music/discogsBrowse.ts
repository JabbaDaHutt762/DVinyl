/** Discogs master IDs refer to albums, not individual pressings. */
export function validDiscogsMasterId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[1-9][0-9]{0,11}$/.test(value) ? value : undefined;
}
export function artistKey(value: string): string {
  return value.normalize('NFKC').replace(/\s*\([0-9]+\)\s*$/, '')
    .replace(/^(.+),\s*The$/i, 'The $1').trim().toLowerCase();
}
export function artistFromMaster(item: {title?: string; artist?: string}): string {
  const title = String(item.title || '');
  const split = title.indexOf(' - ');
  return split < 0 ? String(item.artist || '') : title.slice(0, split);
}
export function exactArtistMasters<T extends {title?: string; artist?: string}>(items: T[], query: string): T[] {
  return items.filter(item => artistKey(artistFromMaster(item)) === artistKey(query));
}
export function prioritizeMatchingMasters<T extends {title?: string; artist?: string}>(items: T[], query: string): T[] {
  return [...items].sort((a,b) => Number(artistKey(artistFromMaster(b)) === artistKey(query))
    - Number(artistKey(artistFromMaster(a)) === artistKey(query)));
}
/** One visible album card can represent multiple master entries, without losing their pressings. */
export function groupAlbumMasters<T extends {id?: string | number; title?: string; artist?: string; year?: string | number}>(items: T[]): (T & {master_ids: string[]})[] {
  const grouped = new Map<string, T & {master_ids: string[]}>();
  for (const item of items) {
    const id = validDiscogsMasterId(String(item.id || ''));
    if (!id) continue;
    const title = String(item.title || '');
    const split = title.indexOf(' - ');
    const album = (split < 0 ? title : title.slice(split + 3)).normalize('NFKC').trim().toLowerCase();
    const key = artistKey(artistFromMaster(item)) + '\0' + album;
    const group = grouped.get(key);
    if (!group) {
      grouped.set(key, {...item, master_ids:[id]});
    } else {
      if (!group.master_ids.includes(id) && group.master_ids.length < 12) group.master_ids.push(id);
      const oldYear = Number(group.year), year = Number(item.year);
      if (Number.isInteger(year) && year > 1800 && (!Number.isInteger(oldYear) || oldYear < 1800 || year < oldYear)) group.year = item.year;
    }
  }
  return [...grouped.values()];
}
