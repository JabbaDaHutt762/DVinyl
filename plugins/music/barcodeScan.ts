/**
 * Barcode scanning is a separate lookup workflow, never an artist's filtered
 * album browse. A barcode may belong to live recordings, imports, singles or
 * compilations regardless of the visible collection search preferences.
 */
export function unfilteredMusicLookup(type: string): Record<string, string> {
  return {
    type: ['vinyl','cd','cassette'].includes(type) ? type : 'vinyl',
    browse_mode: 'pressings',
    catalog_scope: 'all',
    artist_scope: 'all',
    live_filter: 'all',
    hide_compilations: '0',
    hide_singles: '0',
    year: '',
    country: '',
    genre_filter: '',
    label_filter: '',
    format_filter: ''
  };
}

export function isMusicBarcodeScan(pluginId: string, rawQuery: string, _scannedCode = ''): boolean {
  // A barcode from a PREVIOUS scan is only metadata for its result, never
  // authorization to bypass filters on the user's NEW text query.
  return pluginId === 'music' && /^[0-9]{12,13}$/.test(rawQuery.replace(/[- ]/g, ''));
}

export interface BarcodePressing {
  id: string;
  year?: string;
  country?: string;
  variant_info?: string;
  label?: string;
  catno?: string;
}
export interface BarcodeAlbumGroup {
  artist: string;
  title: string;
  year: string;
  cover_image: string;
  pressings: BarcodePressing[];
}

/** Multiple physical releases matching one UPC become one album card. */
export function groupBarcodeResults(results: any[]): BarcodeAlbumGroup[] {
  const grouped = new Map<string, BarcodeAlbumGroup>();
  for (const result of results || []) {
    const id = String(result?.id || '');
    if (!/^[1-9][0-9]{0,11}$/.test(id)) continue;
    const artist = String(result?.artist || result?.creator || '').trim();
    const title = String(result?.title || '').trim();
    if (!title || !artist) continue;
    const key = artist.normalize('NFKC').trim().toLowerCase()
      + '\u0000' + title.normalize('NFKC').trim().toLowerCase();
    let group = grouped.get(key);
    if (!group) {
      group = {
        artist, title, year: String(result.year || ''),
        cover_image: String(result.cover_image || ''),
        pressings: []
      };
      grouped.set(key, group);
    }
    if (group.pressings.some(pressing => pressing.id === id)) continue;
    group.pressings.push({
      id, year: String(result.year || ''), country: String(result.country || ''),
      variant_info: String(result.variant_info || ''), label: String(result.label || ''),
      catno: String(result.catno || '')
    });
    const year = Number(result.year);
    const previousYear = Number(group.year);
    if (Number.isInteger(year) && year > 1800
      && (!Number.isInteger(previousYear) || previousYear < 1800 || year < previousYear)) {
      group.year = String(year);
    }
  }
  return [...grouped.values()];
}
