/**
 * Discogs master metadata rarely has a definitive studio/live field.
 * Classify conservatively from format descriptors and recognisable titles.
 * Unknown recordings remain visible under Non-live.
 */
export type LiveFilter = 'non_live' | 'live_only' | 'all';

export function classifyDiscogsMaster(item: any): { live: boolean; compilation: boolean; singleOrEp: boolean } {
  const fullTitle = String(item?.title || '');
  const dash = fullTitle.indexOf(' - ');
  const albumTitle = dash < 0 ? fullTitle : fullTitle.slice(dash + 3);
  const formatParts = [
    ...(Array.isArray(item?.format) ? item.format : []),
    ...(Array.isArray(item?.formats) ? item.formats.flatMap((entry: any) =>
      typeof entry === 'string' ? [entry] : [
        entry?.name, ...(Array.isArray(entry?.descriptions) ? entry.descriptions : [])
      ]) : [])
  ].filter((v): v is string => typeof v === 'string');
  const fmt = formatParts.join(' | ');

  // Deliberately avoid interpreting "Live Through This" or "Live and Let Die"
  // as concert recordings just because they contain the word "Live".
  const liveTitle = /(?:\blive\s+(?:at|in|from|on|concert|sessions?|recordings?)\b|\bin concert\b|\bunplugged\b|\bconcert recordings?\b|(?:^|[\s(])live[!.)\s]*$)/i.test(albumTitle);
  const liveFormat = /(?:^|\|)\s*live\s*(?:\||$)/i.test(fmt);
  const compilationTitle = /\bgreatest hits\b|\bbest of\b|\bthe essential\b|\banthology\b|\bcompilations?\b|\bsingles collection\b/i.test(albumTitle);
  const compilationFormat = /\bcompilations?\b/i.test(fmt);
  const singleFormat = /\b(?:single|ep|mini-album|maxi-single)\b/i.test(fmt);
  const singleTitle = /\b(?:ep|single)\s*$/i.test(albumTitle);
  return {
    live: liveTitle || liveFormat,
    compilation: compilationTitle || compilationFormat,
    singleOrEp: singleFormat || singleTitle
  };
}

export function filterDiscogsMasters<T extends { title?: string }>(
  items: T[],
  opts: { live_filter?: string; hide_compilations?: string; hide_singles?: string }
): T[] {
  const mode: LiveFilter = opts.live_filter === 'live_only' || opts.live_filter === 'all'
    ? opts.live_filter : 'non_live';
  return items.filter(item => {
    const category = classifyDiscogsMaster(item);
    if (mode === 'non_live' && category.live) return false;
    if (mode === 'live_only' && !category.live) return false;
    if (opts.hide_compilations === '1' && category.compilation) return false;
    if (opts.hide_singles === '1' && category.singleOrEp) return false;
    return true;
  });
}
