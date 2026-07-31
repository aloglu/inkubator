const test = require('node:test');
const assert = require('node:assert/strict');
const fssync = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const yazl = require('yazl');

const {
  backupRelativePath,
  collectManagedRasterReferencePaths,
  commitStagedImport,
  extractBackupZip,
  receiveRequestToFile,
  recoverInterruptedTransaction,
  regenerateThumbnails,
  readDirectoryIfExists,
  requireManagedRasterFiles,
  resolveManagedRasterFile,
  statIfExists,
  syncTree,
  validateManagedRasterReferences
} = require('../lib/backup-archive');

async function writeZip(target, entries) {
  const zip = new yazl.ZipFile();
  for (const [name, value] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(value), name);
  }
  const completed = pipeline(zip.outputStream, fssync.createWriteStream(target));
  zip.end();
  await completed;
}

async function createSymlinkOrSkip(t, target, link, type) {
  try {
    await fs.symlink(target, link, type);
    return true;
  } catch (error) {
    if (['EACCES', 'ENOSYS', 'ENOTSUP', 'EPERM'].includes(error?.code)) {
      t.skip(`Symbolic links are unavailable: ${error.code}`);
      return false;
    }
    throw error;
  }
}

test('backupRelativePath accepts wrapped legacy backup roots', () => {
  assert.equal(backupRelativePath('inkubator-backup/data.json'), 'data.json');
  assert.equal(backupRelativePath('wrapper/images/pens/example.webp'), 'images/pens/example.webp');
  assert.equal(
    backupRelativePath('wrapper/images/pens/data.json/photo.webp'),
    'images/pens/data.json/photo.webp'
  );
  assert.equal(
    backupRelativePath('wrapper/replaced-images/swatches/preferences.json/photo.webp'),
    'replaced-images/swatches/preferences.json/photo.webp'
  );
  assert.equal(
    backupRelativePath('replaced-images/pens/images/photo.webp'),
    'replaced-images/pens/images/photo.webp'
  );
  assert.equal(
    backupRelativePath('images/wrapper/replaced-images/pens/photo.webp'),
    'replaced-images/pens/photo.webp'
  );
  assert.equal(
    backupRelativePath('images/pens/replaced-images/inks/photo.webp'),
    'images/pens/replaced-images/inks/photo.webp'
  );
  assert.equal(backupRelativePath('../unrelated.txt'), '');
});

test('receiveRequestToFile streams bytes and enforces its limit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-stream-'));
  const target = path.join(root, 'backup.zip');
  const request = Readable.from([Buffer.alloc(4, 1), Buffer.alloc(4, 2)]);
  request.headers = { 'content-length': '8' };

  assert.equal(await receiveRequestToFile(request, target, 8), 8);
  assert.equal((await fs.stat(target)).size, 8);

  const oversized = Readable.from([Buffer.alloc(9, 3)]);
  oversized.headers = {};
  await assert.rejects(
    receiveRequestToFile(oversized, path.join(root, 'too-large.zip'), 8),
    /upload limit/i
  );
  assert.equal(await fs.stat(path.join(root, 'too-large.zip')).catch(() => null), null);
  await fs.rm(root, { recursive: true, force: true });
});

test('extractBackupZip extracts allowed entries one at a time', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-extract-'));
  const zipPath = path.join(root, 'backup.zip');
  const destination = path.join(root, 'out');
  const image = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#245c48' }
  }).webp().toBuffer();
  await writeZip(zipPath, {
    'wrapped/data.json': '{"pens":[],"inks":[],"currently_inked":[]}',
    'wrapped/preferences.json': '{}',
    'wrapped/images/pens/example.webp': image,
    'wrapped/images/.thumbs/pens/stale.webp': '<script>ignored</script>',
    'wrapped/ignored.txt': 'ignored'
  });

  const result = await extractBackupZip(zipPath, destination, {
    maxEntries: 10,
    maxExpandedBytes: 1024
  });

  assert.equal(result.entryCount, 5);
  assert.deepEqual(await fs.readFile(path.join(destination, 'images/pens/example.webp')), image);
  assert.equal(
    await fs.stat(path.join(destination, 'images/.thumbs/pens/stale.webp')).catch(() => null),
    null
  );
  assert.equal(await fs.stat(path.join(destination, 'ignored.txt')).catch(() => null), null);
  await fs.rm(root, { recursive: true, force: true });
});

test('extractBackupZip rejects active or forged managed media', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-media-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const activeZip = path.join(root, 'active.zip');
  await writeZip(activeZip, {
    'data.json': '{}',
    'preferences.json': '{}',
    'images/pens/payload.html': '<script>top.location="/admin/"</script>'
  });
  await assert.rejects(
    extractBackupZip(activeZip, path.join(root, 'active-out')),
    /unsupported managed media path/i
  );

  const forgedZip = path.join(root, 'forged.zip');
  await writeZip(forgedZip, {
    'data.json': '{}',
    'preferences.json': '{}',
    'images/pens/forged.webp': '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'
  });
  await assert.rejects(
    extractBackupZip(forgedZip, path.join(root, 'forged-out')),
    /invalid raster image contents/i
  );

  const truncatedZip = path.join(root, 'truncated.zip');
  await writeZip(truncatedZip, {
    'data.json': '{}',
    'preferences.json': '{}',
    'images/pens/truncated.webp': Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([4, 0, 0, 0]),
      Buffer.from('WEBPjunk')
    ])
  });
  await assert.rejects(
    extractBackupZip(truncatedZip, path.join(root, 'truncated-out')),
    /unreadable raster image/i
  );
});

