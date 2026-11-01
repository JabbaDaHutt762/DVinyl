export interface PressingOption {
  id: string;
  label: string;
  year?: string;
  country?: string;
}

/** Build recognizable labels from public Discogs release search metadata. */
export function pressingOptions(results: any[]): PressingOption[] {
  const seen = new Set<string>();
  return results.flatMap(result => {
    const id = String(result?.id || '');
    if (!/^[1-9][0-9]{0,11}$/.test(id) || seen.has(id)) return [];
    seen.add(id);
    const year = String(result.year || '').trim();
    const country = String(result.country || '').trim();
    const catalog = String(result.catno || result.catalog_number || '').trim();
    const label = Array.isArray(result.label)
      ? result.label.filter((x: any) => typeof x === 'string').join(', ')
      : String(result.label || '').trim();
    const edition = String(result.variant_info || '').trim();
    const parts = [year, country, edition, label, catalog].filter(Boolean);
    return [{ id, label: (parts.join(' · ') || 'Unspecified pressing') + ' · Discogs #' + id, year, country }];
  });
}
