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

export function isMusicBarcodeScan(pluginId: string, rawQuery: string, scannedCode: string): boolean {
  return pluginId === 'music'
    && (/^[0-9]{12,13}$/.test(rawQuery.replace(/[- ]/g, ''))
      || /^[0-9]{12,13}$/.test(scannedCode.replace(/[- ]/g, '')));
}
