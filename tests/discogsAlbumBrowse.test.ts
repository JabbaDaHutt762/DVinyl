import ejs from 'ejs';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { validDiscogsMasterId, prioritizeMatchingMasters, exactArtistMasters, groupAlbumMasters } from '../plugins/music/discogsBrowse';
import { DiscogsProvider } from '../plugins/music/discogs';
import { officialStudioGroups } from '../plugins/music/studioCatalog';
import { classifyDiscogsMaster, filterDiscogsMasters } from '../plugins/music/discogsFilters';
import { pressingOptions } from '../plugins/music/pressingOptions';

test('master IDs must be numeric and bounded', () => {
  assert.equal(validDiscogsMasterId('12345'), '12345');
  for (const candidate of ['', '0', '12&format=CD', '-4', 'abc', 123, '1'.repeat(13)]) {
    assert.equal(validDiscogsMasterId(candidate), undefined);
  }
});

test('exact artist masters come before unrelated title matches', () => {
  const matches = [
    { id: 1, title: 'Other Band - The Doors' },
    { id: 2, title: 'The Doors - Morrison Hotel' },
    { id: 3, title: 'The Doors - Strange Days' }
  ];
  assert.deepEqual(prioritizeMatchingMasters(matches, 'The Doors').map(r => r.id), [2, 3, 1]);
});

test('default Discogs search returns albums, not each pressing', async () => {
  const oldFetch = globalThis.fetch;
  let called = '';
  globalThis.fetch = async (input: any) => {
    called = String(input);
    return new Response(JSON.stringify({
      results: [{ id: 555, title: 'The Doors - Morrison Hotel', year: 1970, cover_image: 'https://example.test/album.jpg' }]
    }), { status: 200 });
  };
  try {
    const items = await new DiscogsProvider().search('The Doors', { type: 'vinyl' });
    const url = new URL(called);
    assert.equal(url.searchParams.get('type'), 'master');
    assert.equal(url.searchParams.get('per_page'), '100');
    assert.equal(items[0]?.is_master, true);
    assert.equal(items[0]?.title, 'Morrison Hotel');
  } finally { globalThis.fetch = oldFetch; }
});

test('selecting a master fetches physical pressing release IDs', async () => {
  const oldFetch = globalThis.fetch;
  let called = '';
  globalThis.fetch = async (input: any) => {
    called = String(input);
    return new Response(JSON.stringify({
      results: [{ id: 98765, master_id: 555, title: 'The Doors - Morrison Hotel', year: 1979, country: 'US' }]
    }), { status: 200 });
  };
  try {
    const items = await new DiscogsProvider().search('The Doors', {
      type: 'vinyl', browse_mode: 'pressings', master_id: '555', country: 'US'
    });
    const url = new URL(called);
    assert.equal(url.searchParams.get('master_id'), '555');
    assert.equal(url.searchParams.get('type'), 'release');
    assert.equal(url.searchParams.get('format'), 'vinyl');
    assert.equal(url.searchParams.get('country'), 'US');
    assert.equal(items[0]?.id, '98765');
    assert.equal(items[0]?.is_master, false);
  } finally { globalThis.fetch = oldFetch; }
});


test('non-live is default; selecting live only or all changes results', () => {
  const records = [
    { id: 1, title: 'The Doors - Morrison Hotel' },
    { id: 2, title: 'The Doors - Live at the Hollywood Bowl' },
    { id: 3, title: 'Hole - Live Through This' }
  ];
  assert.deepEqual(filterDiscogsMasters(records, {}).map(r => r.id), [1, 3]);
  assert.deepEqual(filterDiscogsMasters(records, { live_filter: 'live_only' }).map(r => r.id), [2]);
  assert.deepEqual(filterDiscogsMasters(records, { live_filter: 'all' }).map(r => r.id), [1, 2, 3]);
});

test('compilations and EPs can be excluded independently', () => {
  const records = [
    { id: 1, title: 'The Doors - Morrison Hotel' },
    { id: 2, title: 'The Doors - Greatest Hits' },
    { id: 3, title: 'The Doors - Hello, I Love You', format: ['Vinyl', 'Single'] },
    { id: 4, title: 'The Doors - Studio EP', format: ['EP'] }
  ];
  assert.deepEqual(filterDiscogsMasters(records, { hide_compilations: '1', hide_singles: '1' }).map(r => r.id), [1]);
  assert.equal(classifyDiscogsMaster({ title: 'Artist - Live Through This' }).live, false);
  assert.equal(classifyDiscogsMaster({ title: 'Artist - In Concert' }).live, true);
});

test('US country filter applies to pressing query, not album master query', async () => {
  const previous = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input: any) => {
    requested.push(String(input));
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };
  try {
    const provider = new DiscogsProvider();
    await provider.search('The Doors', { type: 'vinyl', country: 'US' });
    await provider.search('The Doors', { type: 'vinyl', master_id: '555', country: 'US' });
    assert.equal(new URL(requested[0]!).searchParams.get('country'), null);
    assert.equal(new URL(requested[requested.length - 1]!).searchParams.get('country'), 'US');
  } finally { globalThis.fetch = previous; }
});


