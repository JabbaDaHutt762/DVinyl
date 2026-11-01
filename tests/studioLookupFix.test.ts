import test from 'node:test';
import assert from 'node:assert/strict';
import { albumKey, masterLinks, matchingMasters, transientApiError } from '../plugins/music/studioMatching';
import { discogsMastersForStudioAlbum } from '../plugins/music/studioCatalog';
import { albumCoverFallbacks } from '../plugins/music/albumCovers';
import { discogsFetch } from '../plugins/music/discogsFetch';

test('Rolling Stones 12 × 5 matches Discogs 12 X 5', () => {
  assert.equal(albumKey('12 × 5'), albumKey('12 X 5'));
  assert.deepEqual(matchingMasters([
    { id: 1234, title: 'Rolling Stones, The - 12 X 5' },
    { id: 9001, title: '3 Doors Down - 12 X 5' }
  ], 'The Rolling Stones', '12 × 5'), ['1234']);
});

test('MusicBrainz Discogs master relationship extracts stable ID', () => {
  const relations = [
    { url: { resource: 'https://www.discogs.com/master/30169-The-Rolling-Stones-12-X-5' } },
    { url: { resource: 'https://www.discogs.com/master/30169' } },
    { url: { resource: 'https://www.discogs.com/release/9000' } }
  ];
  assert.deepEqual(masterLinks(relations), ['30169']);
});

test('temporary HTTP rate limits and server errors are retryable', () => {
  assert.equal(transientApiError({status:429}), true);
  assert.equal(transientApiError({status:503}), true);
  assert.equal(transientApiError({status:404}), false);
});

test('selected MusicBrainz release group opens its linked Discogs master', async () => {
  const previous = globalThis.fetch;
  const oldToken = process.env.DISCOGS_TOKEN;
  process.env.DISCOGS_TOKEN = 'test-token';
  const requested: string[] = [];
  globalThis.fetch = async (input: any) => {
    const url = String(input);
    requested.push(url);
    return new Response(JSON.stringify({
      relations: [{ url: { resource: 'https://www.discogs.com/master/30169-12-X-5' } }]
    }), { status:200 });
  };
  try {
    const ids = await discogsMastersForStudioAlbum(
      'The Rolling Stones', '12 × 5', '11111111-2222-3333-4444-555555555555'
    );
    assert.deepEqual(ids, ['30169']);
    assert.equal(requested.length, 1);
    assert.match(requested[0]!, /musicbrainz.org\/ws\/2\/release-group/);
  } finally {
    globalThis.fetch = previous;
    if (oldToken === undefined) delete process.env.DISCOGS_TOKEN;
    else process.env.DISCOGS_TOKEN = oldToken;
  }
});

test('album cover provider maps correctly credited matching album art', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({results:[
    { artistName: 'The Doors', collectionName: 'L.A. Woman', artworkUrl100: 'https://example.test/100x100bb.jpg' },
    { artistName: 'Another Artist', collectionName: 'L.A. Woman', artworkUrl100: 'https://example.test/other.jpg' }
  ]}), { status:200 });
  try {
    const covers = await albumCoverFallbacks('The Doors');
    assert.equal(covers.get(albumKey('L.A. Woman')), 'https://example.test/600x600bb.jpg');
  } finally { globalThis.fetch = previous; }
});

test('Discogs 429 responses are retried and token stays out of request URL', async () => {
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.DISCOGS_TOKEN;
  process.env.DISCOGS_TOKEN = 'dummy-test-token';
  let attempts = 0;
  globalThis.fetch = async (input: any, options: any) => {
    attempts++;
    assert.equal(String(input).includes('dummy-test-token'), false);
    assert.equal(options.headers.Authorization, 'Discogs token=dummy-test-token');
    if (attempts === 1) return new Response('Rate limited', {status: 429});
    return new Response(JSON.stringify({results:[{id:100}]}), {status:200});
  };
  try {
    const data = await discogsFetch('https://api.discogs.com/database/search?artist=The+Doors&token=dummy-test-token');
    assert.equal(attempts, 2);
    assert.equal(data.results[0].id, 100);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.DISCOGS_TOKEN;
    else process.env.DISCOGS_TOKEN = oldToken;
  }
});
