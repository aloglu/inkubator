const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('fs-extra');
const {
  runSavePostCommitSteps,
  replaceImagesWithStaging
} = require('../lib/critical-persistence');

test('runSavePostCommitSteps returns success when all post-commit steps pass', async () => {
  const result = await runSavePostCommitSteps({
    committed: true,
    requestedPreferences: { x: 1 },
    combined: { y: 2 },
    savePreferencesToDisk: async () => {},
    enforceAutoBackupRetention: async () => {},
    createAutoBackupSnapshot: async () => {}
  });

  assert.deepEqual(result, { success: true });
});

test('runSavePostCommitSteps returns warning when preferences save fails after commit', async () => {
  const result = await runSavePostCommitSteps({
    committed: true,
    requestedPreferences: {},
    combined: {},
    savePreferencesToDisk: async () => {
      throw new Error('prefs failed');
    },
    enforceAutoBackupRetention: async () => {},
    createAutoBackupSnapshot: async () => {}
  });

  assert.equal(result.success, true);
  assert.equal(result.warning, true);
  assert.match(result.message, /preferences could not be saved/i);
});

test('runSavePostCommitSteps returns warning when backup step fails after commit', async () => {
  const result = await runSavePostCommitSteps({
    committed: true,
    requestedPreferences: {},
    combined: {},
    savePreferencesToDisk: async () => {},
    enforceAutoBackupRetention: async () => {
      throw new Error('retention failed');
    },
    createAutoBackupSnapshot: async () => {}
  });

  assert.equal(result.success, true);
  assert.equal(result.warning, true);
  assert.match(result.message, /backup step failed/i);
});

test('replaceImagesWithStaging restores rollback image set when final move fails', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-'));
  const imagesPath = path.join(tempRoot, 'images');
  const backupImagesPath = path.join(tempRoot, 'backup-images');
  const stagingPath = path.join(tempRoot, 'staging');
  const rollbackPath = path.join(tempRoot, 'rollback');

  await fs.ensureDir(imagesPath);
  await fs.ensureDir(backupImagesPath);
  await fs.writeFile(path.join(imagesPath, 'old.txt'), 'old', 'utf8');
  await fs.writeFile(path.join(backupImagesPath, 'new.txt'), 'new', 'utf8');

  const wrappedFs = {
    copy: (...args) => fs.copy(...args),
    pathExists: (...args) => fs.pathExists(...args),
    remove: (...args) => fs.remove(...args),
    move: async (src, dst, opts) => {
      // Simulate failure when promoting staged images to active images.
      if (src === stagingPath && dst === imagesPath) {
        throw new Error('move failed');
      }
      return fs.move(src, dst, opts);
    }
  };

  let threw = false;
  try {
    await replaceImagesWithStaging({
      fs: wrappedFs,
      backupImagesPath,
      imagesPath,
      tempRoot,
      stagingPath,
      rollbackPath
    });
  } catch (_error) {
    threw = true;
  }

  assert.equal(threw, true);
  assert.equal(await fs.pathExists(path.join(imagesPath, 'old.txt')), true);
  assert.equal(await fs.pathExists(path.join(imagesPath, 'new.txt')), false);
  assert.equal(await fs.pathExists(stagingPath), false);
  assert.equal(await fs.pathExists(rollbackPath), false);

  await fs.remove(tempRoot);
});

test('replaceImagesWithStaging cleans staging path when copy fails early', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-'));
  const imagesPath = path.join(tempRoot, 'images');
  const backupImagesPath = path.join(tempRoot, 'backup-images');
  const stagingPath = path.join(tempRoot, 'staging');
  const rollbackPath = path.join(tempRoot, 'rollback');

  await fs.ensureDir(imagesPath);
  await fs.ensureDir(backupImagesPath);
  await fs.writeFile(path.join(imagesPath, 'old.txt'), 'old', 'utf8');

  const wrappedFs = {
    copy: async () => {
      await fs.ensureDir(stagingPath);
      throw new Error('copy failed');
    },
    pathExists: (...args) => fs.pathExists(...args),
    remove: (...args) => fs.remove(...args),
    move: (...args) => fs.move(...args)
  };

  let threw = false;
  try {
    await replaceImagesWithStaging({
      fs: wrappedFs,
      backupImagesPath,
      imagesPath,
      tempRoot,
      stagingPath,
      rollbackPath
    });
  } catch (_error) {
    threw = true;
  }

  assert.equal(threw, true);
  assert.equal(await fs.pathExists(stagingPath), false);
  assert.equal(await fs.pathExists(path.join(imagesPath, 'old.txt')), true);
  assert.equal(await fs.pathExists(rollbackPath), false);

  await fs.remove(tempRoot);
});