test('extractBackupZip repairs decodable legacy PNG data stored under WebP names', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-legacy-webp-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const zipPath = path.join(root, 'legacy.zip');
  const destination = path.join(root, 'out');
  const png = await sharp({
    create: {
      width: 4,
      height: 3,
      channels: 4,
      background: '#24506f'
    }
  }).png().toBuffer();
  await writeZip(zipPath, {
    'data.json': '{}',
    'preferences.json': '{}',
    'images/pens/legacy.webp': png
  });

  await extractBackupZip(zipPath, destination);

  const repairedPath = path.join(destination, 'images/pens/legacy.webp');
  const repaired = await fs.readFile(repairedPath);
  assert.equal(repaired.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(repaired.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.equal((await sharp(repairedPath).metadata()).format, 'webp');
});

test('extractBackupZip applies its expanded-size limit to repaired WebP output', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-repair-limit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const width = 16;
  const raw = Buffer.alloc(width * width * 4);
  let state = 123456789;
  for (let index = 0; index < raw.length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    raw[index] = state & 0xff;
  }
  const png = await sharp(raw, {
    raw: { width, height: width, channels: 4 }
  }).png().toBuffer();
  const repairedWebp = await sharp(png).webp({ lossless: true }).toBuffer();
  assert.ok(repairedWebp.length > png.length, 'fixture must grow during repair');

  const zipPath = path.join(root, 'repair-growth.zip');
  await writeZip(zipPath, {
    'data.json': '{}',
    'preferences.json': '{}',
    'images/pens/growing.webp': png
  });
  const originalExpandedBytes = png.length + Buffer.byteLength('{}') * 2;
  const limit = originalExpandedBytes + (repairedWebp.length - png.length) - 1;

  await assert.rejects(
    extractBackupZip(zipPath, path.join(root, 'out'), {
      maxEntries: 10,
      maxExpandedBytes: limit
    }),
    /expanded backup exceeds/i
  );
});

test('extractBackupZip rejects truncated PNG data stored under a WebP name', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-truncated-legacy-png-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const zipPath = path.join(root, 'truncated.zip');
  await writeZip(zipPath, {
    'data.json': '{}',
    'preferences.json': '{}',
    'images/pens/truncated.webp': Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
  });

  await assert.rejects(
    extractBackupZip(zipPath, path.join(root, 'out')),
    /unreadable legacy PNG image/i
  );
});

test('backup collection references reject unsafe managed image paths', () => {
  assert.doesNotThrow(() => validateManagedRasterReferences([
    'pens/example.webp',
    'images/inks/example.heic',
    'https://example.com/external.png',
    'default_pen.png'
  ]));
  assert.throws(
    () => validateManagedRasterReferences(['swatches/payload.svg']),
    /unsupported managed image path/i
  );
  assert.throws(
    () => validateManagedRasterReferences(['pens/../payload.webp']),
    /unsupported managed image path/i
  );
  assert.doesNotThrow(() => validateManagedRasterReferences([
    'images/pens/nested/album/example.webp'
  ], { strict: true }));
  for (const invalid of [
    ' pens/example.webp',
    'pens/example.webp ',
    '/pens/example.webp',
    './pens/example.webp',
    ' default_pen.png ',
    ' https://example.com/external.png'
  ]) {
    assert.throws(
      () => validateManagedRasterReferences([invalid], { strict: true }),
      /unsupported managed image path/i
    );
  }
});

test('backup and thumbnail references include legacy and gallery aliases', () => {
  const references = collectManagedRasterReferencePaths({
    pens: [{
      image: 'pens/direct.webp',
      image_url: 'images/pens/alias.webp',
      images: [
        'pens/string.webp',
        { path: 'pens/nested/path.webp' },
        { image: 'pens/image.webp' },
        { url: 'pens/url.webp' },
        { path: 'pens/direct.webp' }
      ]
    }],
    inks: [{
      image: 'swatches/legacy-ink-swatch.webp',
      images: [{ path: 'inks/gallery.webp' }]
    }],
    swatches: [{ url: 'swatches/direct-url.webp' }]
  });

  assert.deepEqual(references, [
    'inks/gallery.webp',
    'pens/alias.webp',
    'pens/direct.webp',
    'pens/image.webp',
    'pens/nested/path.webp',
    'pens/string.webp',
    'pens/url.webp',
    'swatches/direct-url.webp',
    'swatches/legacy-ink-swatch.webp'
  ]);
});

test('optional filesystem helpers only treat ENOENT as absence', async () => {
  const failure = (code) => Object.assign(new Error(`injected ${code}`), { code });

  assert.equal(await statIfExists({ stat: async () => { throw failure('ENOENT'); } }, '/missing'), null);
  assert.deepEqual(
    await readDirectoryIfExists({ readdir: async () => { throw failure('ENOENT'); } }, '/missing'),
    []
  );
  await assert.rejects(
    statIfExists({ stat: async () => { throw failure('EACCES'); } }, '/blocked'),
    (error) => error.code === 'EACCES'
  );
  await assert.rejects(
    readDirectoryIfExists({ readdir: async () => { throw failure('EIO'); } }, '/broken'),
    (error) => error.code === 'EIO'
  );
});

test('referenced backup images must all exist as regular in-root files', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-references-'));
  const first = path.join(root, 'pens', 'first.webp');
  const second = path.join(root, 'pens', 'nested', 'second.webp');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await assert.rejects(
    requireManagedRasterFiles({
      imagesRoot: root,
      relativePaths: ['pens/first.webp']
    }),
    /missing or is not a regular file/i
  );

  await fs.mkdir(path.dirname(first), { recursive: true });
  await fs.writeFile(first, 'first');
  await assert.rejects(
    requireManagedRasterFiles({
      imagesRoot: root,
      relativePaths: ['pens/first.webp', 'pens/nested/second.webp']
    }),
    /images\/pens\/nested\/second\.webp/i
  );

  await fs.mkdir(path.dirname(second), { recursive: true });
  await fs.writeFile(second, 'second');
  assert.deepEqual(
    await requireManagedRasterFiles({
      imagesRoot: root,
      relativePaths: ['pens/nested/second.webp', 'pens/first.webp']
    }),
    ['pens/first.webp', 'pens/nested/second.webp']
  );

  await fs.rm(second);
  await fs.mkdir(second);
  await assert.rejects(
    requireManagedRasterFiles({
      imagesRoot: root,
      relativePaths: ['pens/nested/second.webp']
    }),
    /not a regular file/i
  );
});

