const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  backupPolicy,
  pruneBackupDirectories,
  shouldCreateBackup
} = require('../lib/backup-schedule');

test('backupPolicy normalizes frequency, retention, and replaced-image settings', () => {
  assert.deepEqual(backupPolicy({ backup: {
    auto_frequency: 'weekly',
    retention_count: 500,
    keep_replaced_images: true
  } }), {
    frequency: 'weekly',
    retention: 365,
    keepReplacedImages: true
  });
  assert.deepEqual(backupPolicy({ backup: { auto_frequency: 'invalid', retention_count: 0 } }), {
    frequency: 'daily',
    retention: 1,
    keepReplacedImages: false
  });
});

test('shouldCreateBackup honors schedule while allowing forced restore snapshots', () => {
  const now = Date.UTC(2026, 6, 5);
  assert.equal(shouldCreateBackup({ frequency: 'off', now }), false);
  assert.equal(shouldCreateBackup({ frequency: 'off', now, force: true }), true);
  assert.equal(shouldCreateBackup({ frequency: 'daily', now, lastBackupAt: now - 23 * 60 * 60 * 1000 }), false);
  assert.equal(shouldCreateBackup({ frequency: 'daily', now, lastBackupAt: now - 24 * 60 * 60 * 1000 }), true);
  assert.equal(shouldCreateBackup({ frequency: 'weekly', now, lastBackupAt: now - 6 * 24 * 60 * 60 * 1000 }), false);
  assert.equal(shouldCreateBackup({ frequency: 'monthly', now, lastBackupAt: null }), true);
});

test('pruneBackupDirectories retains only the newest configured snapshots', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-retention-'));
  const baseTime = Date.UTC(2026, 6, 1) / 1000;
  for (let index = 0; index < 4; index += 1) {
    const folder = path.join(root, `backup-${index}`);
    await fs.mkdir(folder);
    await fs.utimes(folder, baseTime + index, baseTime + index);
  }

  const removed = await pruneBackupDirectories({ fs, root, retention: 2 });
  const remaining = (await fs.readdir(root)).sort();

  assert.equal(removed.length, 2);
  assert.deepEqual(remaining, ['backup-2', 'backup-3']);
  await fs.rm(root, { recursive: true, force: true });
});
