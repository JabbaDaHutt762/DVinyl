import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ejs from 'ejs';
import { MUSIC_FILTER_DEFAULTS, musicSearchPreferences } from '../plugins/music/searchPreferences';
import { filterDiscogsMasters } from '../plugins/music/discogsFilters';
import { groupAlbumMasters } from '../plugins/music/discogsBrowse';
import { officialStudioGroups } from '../plugins/music/studioCatalog';

test('fresh searches default to original studio albums and exclude live, compilations and singles', () => {
  const prefs = musicSearchPreferences({}, {});
  assert.deepEqual(Object.fromEntries(Object.keys(MUSIC_FILTER_DEFAULTS).map(key => [key, prefs[key]])),
    MUSIC_FILTER_DEFAULTS);
  assert.equal(prefs.catalog_scope, 'studio');
  assert.equal(prefs.live_filter, 'non_live');
  assert.equal(prefs.hide_compilations, '1');
  assert.equal(prefs.hide_singles, '1');
  assert.equal(prefs.country, 'US');
});

test('unchecked checkboxes stay off after search and returning from a pressing', () => {
  const first = musicSearchPreferences({ music_filters_present: '1' }, {
    catalog_scope: 'all', browse_mode: 'albums', live_filter: 'all'
  });
  assert.equal(first.hide_compilations, '0');
  assert.equal(first.hide_singles, '0');
  const back = musicSearchPreferences({}, { ...first, browse_mode: 'albums' });
  assert.equal(back.hide_compilations, '0');
  assert.equal(back.hide_singles, '0');
  assert.equal(back.catalog_scope, 'all');
  assert.equal(back.live_filter, 'all');
});

test('live-only changes the catalog scope rather than silently returning studio results', () => {
  const prefs = musicSearchPreferences({ music_filters_present: '1', hide_compilations: '1' },
    { browse_mode: 'albums', catalog_scope: 'studio', live_filter: 'live_only' });
  assert.equal(prefs.catalog_scope, 'all');
  assert.equal(prefs.live_filter, 'live_only');
  assert.equal(prefs.hide_compilations, '1');
  assert.equal(prefs.hide_singles, '0');
});

test('grouped albums remain one card while retaining all master IDs', () => {
  const groups = groupAlbumMasters([
    {id: 101, title: 'The Doors - Morrison Hotel', year: 1970},
    {id: 102, title: 'The Doors - Morrison Hotel', year: 2018},
    {id: 103, title: 'The Doors - Strange Days', year: 1967}
  ]);
  assert.deepEqual(groups.map(x => x.master_ids), [['101','102'], ['103']]);
});

test('Discogs non-live and exclusion toggles correctly filter the album group', () => {
  const records = [
    { id:1, title:'The Doors - Morrison Hotel' },
    { id:2, title:'The Doors - Live at the Hollywood Bowl' },
    { id:3, title:'The Doors - Greatest Hits' },
    { id:4, title:'The Doors - Light My Fire EP', format:['EP'] }
  ];
  const prefs = musicSearchPreferences({}, {});
  assert.deepEqual(filterDiscogsMasters(records, prefs).map(x => x.id), [1]);
});

test('MusicBrainz studio grouping still excludes secondary types', () => {
  const id = (n: number) => 'aaaaaaaa-bbbb-cccc-dddd-' + String(n).padStart(12, '0');
  const records = [
    { id:id(1), title:'Morrison Hotel', 'primary-type':'Album', 'secondary-types':[], 'first-release-date':'1970' },
    { id:id(2), title:'Absolutely Live', 'primary-type':'Album', 'secondary-types':['Live'], 'first-release-date':'1970' },
    { id:id(3), title:'Greatest Hits', 'primary-type':'Album', 'secondary-types':['Compilation'], 'first-release-date':'1980' }
  ];
  assert.deepEqual(officialStudioGroups(records, 'The Doors').map(x=>x.title), ['Morrison Hotel']);
});

test('both album click and back-to-albums templates preserve catalog and artist scope', () => {
  const view = readFileSync('core/views/add.ejs','utf8');
  const form = readFileSync('plugins/music/partials/search-form.ejs','utf8');
  assert.match(view, /name="master_ids" value="<%= selectedMaster.master_ids/);
  // Back-to-Albums and pressing-refinement forms retain both selections.
  // Album cards now navigate directly via a GET link, not a third POST form.
  assert.ok((view.match(/name="catalog_scope" value=/g) || []).length >= 2);
  assert.ok((view.match(/name="artist_scope" value=/g) || []).length >= 2);
  assert.match(view, /href="<%= baseUrl %>\/confirm-music\//);
  assert.match(form, /name="music_filters_present"/);
  for (const file of ['core/views/add.ejs', 'plugins/music/partials/search-form.ejs'])
    assert.doesNotThrow(() => ejs.compile(readFileSync(file,'utf8'), {filename:file}));
});