test('managed raster resolution rejects symbolic links at every path level', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-managed-links-'));
  const imagesRoot = path.join(root, 'images');
  const linkedRoot = path.join(root, 'linked-images');
  const outside = path.join(root, 'outside');
  const realDirectory = path.join(imagesRoot, 'pens', 'real');
  const realFile = path.join(realDirectory, 'photo.webp');
  const externalParent = path.join(imagesRoot, 'pens', 'external-parent');
  const internalParent = path.join(imagesRoot, 'pens', 'internal-parent');
  const finalLink = path.join(imagesRoot, 'swatches', 'linked.webp');
  const danglingLink = path.join(imagesRoot, 'swatches', 'dangling.webp');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(realDirectory, { recursive: true });
  await fs.mkdir(path.join(imagesRoot, 'swatches'), { recursive: true });
  await fs.mkdir(outside);
  await fs.writeFile(realFile, 'real-image');
  await fs.writeFile(path.join(outside, 'photo.webp'), 'outside-image');

  const resolved = await resolveManagedRasterFile({
    imagesRoot,
    relativePath: 'pens/real/photo.webp'
  });
  assert.deepEqual(resolved, {
    relativePath: 'pens/real/photo.webp',
    target: await fs.realpath(realFile)
  });
  assert.deepEqual(
    await requireManagedRasterFiles({
      imagesRoot,
      relativePaths: ['pens/real/photo.webp']
    }),
    ['pens/real/photo.webp']
  );

  if (!(await createSymlinkOrSkip(t, imagesRoot, linkedRoot, 'dir'))) return;
  if (!(await createSymlinkOrSkip(t, outside, externalParent, 'dir'))) return;
  if (!(await createSymlinkOrSkip(t, realDirectory, internalParent, 'dir'))) return;
  if (!(await createSymlinkOrSkip(t, realFile, finalLink, 'file'))) return;
  if (!(await createSymlinkOrSkip(
    t,
    path.join(root, 'missing-photo.webp'),
    danglingLink,
    'file'
  ))) return;

  await assert.rejects(
    resolveManagedRasterFile({
      imagesRoot: linkedRoot,
      relativePath: 'pens/real/photo.webp'
    }),
    /root is missing or is not a real directory/i
  );
  for (const relativePath of [
    'pens/external-parent/photo.webp',
    'pens/internal-parent/photo.webp'
  ]) {
    await assert.rejects(
      requireManagedRasterFiles({
        imagesRoot,
        relativePaths: [relativePath]
      }),
      /non-directory or symbolic-link parent/i
    );
  }
  for (const relativePath of ['swatches/linked.webp', 'swatches/dangling.webp']) {
    await assert.rejects(
      requireManagedRasterFiles({
        imagesRoot,
        relativePaths: [relativePath]
      }),
      /not a regular file/i
    );
  }
});

test('backup media validation fully decodes images instead of trusting metadata', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-full-decode-'));
  const imagePath = path.join(root, 'pens', 'truncated.png');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  const completePng = await sharp({
    create: { width: 256, height: 256, channels: 3, background: '#245c48' }
  }).png({ compressionLevel: 0 }).toBuffer();
  const truncatedPng = completePng.subarray(0, 500);
  assert.equal((await sharp(truncatedPng).metadata()).width, 256);
  await fs.writeFile(imagePath, truncatedPng);

  await assert.rejects(
    requireManagedRasterFiles({
      imagesRoot: root,
      relativePaths: ['pens/truncated.png'],
      validateContents: true
    }),
    /unreadable raster image/i
  );
});

test('syncTree flushes files before their containing directories', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-sync-tree-'));
  const nested = path.join(root, 'images', 'pens');
  const image = path.join(nested, 'example.webp');
  const events = [];
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(nested, { recursive: true });
  await fs.writeFile(image, 'image');
  await fs.chmod(image, 0o444);

  const fileSystem = {
    stat: (...args) => fs.stat(...args),
    readdir: (...args) => fs.readdir(...args),
    open: async (target, flags) => {
      const handle = await fs.open(target, flags);
      return {
        sync: async () => {
          events.push(target);
          await handle.sync();
        },
        close: () => handle.close()
      };
    }
  };
  await syncTree(fileSystem, root);

  const imageIndex = events.indexOf(image);
  const nestedIndex = events.indexOf(nested);
  const rootIndex = events.indexOf(root);
  assert.notEqual(imageIndex, -1);
  assert.ok(imageIndex < nestedIndex);
  assert.ok(nestedIndex < rootIndex);
});

test('extractBackupZip rejects expanded archives over the configured limit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-limit-'));
  const zipPath = path.join(root, 'backup.zip');
  await writeZip(zipPath, {
    'data.json': 'x'.repeat(2048),
    'preferences.json': '{}'
  });

  await assert.rejects(
    extractBackupZip(zipPath, path.join(root, 'out'), { maxEntries: 10, maxExpandedBytes: 1024 }),
    /expanded backup exceeds/i
  );
  await fs.rm(root, { recursive: true, force: true });
});

test('regenerateThumbnails creates bounded WebP thumbnails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-thumbs-'));
  const images = path.join(root, 'images');
  const thumbnails = path.join(images, '.thumbs');
  const source = path.join(images, 'pens/example.webp');
  await fs.mkdir(path.dirname(source), { recursive: true });
  await sharp({
    create: { width: 900, height: 1200, channels: 3, background: '#245c48' }
  }).webp({ quality: 88 }).toFile(source);

  const result = await regenerateThumbnails({
    imagesRoot: images,
    thumbnailsRoot: thumbnails,
    relativePaths: ['pens/example.webp'],
    concurrency: 2
  });
  const metadata = await sharp(path.join(thumbnails, 'pens/example.webp')).metadata();

  assert.deepEqual(result, { generated: 1, skipped: 0, failed: 0 });
  assert.equal(metadata.width, 360);
  assert.equal(metadata.height, 480);
  await fs.rm(root, { recursive: true, force: true });
});

