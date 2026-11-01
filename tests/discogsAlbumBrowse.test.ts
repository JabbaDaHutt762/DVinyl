import assert from 'node:assert/strict';
import test from 'node:test';
import { validDiscogsMasterId, prioritizeMatchingMasters } from '../plugins/music/discogsBrowse';
import { DiscogsProvider } from '../plugins/music/discogs';
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
    assert.equal(new URL(requested[1]!).searchParams.get('country'), 'US');
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
