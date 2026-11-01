/** Discogs master IDs refer to albums, not individual pressings. */
export function validDiscogsMasterId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[1-9][0-9]{0,11}$/.test(value) ? value : undefined;
}

function artistKey(value: string): string {
  return value.replace(/\s*\([0-9]+\)$/, '').normalize('NFKC').trim().toLowerCase();
}

/** Prefer the requested artist without hiding other matches from a title search. */
export function prioritizeMatchingMasters<T extends { title?: string }>(items: T[], query: string): T[] {
  const sought = artistKey(query);
  return [...items].sort((a, b) => {
    const artist = (r: T) => artistKey(String(r.title || '').split(' - ')[0] || '');
    return Number(artist(b) === sought) - Number(artist(a) === sought);
  });
}