test('commitStagedImport restores existing state when promotion fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-commit-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  const stagedSecond = path.join(stage, 'second.json');
  await fs.mkdir(stage, { recursive: true });
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');
  await fs.writeFile(stagedSecond, 'second');

  await assert.rejects(commitStagedImport({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [
      { name: 'data.json', staged: stagedData, target: liveData },
      { name: 'second.json', staged: stagedSecond, target: path.join(root, 'missing', 'second.json') }
    ]
  }));

  assert.equal(await fs.readFile(liveData, 'utf8'), 'old');
  assert.equal(await fs.stat(stage).catch(() => null), null);
  assert.equal(await fs.stat(rollback).catch(() => null), null);
  await fs.rm(root, { recursive: true, force: true });
});

test('commitStagedImport preserves rollback files when restoration also fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  const stagedSecond = path.join(stage, 'second.json');
  const rollbackData = path.join(rollback, 'data.json');
  await fs.mkdir(stage, { recursive: true });
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');
  await fs.writeFile(stagedSecond, 'second');

  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: (...args) => fs.rm(...args),
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: async (source, destination) => {
      if (source === rollbackData && destination === liveData) {
        throw new Error('injected restoration failure');
      }
      return fs.rename(source, destination);
    }
  };

  let caught;
  try {
    await commitStagedImport({
      stagedRoot: stage,
      rollbackRoot: rollback,
      fileSystem,
      targets: [
        { name: 'data.json', staged: stagedData, target: liveData },
        { name: 'second.json', staged: stagedSecond, target: path.join(root, 'missing', 'second.json') }
      ]
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught);
  assert.equal(caught.rollbackRoot, rollback);
  assert.match(caught.message, /recoverable files remain/i);
  assert.ok(caught.message.includes(rollback));
  assert.equal(await fs.readFile(rollbackData, 'utf8'), 'old');
  assert.equal(await fs.stat(liveData).catch(() => null), null);
  assert.ok(await fs.stat(stage));
  await fs.rm(root, { recursive: true, force: true });
});

test('commitStagedImport propagates stat failures without replacing live data', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-stat-failure-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');

  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: (...args) => fs.rm(...args),
    stat: async (target) => {
      if (target === liveData) {
        throw Object.assign(new Error('injected stat denial'), { code: 'EACCES' });
      }
      return fs.stat(target);
    },
    writeFile: (...args) => fs.writeFile(...args),
    rename: (...args) => fs.rename(...args)
  };

  await assert.rejects(
    commitStagedImport({
      stagedRoot: stage,
      rollbackRoot: rollback,
      fileSystem,
      targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
    }),
    (error) => error.code === 'EACCES'
  );
  assert.equal(await fs.readFile(liveData, 'utf8'), 'old');
  assert.equal(await fs.stat(stage).catch(() => null), null);
  assert.equal(await fs.stat(rollback).catch(() => null), null);
});

test('a failed promotion with failed cleanup stays rolled back and retry is cleanup-only', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-rollback-cleanup-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');

  let failPromotion = true;
  let failStageCleanup = true;
  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: async (target, ...args) => {
      if (target === stage && failStageCleanup) {
        failStageCleanup = false;
        throw new Error('injected cleanup failure');
      }
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: async (source, destination) => {
      if (source === stagedData && destination === liveData && failPromotion) {
        failPromotion = false;
        throw new Error('injected promotion failure');
      }
      return fs.rename(source, destination);
    }
  };

  let caught;
  try {
    await commitStagedImport({
      stagedRoot: stage,
      rollbackRoot: rollback,
      fileSystem,
      targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.equal(caught.rollbackRoot, rollback);
  assert.match(caught.message, /cleanup failed/i);
  assert.match(caught.originalError.message, /promotion failure/i);
  assert.equal(await fs.readFile(liveData, 'utf8'), 'old');
  assert.equal(
    JSON.parse(await fs.readFile(path.join(rollback, 'transaction.json'), 'utf8')).state,
    'rolled-back'
  );

  await fs.writeFile(liveData, 'newer-after-rollback');
  const recovered = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });
  assert.deepEqual(recovered, { recovered: true, action: 'kept-rolled-back' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'newer-after-rollback');
});

test('commitStagedImport syncs the rollback parent before moving live targets', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-sync-order-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  const rollbackData = path.join(rollback, 'data.json');
  const events = [];
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage, { recursive: true });
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');

  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: (...args) => fs.rm(...args),
    stat: (...args) => fs.stat(...args),
    rename: async (source, destination) => {
      events.push(`rename:${source}->${destination}`);
      return fs.rename(source, destination);
    },
    open: async (target, flags) => {
      if (flags === 'wx') {
        const handle = await fs.open(target, flags);
        return {
          writeFile: (...args) => handle.writeFile(...args),
          sync: async () => {
            events.push(`sync-file:${target}`);
            await handle.sync();
          },
          close: () => handle.close()
        };
      }
      return {
        sync: async () => {
          events.push(`sync-dir:${target}`);
        },
        close: async () => {}
      };
    }
  };

  await commitStagedImport({
    stagedRoot: stage,
    rollbackRoot: rollback,
    fileSystem,
    targets: [
      { name: 'data.json', staged: stagedData, target: liveData }
    ]
  });

  const parentSyncIndex = events.indexOf(`sync-dir:${root}`);
  const firstDestructiveRenameIndex = events.indexOf(`rename:${liveData}->${rollbackData}`);
  assert.notEqual(parentSyncIndex, -1);
  assert.notEqual(firstDestructiveRenameIndex, -1);
  assert.ok(parentSyncIndex < firstDestructiveRenameIndex);
});

