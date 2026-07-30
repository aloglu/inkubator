const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const nativeFs = require('node:fs/promises');
const fs = require('fs-extra');
const {
  atomicWriteJson,
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  createSerializedExecutor,
  disposeManagedImage,
  replaceImagesWithStaging
} = require('../lib/critical-persistence');

test('atomicWriteJson replaces JSON without leaving temporary files', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-'));
  const target = path.join(tempRoot, 'nested', 'data.json');
  t.after(() => fs.remove(tempRoot));

  await atomicWriteJson(target, { version: 1 });
  await atomicWriteJson(target, { version: 2, values: ['pen', 'ink'] });

  assert.deepEqual(await fs.readJson(target), { version: 2, values: ['pen', 'ink'] });
  assert.deepEqual(
    (await fs.readdir(path.dirname(target))).filter((name) => name.endsWith('.tmp')),
    []
  );
});

test('atomicWriteJson propagates a real directory sync failure', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-critical-sync-'));
  const directory = path.join(tempRoot, 'nested');
  const target = path.join(directory, 'data.json');
  let directorySyncAttempted = false;
  t.after(() => fs.remove(tempRoot));

  const fileSystem = {
    mkdir: (...args) => nativeFs.mkdir(...args),
    open: async (targetPath, flags) => {
      if (targetPath === directory && flags === 'r') {
        return {
          sync: async () => {
            directorySyncAttempted = true;
            throw Object.assign(new Error('injected directory sync failure'), { code: 'EIO' });
          },
          close: async () => {}
        };
      }
      return nativeFs.open(targetPath, flags);
    },
    rename: (...args) => nativeFs.rename(...args),
    rm: (...args) => nativeFs.rm(...args)
  };

  await assert.rejects(
    atomicWriteJson(target, { version: 1 }, fileSystem),
    (error) => error.code === 'EIO' && /directory sync failure/i.test(error.message)
  );
  assert.equal(directorySyncAttempted, true);
  assert.deepEqual(await fs.readJson(target), { version: 1 });
  assert.deepEqual(
    (await fs.readdir(directory)).filter((name) => name.endsWith('.tmp')),
    []
  );
});

test('createSerializedExecutor runs operations in order and recovers after failure', async () => {
  const runSerialized = createSerializedExecutor();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = runSerialized(async () => {
    events.push('first:start');
    await firstGate;
    events.push('first:end');
    return 'first';
  });
  const failed = runSerialized(async () => {
    events.push('failed:start');
    throw new Error('expected failure');
  });
  const last = runSerialized(async () => {
    events.push('last:start');
    return 'last';
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['first:start']);
  releaseFirst();

  assert.equal(await first, 'first');
  await assert.rejects(failed, /expected failure/);
  assert.equal(await last, 'last');
  assert.deepEqual(events, ['first:start', 'first:end', 'failed:start', 'last:start']);
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
  const syncedDirectories = [];

  const result = await disposeManagedImage({
    fs,
    imagesRoot,
    archiveRoot,
    imagePath: 'pens/old.webp',
    keepArchived: false,
    syncDirectory: async (directory) => {
      syncedDirectories.push(directory);
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.action, 'deleted');
  assert.deepEqual(syncedDirectories, [path.join(imagesRoot, 'pens')]);
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
  const syncedDirectories = [];
  let ensuredArchiveDirectory = '';

  const result = await disposeManagedImage({
    fs,
    imagesRoot,
    archiveRoot,
    imagePath: 'swatches/old.webp',
    keepArchived: true,
    ensureArchiveDirectory: async (directory) => {
      ensuredArchiveDirectory = directory;
      await fs.ensureDir(directory);
    },
    syncDirectory: async (directory) => {
      syncedDirectories.push(directory);
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.action, 'archived');
  assert.equal(ensuredArchiveDirectory, path.join(archiveRoot, 'swatches'));
  assert.deepEqual(syncedDirectories, [
    path.join(imagesRoot, 'swatches'),
    path.join(archiveRoot, 'swatches')
  ]);
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
