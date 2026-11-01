import assert from 'node:assert/strict';
import test from 'node:test';
import { validDiscogsMasterId, prioritizeMatchingMasters } from '../plugins/music/discogsBrowse';

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