test('commitStagedImport reports cleanup warnings without failing a committed transaction', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-cleanup-warning-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.mock.method(console, 'warn', () => {});
  await fs.mkdir(stage, { recursive: true });
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');

  let failStageCleanup = true;
  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: async (target, ...args) => {
      if (target === stage && failStageCleanup) {
        failStageCleanup = false;
        throw new Error('injected cleanup failure');
      }
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: (...args) => fs.rename(...args)
  };

  const result = await commitStagedImport({
    stagedRoot: stage,
    rollbackRoot: rollback,
    fileSystem,
    targets: [
      { name: 'data.json', staged: stagedData, target: liveData }
    ]
  });

  assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
  assert.equal(result.cleanupErrors.length, 1);
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.cleanupErrors[0].rollbackRoot, rollback);
  assert.match(result.cleanupErrors[0].message, /injected cleanup failure/);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(rollback, 'transaction.json'), 'utf8')).state,
    'committed'
  );

  const recovered = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });
  assert.deepEqual(recovered, { recovered: true, action: 'kept-committed' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
  assert.equal(await fs.stat(rollback).catch(() => null), null);
});

test('partial deletion of a retired transaction cannot replay old data', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-retired-cleanup-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');

  let injectedPartialDelete = false;
  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: async (target, ...args) => {
      if (path.basename(target).startsWith('.transaction-cleanup-') && !injectedPartialDelete) {
        injectedPartialDelete = true;
        await fs.rm(path.join(target, 'transaction.json'));
        throw new Error('injected retired-directory cleanup failure');
      }
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: (...args) => fs.rename(...args)
  };

  const result = await commitStagedImport({
    stagedRoot: stage,
    rollbackRoot: rollback,
    fileSystem,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });
  assert.equal(result.cleanupErrors.length, 1);
  assert.equal(result.recoveryRequired, undefined);
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
  assert.equal(await fs.stat(rollback).catch(() => null), null);
  const retiredName = (await fs.readdir(root)).find(
    (name) => name.startsWith('.transaction-cleanup-')
  );
  assert.ok(retiredName);
  assert.equal(
    await fs.stat(path.join(root, retiredName, 'transaction.json')).catch(() => null),
    null
  );
  assert.equal(await fs.readFile(path.join(root, retiredName, 'data.json'), 'utf8'), 'old');

  const recovered = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });
  assert.deepEqual(recovered, { recovered: false, action: 'none' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
});

test('a committed marker sync failure preserves the commit for recovery cleanup', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-finality-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  const markerPath = path.join(rollback, 'transaction.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.writeFile(liveData, 'old');
  await fs.writeFile(stagedData, 'new');

  let markerRenameCount = 0;
  let failedCommittedMarkerSync = false;
  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    readdir: (...args) => fs.readdir(...args),
    rm: (...args) => fs.rm(...args),
    stat: (...args) => fs.stat(...args),
    rename: async (source, destination) => {
      await fs.rename(source, destination);
      if (destination === markerPath) markerRenameCount += 1;
    },
    open: async (target, flags) => {
      const handle = await fs.open(target, flags);
      return {
        writeFile: (...args) => handle.writeFile(...args),
        sync: async () => {
          if (target === rollback && markerRenameCount === 2 && !failedCommittedMarkerSync) {
            failedCommittedMarkerSync = true;
            throw Object.assign(new Error('injected marker directory sync failure'), { code: 'EIO' });
          }
          await handle.sync();
        },
        close: () => handle.close()
      };
    }
  };

  const result = await commitStagedImport({
    stagedRoot: stage,
    rollbackRoot: rollback,
    fileSystem,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });

  assert.equal(result.recoveryRequired, true);
  assert.equal(result.cleanupErrors[0].rollbackRoot, rollback);
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
  assert.equal(await fs.readFile(path.join(rollback, 'data.json'), 'utf8'), 'old');
  assert.equal(JSON.parse(await fs.readFile(markerPath, 'utf8')).state, 'committed');

  const recovered = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });
  assert.deepEqual(recovered, { recovered: true, action: 'kept-committed' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
});

test('recoverInterruptedTransaction restores old files after a partial promotion', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const livePreferences = path.join(root, 'preferences.json');
  const stagedData = path.join(stage, 'data.json');
  const stagedPreferences = path.join(stage, 'preferences.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(path.join(rollback, 'data.json'), 'old-data');
  await fs.writeFile(path.join(rollback, 'preferences.json'), 'old-preferences');
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(stagedPreferences, 'new-preferences');
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [
      { name: 'data.json', hadExisting: true },
      { name: 'preferences.json', hadExisting: true }
    ]
  }));

  const result = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [
      { name: 'data.json', staged: stagedData, target: liveData },
      { name: 'preferences.json', staged: stagedPreferences, target: livePreferences }
    ]
  });

  assert.deepEqual(result, { recovered: true, action: 'rolled-back' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'old-data');
  assert.equal(await fs.readFile(livePreferences, 'utf8'), 'old-preferences');
  assert.equal(await fs.stat(stage).catch(() => null), null);
  assert.equal(await fs.stat(rollback).catch(() => null), null);
});

test('recovery records rolled-back before cleanup and never replays restoration', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-cleanup-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(liveData, 'partially-promoted');
  await fs.writeFile(stagedData, 'staged');
  await fs.writeFile(path.join(rollback, 'data.json'), 'old');
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [{ name: 'data.json', hadExisting: true }]
  }));

  let failStageCleanup = true;
  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    readFile: (...args) => fs.readFile(...args),
    rm: async (target, ...args) => {
      if (target === stage && failStageCleanup) {
        failStageCleanup = false;
        throw new Error('injected recovery cleanup failure');
      }
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: (...args) => fs.rename(...args)
  };

  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      fileSystem,
      targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
    }),
    (error) => error.rollbackRoot === rollback && /cleanup failed/i.test(error.message)
  );
  assert.equal(await fs.readFile(liveData, 'utf8'), 'old');
  assert.equal(
    JSON.parse(await fs.readFile(path.join(rollback, 'transaction.json'), 'utf8')).state,
    'rolled-back'
  );

  await fs.writeFile(liveData, 'newer-after-recovery');
  const retry = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });
  assert.deepEqual(retry, { recovered: true, action: 'kept-rolled-back' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'newer-after-recovery');
});

