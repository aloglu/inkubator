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
  commitStagedImport,
  extractBackupZip,
  receiveRequestToFile,
  regenerateThumbnails
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

test('backupRelativePath accepts wrapped legacy backup roots', () => {
  assert.equal(backupRelativePath('inkubator-backup/data.json'), 'data.json');
  assert.equal(backupRelativePath('wrapper/images/pens/example.webp'), 'images/pens/example.webp');
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
  await writeZip(zipPath, {
    'wrapped/data.json': '{"pens":[],"inks":[],"currently_inked":[]}',
    'wrapped/preferences.json': '{}',
    'wrapped/images/pens/example.webp': 'image',
    'wrapped/ignored.txt': 'ignored'
  });

  const result = await extractBackupZip(zipPath, destination, {
    maxEntries: 10,
    maxExpandedBytes: 1024
  });

  assert.equal(result.entryCount, 4);
  assert.equal(await fs.readFile(path.join(destination, 'images/pens/example.webp'), 'utf8'), 'image');
  assert.equal(await fs.stat(path.join(destination, 'ignored.txt')).catch(() => null), null);
  await fs.rm(root, { recursive: true, force: true });
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
