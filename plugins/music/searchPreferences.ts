/**
 * One search preset shared by Add Record and Wishlist.
 * Unchecked checkboxes are absent in HTML POST bodies: the hidden marker
 * distinguishes an intentional "off" from a missing legacy field.
 */
export const MUSIC_FILTER_DEFAULTS = {
  browse_mode: 'albums',
  catalog_scope: 'studio',
  artist_scope: 'artist',
  live_filter: 'non_live',
  hide_compilations: '1',
  hide_singles: '1',
  country: 'US'
} as const;

export function musicSearchPreferences(
  posted: Record<string, unknown>,
  provided: Record<string, string>
): Record<string, string> {
  const values: Record<string, string> = { ...MUSIC_FILTER_DEFAULTS, ...provided };
  const fromFullForm = posted.music_filters_present === '1';

  for (const key of ['hide_compilations', 'hide_singles']) {
    if (fromFullForm) values[key] = posted[key] === '1' ? '1' : '0';
    else if (values[key] !== '0' && values[key] !== '1') values[key] = '1';
  }
  if (values.browse_mode !== 'pressings') values.browse_mode = 'albums';
  if (values.catalog_scope !== 'all') values.catalog_scope = 'studio';
  if (values.artist_scope !== 'all') values.artist_scope = 'artist';
  if (!['non_live', 'live_only', 'all'].includes(values.live_filter)) values.live_filter = 'non_live';

  // "Core studio albums" and "Live only" are mutually exclusive categories.
  // If someone chooses Live only or All recordings, honor the requested category
  // by switching the catalog to Discogs rather than silently ignoring the filter.
  if (values.browse_mode === 'albums' && values.live_filter !== 'non_live') {
    values.catalog_scope = 'all';
  }
  return values;
}