test('recoverInterruptedTransaction syncs each restored file before restoring the next one', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-sync-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const livePreferences = path.join(root, 'preferences.json');
  const rollbackData = path.join(rollback, 'data.json');
  const rollbackPreferences = path.join(rollback, 'preferences.json');
  const events = [];
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(livePreferences, 'new-preferences');
  await fs.writeFile(rollbackData, 'old-data');
  await fs.writeFile(rollbackPreferences, 'old-preferences');
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [
      { name: 'data.json', hadExisting: true },
      { name: 'preferences.json', hadExisting: true }
    ]
  }));

  const fileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    readFile: (...args) => fs.readFile(...args),
    rm: async (target, ...args) => {
      events.push(`rm:${target}`);
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    rename: async (source, destination) => {
      events.push(`rename:${source}->${destination}`);
      return fs.rename(source, destination);
    },
    open: async (target, flags) => {
      if (flags === 'wx') {
        const handle = await fs.open(target, flags);
        return {
          writeFile: (...args) => handle.writeFile(...args),
          sync: async () => {
            events.push(`sync-file:${target}`);
            await handle.sync();
          },
          close: () => handle.close()
        };
      }
      return {
        sync: async () => {
          events.push(`sync-dir:${target}`);
        },
        close: async () => {}
      };
    }
  };

  await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    fileSystem,
    targets: [
      { name: 'data.json', staged: path.join(stage, 'data.json'), target: liveData },
      {
        name: 'preferences.json',
        staged: path.join(stage, 'preferences.json'),
        target: livePreferences
      }
    ]
  });

  const firstRestoreIndex = events.indexOf(
    `rename:${rollbackPreferences}->${livePreferences}`
  );
  const secondRemovalIndex = events.indexOf(`rm:${liveData}`);
  const rollbackSyncIndex = events.indexOf(`sync-dir:${rollback}`, firstRestoreIndex);
  const targetParentSyncIndex = events.indexOf(`sync-dir:${root}`, firstRestoreIndex);

  assert.notEqual(firstRestoreIndex, -1);
  assert.notEqual(secondRemovalIndex, -1);
  assert.ok(rollbackSyncIndex > firstRestoreIndex && rollbackSyncIndex < secondRemovalIndex);
  assert.ok(targetParentSyncIndex > firstRestoreIndex && targetParentSyncIndex < secondRemovalIndex);
});

test('recoverInterruptedTransaction keeps fully committed files and removes stale recovery data', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(path.join(rollback, 'data.json'), 'old-data');
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'committed',
    items: [{ name: 'data.json', hadExisting: true }]
  }));

  const result = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [{ name: 'data.json', staged: stagedData, target: liveData }]
  });

  assert.deepEqual(result, { recovered: true, action: 'kept-committed' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new-data');
  assert.equal(await fs.stat(stage).catch(() => null), null);
  assert.equal(await fs.stat(rollback).catch(() => null), null);
});

test('recoverInterruptedTransaction uses the marker when staging files were already cleaned', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveExisting = path.join(root, 'preferences.json');
  const liveNew = path.join(root, 'replaced-images');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(rollback);
  await fs.writeFile(liveExisting, 'old-preferences');
  await fs.mkdir(liveNew);
  await fs.writeFile(path.join(liveNew, 'new.txt'), 'new');
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [
      { name: 'preferences.json', hadExisting: true },
      { name: 'replaced-images', hadExisting: false }
    ]
  }));

  await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [
      {
        name: 'preferences.json',
        staged: path.join(stage, 'preferences.json'),
        target: liveExisting
      },
      {
        name: 'replaced-images',
        staged: path.join(stage, 'replaced-images'),
        target: liveNew
      }
    ]
  });

  assert.equal(await fs.readFile(liveExisting, 'utf8'), 'old-preferences');
  assert.equal(await fs.stat(liveNew).catch(() => null), null);
});

test('recoverInterruptedTransaction rolls back a committed transaction with a missing target', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-recovery-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const livePreferences = path.join(root, 'preferences.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(rollback);
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(path.join(rollback, 'data.json'), 'old-data');
  await fs.writeFile(path.join(rollback, 'preferences.json'), 'old-preferences');
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'committed',
    items: [
      { name: 'data.json', hadExisting: true },
      { name: 'preferences.json', hadExisting: true }
    ]
  }));

  const result = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets: [
      { name: 'data.json', staged: path.join(stage, 'data.json'), target: liveData },
      {
        name: 'preferences.json',
        staged: path.join(stage, 'preferences.json'),
        target: livePreferences
      }
    ]
  });

  assert.deepEqual(result, { recovered: true, action: 'rolled-back' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'old-data');
  assert.equal(await fs.readFile(livePreferences, 'utf8'), 'old-preferences');
  assert.equal(await fs.stat(rollback).catch(() => null), null);
});

