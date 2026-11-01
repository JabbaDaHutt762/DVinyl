import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import { readFileSync } from 'node:fs';

test('album cards navigate directly into Configure Album instead of POSTing to search', () => {
  const markup = readFileSync('core/views/add.ejs', 'utf8');
  const start = markup.indexOf('const albumMaster');
  const end = markup.indexOf('<div class="relative', start);
  const card = markup.slice(start, end);
  assert.match(card, /href="<%= baseUrl %>\/confirm-music\//);
  assert.match(card, /studio-/);
  assert.match(card, /master-/);
  assert.doesNotMatch(card, /<form\s+method="POST"/);
  assert.match(card, /master_ids/);
  assert.match(card, /country=/);
});

test('Configure Album previews do not make an external detail request', () => {
  const route = readFileSync('core/routes/itemRoutes.ts','utf8');
  assert.match(route, /const studioPreview = plugin.id === 'music'/);
  assert.match(route, /const details = studioPreview \? \{/);
  assert.match(route, /\} : await source\.getDetails\(externalId/);
  assert.match(route, /pressingSelectionPending = studioPreview/);
  assert.match(route, /\/api\/music\/album-pressings\/:albumId/);
});

test('the edition selector loads asynchronously and allows retry in place', () => {
  const confirm = readFileSync('core/views/confirm.ejs','utf8');
  assert.match(confirm, /data-api-url/);
  assert.match(confirm, /id="retry-pressings"/);
  assert.match(confirm, /fetch\(selection\.dataset\.apiUrl/);
  assert.match(confirm, /retry\.addEventListener\('click', fetchPressings\)/);
  assert.match(confirm, /selection\.dataset\.masterIds/);
  assert.doesNotThrow(() => ejs.compile(confirm, {filename:'core/views/confirm.ejs'}));
});

test('both Add Record and Wishlist use the shared direct album navigation template', () => {
  const route = readFileSync('core/routes/itemRoutes.ts', 'utf8');
  assert.match(route, /\/add-\$\{plugin\.id\}/);
  assert.match(route, /\/confirm-\$\{plugin\.id\}\/\:id/);
  assert.doesNotThrow(() => ejs.compile(
    readFileSync('core/views/add.ejs','utf8'), {filename:'core/views/add.ejs'}
  ));
});
