const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('fs-extra');
const {
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  disposeManagedImage,
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

test('collectReferencedImageRelativePaths keeps only active managed image references', () => {
  const relativePaths = collectReferencedImageRelativePaths({
    pens: [
      {
        image: 'pens/pilot-custom-823-1.webp',
        images: [
          { path: 'pens/pilot-custom-823-2.webp' },
          { path: 'https://example.com/ignored-gallery.webp' }
        ]
      },
      { image: 'default_pen.png' },
      { image: 'images/pens/pilot-custom-823-1.webp' }
    ],
    inks: [
      { image: 'inks/kon-peki.webp' },
      { image: 'swatches/legacy-ink-swatch.webp' },
      { image: 'https://example.com/ignored.webp' }
    ],
    swatches: [
      { image: 'swatches/kon-peki-a.webp', images: [{ path: 'swatches/kon-peki-c.webp' }] },
      { image: 'swatches/kon-peki-b.webp' },
      { image: 'data:image/png;base64,abc123' }
    ]
  });

  assert.deepEqual(relativePaths, [
    'inks/kon-peki.webp',
    'pens/pilot-custom-823-1.webp',
    'pens/pilot-custom-823-2.webp',
    'swatches/kon-peki-a.webp',
    'swatches/kon-peki-b.webp',
    'swatches/kon-peki-c.webp'
  ]);
});

test('copyReferencedImages copies only the requested managed files', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-'));
  const sourceRoot = path.join(tempRoot, 'source');
  const destinationRoot = path.join(tempRoot, 'destination');

  await fs.ensureDir(path.join(sourceRoot, 'pens'));
  await fs.ensureDir(path.join(sourceRoot, 'swatches'));
  await fs.writeFile(path.join(sourceRoot, 'pens', 'keep.webp'), 'pen', 'utf8');
  await fs.writeFile(path.join(sourceRoot, 'swatches', 'keep.webp'), 'swatch', 'utf8');
  await fs.writeFile(path.join(sourceRoot, 'swatches', 'skip.webp'), 'skip', 'utf8');

  const copied = await copyReferencedImages({
    fs,
    sourceRoot,
    destinationRoot,
    relativePaths: ['pens/keep.webp', 'swatches/keep.webp']
  });

  assert.deepEqual(copied, ['pens/keep.webp', 'swatches/keep.webp']);
  assert.equal(await fs.pathExists(path.join(destinationRoot, 'pens', 'keep.webp')), true);
  assert.equal(await fs.pathExists(path.join(destinationRoot, 'swatches', 'keep.webp')), true);
  assert.equal(await fs.pathExists(path.join(destinationRoot, 'swatches', 'skip.webp')), false);

  await fs.remove(tempRoot);
});

test('disposeManagedImage deletes the active file when archive retention is off', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-'));
  const imagesRoot = path.join(tempRoot, 'images');
  const archiveRoot = path.join(tempRoot, 'archive');

  await fs.ensureDir(path.join(imagesRoot, 'pens'));
  await fs.writeFile(path.join(imagesRoot, 'pens', 'old.webp'), 'old', 'utf8');

  const result = await disposeManagedImage({
    fs,
    imagesRoot,
    archiveRoot,
    imagePath: 'pens/old.webp',
    keepArchived: false
  });

  assert.equal(result.success, true);
  assert.equal(result.action, 'deleted');
  assert.equal(await fs.pathExists(path.join(imagesRoot, 'pens', 'old.webp')), false);
  assert.equal(await fs.pathExists(path.join(archiveRoot, 'pens', 'old.webp')), false);

  await fs.remove(tempRoot);
});

test('disposeManagedImage archives replaced files without touching the live image tree', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-'));
  const imagesRoot = path.join(tempRoot, 'images');
  const archiveRoot = path.join(tempRoot, 'archive');

  await fs.ensureDir(path.join(imagesRoot, 'swatches'));
  await fs.ensureDir(path.join(archiveRoot, 'swatches'));
  await fs.writeFile(path.join(imagesRoot, 'swatches', 'old.webp'), 'old', 'utf8');
  await fs.writeFile(path.join(archiveRoot, 'swatches', 'old.webp'), 'existing', 'utf8');

  const result = await disposeManagedImage({
    fs,
    imagesRoot,
    archiveRoot,
    imagePath: 'swatches/old.webp',
    keepArchived: true
  });

  assert.equal(result.success, true);
  assert.equal(result.action, 'archived');
  assert.equal(await fs.pathExists(path.join(imagesRoot, 'swatches', 'old.webp')), false);
  assert.equal(await fs.pathExists(path.join(archiveRoot, 'swatches', 'old.webp')), true);
  assert.equal(await fs.pathExists(path.join(archiveRoot, 'swatches', 'old-2.webp')), true);

  await fs.remove(tempRoot);
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