test('recovery blocks on corrupt, unreadable, or structurally invalid markers', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-invalid-markers-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const invalidMarkers = [
    '{not json',
    JSON.stringify({ version: 2, state: 'prepared', items: [{ name: 'data.json', hadExisting: true }] }),
    JSON.stringify({ version: 1, state: 'prepared', items: [] }),
    JSON.stringify({
      version: 1,
      state: 'prepared',
      items: [
        { name: 'data.json', hadExisting: true },
        { name: 'data.json', hadExisting: true }
      ]
    }),
    JSON.stringify({ version: 1, state: 'prepared', items: [{ name: 'other.json', hadExisting: true }] }),
    JSON.stringify({ version: 1, state: 'prepared', items: [{ name: 'data.json', hadExisting: 'yes' }] })
  ];

  for (const [index, marker] of invalidMarkers.entries()) {
    const caseRoot = path.join(root, String(index));
    const stage = path.join(caseRoot, 'stage');
    const rollback = path.join(caseRoot, 'rollback');
    const liveData = path.join(caseRoot, 'data.json');
    await fs.mkdir(stage, { recursive: true });
    await fs.mkdir(rollback);
    await fs.writeFile(liveData, 'new');
    await fs.writeFile(path.join(rollback, 'data.json'), 'old');
    await fs.writeFile(path.join(rollback, 'transaction.json'), marker);

    await assert.rejects(
      recoverInterruptedTransaction({
        stagedRoot: stage,
        rollbackRoot: rollback,
        targets: [{ name: 'data.json', staged: path.join(stage, 'data.json'), target: liveData }]
      }),
      /invalid/i
    );
    assert.equal(await fs.readFile(liveData, 'utf8'), 'new');
    assert.equal(await fs.readFile(path.join(rollback, 'data.json'), 'utf8'), 'old');
  }

  const ioRoot = path.join(root, 'io');
  const ioStage = path.join(ioRoot, 'stage');
  const ioRollback = path.join(ioRoot, 'rollback');
  const ioLiveData = path.join(ioRoot, 'data.json');
  const ioMarker = path.join(ioRollback, 'transaction.json');
  await fs.mkdir(ioStage, { recursive: true });
  await fs.mkdir(ioRollback);
  await fs.writeFile(ioLiveData, 'new');
  await fs.writeFile(path.join(ioRollback, 'data.json'), 'old');
  await fs.writeFile(ioMarker, '{}');
  const fileSystem = {
    readFile: async (target, ...args) => {
      if (target === ioMarker) throw Object.assign(new Error('injected marker read failure'), { code: 'EIO' });
      return fs.readFile(target, ...args);
    },
    stat: (...args) => fs.stat(...args)
  };
  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: ioStage,
      rollbackRoot: ioRollback,
      fileSystem,
      targets: [{ name: 'data.json', staged: path.join(ioStage, 'data.json'), target: ioLiveData }]
    }),
    (error) => error.code === 'EIO' && error.rollbackRoot === ioRollback
  );
  assert.equal(await fs.readFile(ioLiveData, 'utf8'), 'new');
  assert.equal(await fs.readFile(path.join(ioRollback, 'data.json'), 'utf8'), 'old');
});

test('committed recovery blocks when an old target and rollback copy are both missing', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-committed-missing-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'committed',
    items: [{ name: 'data.json', hadExisting: true }]
  }));

  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [{ name: 'data.json', staged: path.join(stage, 'data.json'), target: liveData }]
    }),
    /missing both/i
  );
  assert.ok(await fs.stat(path.join(rollback, 'transaction.json')));
});

test('recoverInterruptedTransaction preserves evidence when an existing target and rollback are both missing', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-missing-recovery-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(path.join(rollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [
      { name: 'data.json', hadExisting: true }
    ]
  }));

  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [
        { name: 'data.json', staged: path.join(stage, 'data.json'), target: liveData }
      ]
    }),
    /missing both/i
  );

  assert.ok(await fs.stat(path.join(rollback, 'transaction.json')));
  assert.equal(await fs.stat(liveData).catch(() => null), null);
});

test('committed recovery is durably re-marked prepared before rollback mutation', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-resumable-rollback-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const markerPath = path.join(rollback, 'transaction.json');
  const liveData = path.join(root, 'data.json');
  const livePreferences = path.join(root, 'preferences.json');
  const events = [];
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(path.join(rollback, 'data.json'), 'old-data');
  await fs.writeFile(path.join(rollback, 'preferences.json'), 'old-preferences');
  await fs.writeFile(markerPath, JSON.stringify({
    version: 1,
    state: 'committed',
    items: [
      { name: 'data.json', hadExisting: true },
      { name: 'preferences.json', hadExisting: true }
    ]
  }));

  let failDataRemoval = true;
  const fileSystem = {
    lstat: (...args) => fs.lstat(...args),
    mkdir: (...args) => fs.mkdir(...args),
    readFile: (...args) => fs.readFile(...args),
    readdir: (...args) => fs.readdir(...args),
    rename: async (source, destination) => {
      await fs.rename(source, destination);
      if (destination === markerPath) {
        const marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
        events.push(`marker:${marker.state}`);
      }
      if (destination === livePreferences) events.push('restore:preferences');
    },
    rm: async (target, ...args) => {
      if (target === liveData || target === livePreferences) {
        events.push(`rm:${target}`);
      }
      if (target === liveData && failDataRemoval) {
        failDataRemoval = false;
        throw Object.assign(new Error('injected recovery interruption'), { code: 'EIO' });
      }
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    open: async (target, flags) => {
      if (flags === 'r' && (await fs.stat(target)).isDirectory()) {
        return {
          sync: async () => {
            events.push(`sync-dir:${target}`);
          },
          close: async () => {}
        };
      }
      return fs.open(target, flags);
    }
  };
  const targets = [
    {
      kind: 'file',
      name: 'data.json',
      staged: path.join(stage, 'data.json'),
      target: liveData
    },
    {
      kind: 'file',
      name: 'preferences.json',
      staged: path.join(stage, 'preferences.json'),
      target: livePreferences
    }
  ];

  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      fileSystem,
      targets
    }),
    (error) => error.code === 'EIO' && error.rollbackRoot === rollback
  );

  const markerIndex = events.indexOf('marker:prepared');
  const markerSyncIndex = events.indexOf(`sync-dir:${rollback}`, markerIndex + 1);
  const firstMutationIndex = events.findIndex((event) => event.startsWith('rm:'));
  assert.notEqual(markerIndex, -1);
  assert.notEqual(markerSyncIndex, -1);
  assert.ok(markerIndex < markerSyncIndex);
  assert.ok(markerSyncIndex < firstMutationIndex);
  assert.equal(JSON.parse(await fs.readFile(markerPath, 'utf8')).state, 'prepared');
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new-data');
  assert.equal(await fs.readFile(livePreferences, 'utf8'), 'old-preferences');
  assert.equal(await fs.readFile(path.join(rollback, 'data.json'), 'utf8'), 'old-data');

  const recovered = await recoverInterruptedTransaction({
    stagedRoot: stage,
    rollbackRoot: rollback,
    targets
  });
  assert.deepEqual(recovered, { recovered: true, action: 'rolled-back' });
  assert.equal(await fs.readFile(liveData, 'utf8'), 'old-data');
  assert.equal(await fs.readFile(livePreferences, 'utf8'), 'old-preferences');
  assert.equal(await fs.stat(rollback).catch(() => null), null);
});