test('pressing selector names each edition with country year color label catalog and release ID', () => {
  const rows = pressingOptions([
    { id: 100, title: 'The Doors - Morrison Hotel', year: '1970', country: 'US', variant_info: 'Red Vinyl', label: 'Elektra', catno: 'EKS-75007' },
    { id: 100, title: 'duplicate' },
    { id: 101, year: '2019', country: 'UK', label: ['Rhino'] }
  ]);
  assert.equal(rows.length, 2);
  assert.match(rows[0]!.label, /1970 · US · Red Vinyl · Elektra · EKS-75007 · Discogs #100/);
  assert.match(rows[1]!.label, /Rhino/);
});


test('the doors excludes similar band names and tributes', () => {
  const masterRecords = [
    { id: 1, title: 'The Doors - Morrison Hotel' },
    { id: 2, title: '3 Doors Down - Away from the Sun' },
    { id: 3, title: 'Other Band - A Tribute to The Doors' },
    { id: 4, title: 'The Doors (2) - Strange Days' }
  ];
  assert.deepEqual(exactArtistMasters(masterRecords, 'the doors').map(x => x.id), [1,4]);
});

test('multiple masters of same record yield one card with all pressing sources', () => {
  const masters = [
    { id: 10, title: 'The Doors - The Doors', year: 2017 },
    { id: 11, title: 'The Doors - The Doors', year: 1967 },
    { id: 12, title: 'The Doors - Strange Days', year: 1967 }
  ];
  const grouped = groupAlbumMasters(masters);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0]?.master_ids, ['10', '11']);
  assert.equal(grouped[0]?.year, 1967);
});

test('default Discogs search uses artist-specific query and filters exact artist', async () => {
  const oldFetch = globalThis.fetch;
  const requested: URL[] = [];
  globalThis.fetch = async (input: any) => {
    requested.push(new URL(String(input)));
    return new Response(JSON.stringify({ results: [
      { id: 555, title: 'The Doors - Morrison Hotel' },
      { id: 556, title: '3 Doors Down - Away from the Sun' },
      { id: 557, title: 'The Doors - Morrison Hotel' }
    ] }), { status: 200 });
  };
  try {
    const results = await new DiscogsProvider().search('The Doors', { type: 'vinyl' });
    assert.equal(requested.length, 1);
    assert.equal(requested[0]?.searchParams.get('artist'), 'The Doors');
    assert.equal(requested[0]?.searchParams.get('q'), null);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0]?.master_ids, ['555', '557']);
  } finally { globalThis.fetch = oldFetch; }
});

test('artist query falls back to album title lookup if no matching artist exists', async () => {
  const oldFetch = globalThis.fetch;
  const requested: URL[] = [];
  globalThis.fetch = async (input: any) => {
    const url = new URL(String(input));
    requested.push(url);
    return new Response(JSON.stringify({ results: url.searchParams.has('q')
      ? [{ id: 60, title: 'The Doors - Morrison Hotel' }] : [] }), { status: 200 });
  };
  try {
    const results = await new DiscogsProvider().search('Morrison Hotel', { type: 'vinyl' });
    assert.equal(requested.length, 2);
    assert.equal(requested[0]?.searchParams.get('artist'), 'Morrison Hotel');
    assert.equal(requested[1]?.searchParams.get('q'), 'Morrison Hotel');
    assert.equal(results[0]?.title, 'Morrison Hotel');
  } finally { globalThis.fetch = oldFetch; }
});


test('album and configure templates compile (search/pressing routing smoke test)', () => {
  for (const filename of [
    'core/views/add.ejs',
    'core/views/confirm.ejs',
    'plugins/music/partials/search-form.ejs'
  ]) {
    assert.doesNotThrow(() => ejs.compile(readFileSync(filename, 'utf8'), { filename }), filename);
  }
});


test('core studio catalog only includes original studio albums, not compilations/live/bootlegs/singles', () => {
  const artist = 'The Doors';
  const titles = [
    'The Doors','Strange Days','Waiting for the Sun',
    'The Soft Parade','Morrison Hotel','L.A. Woman'
  ];
  const uuid = (i: number) => '11111111-2222-3333-4444-' + String(i).padStart(12, '0');
  const groups: any[] = [
    ...titles.map((title, i) => ({
      id: uuid(i + 1), title, 'primary-type': 'Album', 'secondary-types': [],
      'first-release-date': i < 2 ? '1967-01-01' : String(1968 + i - 2) + '-01-01'
    })),
    { id: uuid(8), title: 'Absolutely Live', 'primary-type': 'Album', 'secondary-types':['Live'], 'first-release-date':'1970-01-01' },
    { id: uuid(9), title: 'The Best of The Doors', 'primary-type': 'Album', 'secondary-types':['Compilation'], 'first-release-date':'1973' },
    { id: uuid(10), title: 'Live in Europe', 'primary-type': 'Album', 'secondary-types':[], 'first-release-date':'2014' },
    { id: uuid(11), title: 'Light My Fire', 'primary-type': 'Single', 'secondary-types':[], 'first-release-date':'1967' },
    { id: uuid(12), title: 'Rarities', 'primary-type': 'Album', 'secondary-types':[], 'first-release-date':'2011' }
  ];
  const results = officialStudioGroups(groups, artist);
  assert.deepEqual(results.map(x => x.title).sort(), titles.slice().sort());
  assert.equal(results.every(x => x.is_studio_album && !x.is_master), true);
});

test('studio album pages show original release year rather than pressing year', () => {
  const rows = officialStudioGroups([{
    id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: 'Abbey Road', 'primary-type':'Album', 'secondary-types':[],
    'first-release-date':'1969-09-26'
  }], 'The Beatles');
  assert.equal(rows[0]?.year, '1969');
  assert.match(rows[0]!.cover_image, /coverartarchive.org\/release-group\/aaaaaaaa/);
});
