const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeVersionForCompare,
  compareVersions,
  resolveReleaseVersion,
  getReleaseVersionState
} = require('../lib/release-version');

test('normalizeVersionForCompare strips leading v and build metadata', () => {
  assert.deepEqual(normalizeVersionForCompare('v1.7.5+build.9'), [1, 7, 5]);
});

test('compareVersions orders stable releases correctly', () => {
  assert.equal(compareVersions('1.7.5', '1.7.0'), 1);
  assert.equal(compareVersions('1.7.0', '1.7.5'), -1);
  assert.equal(compareVersions('1.7.5', 'v1.7.5'), 0);
});

test('resolveReleaseVersion prefers release tag before name', () => {
  assert.equal(
    resolveReleaseVersion({ tag_name: 'v1.7.5', name: 'v9.9.9' }),
    '1.7.5'
  );
  assert.equal(
    resolveReleaseVersion({ name: 'v1.7.4' }),
    '1.7.4'
  );
});

test('getReleaseVersionState returns ahead_of_latest when local build is newer', () => {
  assert.equal(
    getReleaseVersionState('1.7.5', '1.7.0', 'v1.7.0', 'v1.7.5'),
    'ahead_of_latest'
  );
});

test('getReleaseVersionState returns update_available when a newer release exists', () => {
  assert.equal(
    getReleaseVersionState('1.7.0', '1.7.5', 'v1.7.5', 'v1.7.0'),
    'update_available'
  );
});

test('getReleaseVersionState returns up_to_date for matching stable versions', () => {
  assert.equal(
    getReleaseVersionState('1.7.5', '1.7.5', 'v1.7.5', 'v1.7.5'),
    'up_to_date'
  );
});