test('recovery rejects a symlink rollback root without touching its destination', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-rollback-symlink-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const outside = path.join(root, 'outside');
  const liveData = path.join(root, 'data.json');
  const outsideMarker = JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [{ name: 'data.json', hadExisting: true }]
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.mkdir(outside);
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(path.join(outside, 'data.json'), 'old-data');
  await fs.writeFile(path.join(outside, 'transaction.json'), outsideMarker);
  if (!(await createSymlinkOrSkip(t, outside, rollback, 'dir'))) return;

  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [{
        kind: 'file',
        name: 'data.json',
        staged: path.join(stage, 'data.json'),
        target: liveData
      }]
    }),
    (error) => error.rollbackRoot === rollback && /rollback path is not a directory/i.test(error.message)
  );
  assert.equal((await fs.lstat(rollback)).isSymbolicLink(), true);
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new-data');
  assert.equal(await fs.readFile(path.join(outside, 'data.json'), 'utf8'), 'old-data');
  assert.equal(await fs.readFile(path.join(outside, 'transaction.json'), 'utf8'), outsideMarker);
  assert.ok(await fs.stat(stage));
});

test('recovery rejects a symlink transaction marker without mutating recovery data', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-marker-symlink-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const markerPath = path.join(rollback, 'transaction.json');
  const outsideMarkerPath = path.join(root, 'outside-marker.json');
  const liveData = path.join(root, 'data.json');
  const outsideMarker = JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [{ name: 'data.json', hadExisting: true }]
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.mkdir(rollback);
  await fs.writeFile(liveData, 'new-data');
  await fs.writeFile(path.join(rollback, 'data.json'), 'old-data');
  await fs.writeFile(outsideMarkerPath, outsideMarker);
  if (!(await createSymlinkOrSkip(t, outsideMarkerPath, markerPath, 'file'))) return;

  await assert.rejects(
    recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [{
        kind: 'file',
        name: 'data.json',
        staged: path.join(stage, 'data.json'),
        target: liveData
      }]
    }),
    (error) => error.rollbackRoot === rollback && /marker is not a regular file/i.test(error.message)
  );
  assert.equal((await fs.lstat(markerPath)).isSymbolicLink(), true);
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new-data');
  assert.equal(await fs.readFile(path.join(rollback, 'data.json'), 'utf8'), 'old-data');
  assert.equal(await fs.readFile(outsideMarkerPath, 'utf8'), outsideMarker);
  assert.ok(await fs.stat(stage));
});

test('retirement preserves its complete tree when the parent cannot be synced', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-backup-retire-sync-'));
  const stage = path.join(root, 'stage');
  const rollback = path.join(root, 'rollback');
  const liveData = path.join(root, 'data.json');
  const stagedData = path.join(stage, 'data.json');
  let retiredRoot = '';
  let retiredRemovalAttempts = 0;
  let failedRetirementSync = false;
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(stage);
  await fs.writeFile(liveData, 'old-data');
  await fs.writeFile(stagedData, 'new-data');

  const fileSystem = {
    lstat: (...args) => fs.lstat(...args),
    mkdir: (...args) => fs.mkdir(...args),
    readFile: (...args) => fs.readFile(...args),
    readdir: (...args) => fs.readdir(...args),
    rename: async (source, destination) => {
      await fs.rename(source, destination);
      if (
        source === rollback
        && path.basename(destination).startsWith('.transaction-cleanup-')
      ) {
        retiredRoot = destination;
      }
    },
    rm: async (target, ...args) => {
      if (retiredRoot && target === retiredRoot) retiredRemovalAttempts += 1;
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    open: async (target, flags) => {
      if (flags === 'r' && (await fs.stat(target)).isDirectory()) {
        return {
          sync: async () => {
            if (target === root && retiredRoot && !failedRetirementSync) {
              failedRetirementSync = true;
              throw Object.assign(new Error('injected retirement parent sync failure'), {
                code: 'EIO'
              });
            }
          },
          close: async () => {}
        };
      }
      return fs.open(target, flags);
    }
  };

  const result = await commitStagedImport({
    stagedRoot: stage,
    rollbackRoot: rollback,
    fileSystem,
    targets: [{
      kind: 'file',
      name: 'data.json',
      staged: stagedData,
      target: liveData
    }]
  });

  assert.equal(result.cleanupErrors.length, 1);
  assert.equal(result.recoveryRequired, undefined);
  assert.equal(result.cleanupErrors[0].retiredRoot, retiredRoot);
  assert.match(result.cleanupErrors[0].message, /could not be synchronized/i);
  assert.equal(retiredRemovalAttempts, 0);
  assert.ok(retiredRoot);
  assert.equal(await fs.stat(rollback).catch(() => null), null);
  assert.equal((await fs.stat(retiredRoot)).isDirectory(), true);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(retiredRoot, 'transaction.json'), 'utf8')).state,
    'committed'
  );
  assert.equal(await fs.readFile(path.join(retiredRoot, 'data.json'), 'utf8'), 'old-data');
  assert.equal(await fs.readFile(liveData, 'utf8'), 'new-data');
});
