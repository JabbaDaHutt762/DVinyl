import assert from 'node:assert/strict';
import test from 'node:test';
import { validDiscogsMasterId, prioritizeMatchingMasters } from '../plugins/music/discogsBrowse';
import { DiscogsProvider } from '../plugins/music/discogs';

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
