import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ejs from 'ejs';
import { groupBarcodeResults, isMusicBarcodeScan } from '../plugins/music/barcodeScan';
import { musicSearchPreferences } from '../plugins/music/searchPreferences';

test('the same scanned barcode produces album cards, not 50 White Album release cards', () => {
  const releases = Array.from({length: 50}, (_, i) => ({
    id: 80000 + i, title: i < 48 ? 'The Beatles' : 'Introducing... The Beatles',
    artist: 'The Beatles', year: i < 48 ? '1968' : '1964',
    country: 'US', label: 'Apple Records', catno: 'SWBO-101',
    cover_image: 'https://i.discogs.com/cover.jpg'
  }));
  const albums = groupBarcodeResults(releases);
  assert.equal(albums.length, 2);
  assert.equal(albums[0]?.title, 'The Beatles');
  assert.equal(albums[0]?.pressings.length, 48);
  assert.equal(albums[1]?.title, 'Introducing... The Beatles');
  assert.equal(albums[1]?.pressings.length, 2);
  assert.equal(albums[0]?.pressings[0]?.id, '80000');
  assert.equal(albums[0]?.pressings[47]?.id, '80047');
});

test('the scan cannot poison a subsequent artist text query', () => {
  assert.equal(isMusicBarcodeScan('music','012345678905',''),true);
  assert.equal(isMusicBarcodeScan('music','the beatles','012345678905'),false);
  assert.equal(isMusicBarcodeScan('music','the rolling stones','012345678905'),false);
  assert.deepEqual(
    Object.fromEntries(['browse_mode','catalog_scope','artist_scope','live_filter',
      'hide_compilations','hide_singles','country'].map(k=>[k, musicSearchPreferences({}, {})[k]])),
    { browse_mode:'albums', catalog_scope:'studio', artist_scope:'artist',
      live_filter:'non_live', hide_compilations:'1', hide_singles:'1', country:'US' }
  );
});

test('scan routes preserve exact UPC in editor but have no required master ID', () => {
  const route = readFileSync('core/routes/itemRoutes.ts','utf8');
  const add = readFileSync('core/views/add.ejs','utf8');
  const confirm = readFileSync('core/views/confirm.ejs','utf8');
  assert.match(route, /results: groupedResults/);
  assert.match(route, /groupBarcodeResults\(scanMatches\)/);
  assert.match(route, /barcodeScanResults: true/);
  assert.match(route, /isScan = \/\^scan-/);
  assert.match(route, /pressings: pressingOptions\(album.pressings\)/);
  assert.match(route, /if \(plugin.id === 'music' && !unfilteredScan\) scannedBarcode = ''/);
  assert.match(add, /item.is_barcode_album/);
  assert.match(add, /!locals.barcodeScanResults/);
  assert.match(add, /scan-/);
  assert.match(confirm, /if \(selection.dataset.masterId\)/);
  assert.match(confirm, /Pressing is optional/);
  assert.doesNotThrow(()=>ejs.compile(add,{filename:'core/views/add.ejs'}));
  assert.doesNotThrow(()=>ejs.compile(confirm,{filename:'core/views/confirm.ejs'}));
});
