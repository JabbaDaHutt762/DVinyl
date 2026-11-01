import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ejs from 'ejs';
import { DiscogsProvider } from '../plugins/music/discogs';
import { unfilteredMusicLookup, isMusicBarcodeScan } from '../plugins/music/barcodeScan';

test('music scan removes every browsing filter without changing normal defaults', () => {
  const opts = unfilteredMusicLookup('vinyl');
  for (const key of ['country','year','label_filter','genre_filter','format_filter']) assert.equal(opts[key], '');
  assert.equal(opts.live_filter,'all');
  assert.equal(opts.catalog_scope,'all');
  assert.equal(opts.artist_scope,'all');
  assert.equal(opts.hide_compilations,'0');
  assert.equal(opts.hide_singles,'0');
  assert.equal(isMusicBarcodeScan('music','012345678905',''),true);
  assert.equal(isMusicBarcodeScan('music','The Beatles','012345678905'),true);
  assert.equal(isMusicBarcodeScan('music','The Beatles',''),false);
  assert.equal(isMusicBarcodeScan('book','012345678905',''),false);
});

test('exact barcode queries Discogs releases without ANY album or pressing filter', async () => {
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.DISCOGS_TOKEN;
  process.env.DISCOGS_TOKEN = 'scan-test-token';
  const requested: URL[] = [];
  globalThis.fetch = async (input: any) => {
    requested.push(new URL(String(input)));
    return new Response(JSON.stringify({results:[{
      id: 99220, title:'The Doors - L.A. Woman', country:'UK', year: 1971,
      format:['Vinyl','LP']
    }]}),{status:200});
  };
  try {
    const results = await new DiscogsProvider().search('012345678905', {
      ...unfilteredMusicLookup('vinyl'), country:'US', year:'1969',
      label_filter:'Elektra', format_filter:'LP', barcode_lookup: true
    } as any);
    assert.equal(requested.length,1);
    const url = requested[0]!;
    assert.equal(url.searchParams.get('barcode'),'012345678905');
    assert.equal(url.searchParams.get('type'),'release');
    for (const key of ['country','year','label','format','genre','artist','q'])
      assert.equal(url.searchParams.get(key),null,key);
    assert.equal(results[0]?.is_master,false);
    assert.equal(results[0]?.id,'99220');
  } finally {
    globalThis.fetch = oldFetch;
    if(oldToken===undefined)delete process.env.DISCOGS_TOKEN;
    else process.env.DISCOGS_TOKEN=oldToken;
  }
});

test('unidentified barcode title uses all Discogs album masters, not a guessed pressing', async () => {
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.DISCOGS_TOKEN;
  process.env.DISCOGS_TOKEN = 'scan-test-token';
  const requested: URL[] = [];
  globalThis.fetch = async (input: any) => {
    requested.push(new URL(String(input)));
    return new Response(JSON.stringify({results:[
      {id:71,title:'The Doors - L.A. Woman',year:1971},
      {id:72,title:'The Doors - L.A. Woman',year:2019},
      {id:73,title:'The Doors - L.A. Woman Live',year:1983},
      {id:74,title:'Another Band - The Doors Live',year:1984}
    ]}),{status:200});
  };
  try {
    const results = await new DiscogsProvider().search('L.A. Woman', {
      ...unfilteredMusicLookup('vinyl'), barcode_lookup: true
    } as any);
    assert.equal(requested.length,1);
    assert.equal(requested[0]?.searchParams.get('q'),'L.A. Woman');
    assert.equal(requested[0]?.searchParams.get('type'),'master');
    assert.equal(requested[0]?.searchParams.get('format'),null);
    assert.equal(results[0]?.is_master,true);
    assert.deepEqual(results.find(x=>x.title==='L.A. Woman')?.master_ids,['71','72']);
    assert.ok(results.some(x=>x.title==='L.A. Woman Live'));
    assert.ok(results.some(x=>x.title==='The Doors Live'));
  } finally {
    globalThis.fetch = oldFetch;
    if(oldToken===undefined)delete process.env.DISCOGS_TOKEN;
    else process.env.DISCOGS_TOKEN=oldToken;
  }
});

test('album editor allows Collection and Wishlist saves without selecting pressing', () => {
  const confirm = readFileSync('core/views/confirm.ejs','utf8');
  assert.doesNotMatch(confirm,/name="in_wishlist" value="(?:true|false)"[^\n]*disabled/);
  assert.doesNotMatch(confirm,/aria-describedby="pressing-choice-help" required/);
  assert.match(confirm,/Pressing is optional/);
  assert.match(confirm,/data-scanned-barcode/);
  assert.match(confirm,/searchParams.set\('barcode', selection.dataset.scannedBarcode\)/);
  const add = readFileSync('core/views/add.ejs','utf8');
  assert.match(add,/&barcode=<%= encodeURIComponent\(locals.scanned_barcode \|\| ''\) %>/);
  const route = readFileSync('core/routes/itemRoutes.ts','utf8');
  assert.match(route,/editionUnselected \? '' : String\(externalId\)/);
  assert.match(route,/delete details.discogs_id/);
  assert.match(route,/unfilteredMusicLookup\(type \|\| 'vinyl'\)/);
  assert.match(route,/\/add-music\/manual/);
  assert.doesNotThrow(()=>ejs.compile(confirm,{filename:'core/views/confirm.ejs'}));
  assert.doesNotThrow(()=>ejs.compile(add,{filename:'core/views/add.ejs'}));
});
