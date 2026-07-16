const fssync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const yauzl = require('yauzl');

const { normalizeManagedRelativeImagePath } = require('./critical-persistence');

// Import workloads touch each image once; retaining decoded image cache only inflates server RSS.
sharp.cache(false);

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function backupError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function backupRelativePath(rawPath) {
  const normalized = String(rawPath || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const dataIndex = parts.lastIndexOf('data.json');
  if (dataIndex >= 0) return 'data.json';
  const prefsIndex = parts.lastIndexOf('preferences.json');
  if (prefsIndex >= 0) return 'preferences.json';
  const manifestIndex = parts.lastIndexOf('manifest.json');
  if (manifestIndex >= 0) return 'manifest.json';
  const imagesIndex = parts.indexOf('images');
  if (imagesIndex >= 0) return parts.slice(imagesIndex).join('/');
  const replacedIndex = parts.indexOf('replaced-images');
  if (replacedIndex >= 0) return parts.slice(replacedIndex).join('/');
  return '';
}

function isAllowedBackupPath(relativePath) {
  return relativePath === 'data.json'
    || relativePath === 'preferences.json'
    || relativePath === 'manifest.json'
    || relativePath.startsWith('images/')
    || relativePath.startsWith('replaced-images/');
}

async function receiveRequestToFile(request, targetPath, maxBytes) {
  const declaredSize = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw backupError(`Backup exceeds the ${Math.round(maxBytes / 1024 / 1024)} MiB upload limit.`, 413);
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  let receivedBytes = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        callback(backupError(`Backup exceeds the ${Math.round(maxBytes / 1024 / 1024)} MiB upload limit.`, 413));
        return;
      }
      callback(null, chunk);
    }
  });

  try {
    await pipeline(request, limiter, fssync.createWriteStream(targetPath, { flags: 'wx' }));
  } catch (error) {
    await fs.rm(targetPath, { force: true });
    throw error;
  }
  if (receivedBytes === 0) {
    await fs.rm(targetPath, { force: true });
    throw backupError('Selected backup is empty.');
  }
  return receivedBytes;
}

function isZipSymlink(entry) {
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (mode & 0o170000) === 0o120000;
}

async function extractBackupZip(zipPath, destination, limits = {}) {
  const maxEntries = Number(limits.maxEntries || 20000);
  const maxExpandedBytes = Number(limits.maxExpandedBytes || 2 * 1024 * 1024 * 1024);
  const zip = await yauzl.openPromise(zipPath, {
    autoClose: true,
    decodeStrings: true,
    strictFileNames: false,
    validateEntrySizes: true
  });
  const seen = new Set();
  let entryCount = 0;
  let expandedBytes = 0;

  await fs.mkdir(destination, { recursive: true });
  try {
    for await (const entry of zip.eachEntry()) {
      entryCount += 1;
      if (entryCount > maxEntries) {
        throw backupError(`Backup contains more than ${maxEntries} entries.`);
      }
      expandedBytes += Number(entry.uncompressedSize || 0);
      if (expandedBytes > maxExpandedBytes) {
        throw backupError(`Expanded backup exceeds the ${Math.round(maxExpandedBytes / 1024 / 1024)} MiB limit.`);
      }
      if (entry.fileName.endsWith('/')) continue;
      if (isZipSymlink(entry)) throw backupError('Backup contains an unsupported symbolic link.');

      const relative = backupRelativePath(entry.fileName);
      if (!relative || !isAllowedBackupPath(relative)) continue;
      if (relative.split('/').includes('..') || seen.has(relative)) {
        throw backupError('Backup contains duplicate or unsafe file paths.');
      }
      seen.add(relative);

      const target = path.normalize(path.join(destination, relative));
      if (!isPathInside(destination, target)) throw backupError('Backup contains an unsafe file path.');
      await fs.mkdir(path.dirname(target), { recursive: true });
      const source = await zip.openReadStreamPromise(entry);
      await pipeline(source, fssync.createWriteStream(target, { flags: 'wx' }));
    }
  } finally {
    zip.close();
  }

  return { entryCount, expandedBytes, extractedPaths: [...seen] };
}

async function mapConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

async function regenerateThumbnails({
  imagesRoot,
  thumbnailsRoot,
  relativePaths,
  concurrency = 4
}) {
  await fs.rm(thumbnailsRoot, { recursive: true, force: true });
  await fs.mkdir(thumbnailsRoot, { recursive: true });
  const result = { generated: 0, skipped: 0, failed: 0 };

  await mapConcurrent(relativePaths, concurrency, async (rawPath) => {
    const normalized = normalizeManagedRelativeImagePath(rawPath);
    if (!normalized) {
      result.skipped += 1;
      return;
    }
    const source = path.normalize(path.join(imagesRoot, normalized));
    const target = path.normalize(path.join(thumbnailsRoot, normalized));
    if (!isPathInside(imagesRoot, source) || !isPathInside(thumbnailsRoot, target)) {
      result.skipped += 1;
      return;
    }
    try {
      const stat = await fs.stat(source);
      if (!stat.isFile()) {
        result.skipped += 1;
        return;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await sharp(source, { failOn: 'none' })
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(target);
      result.generated += 1;
    } catch (_) {
      result.failed += 1;
      await fs.rm(target, { force: true });
    }
  });

  return result;
}

async function commitStagedImport({ stagedRoot, targets, rollbackRoot }) {
  await fs.rm(rollbackRoot, { recursive: true, force: true });
  await fs.mkdir(rollbackRoot, { recursive: true });
  const backedUp = [];
  const promoted = [];

  try {
    for (const item of targets) {
      if (!(await fs.stat(item.staged).catch(() => null))) {
        throw new Error(`Staged import item is missing: ${path.basename(item.staged)}`);
      }
      const rollback = path.join(rollbackRoot, item.name);
      if (await fs.stat(item.target).catch(() => null)) {
        await fs.rename(item.target, rollback);
        backedUp.push({ target: item.target, rollback });
      }
    }
    for (const item of targets) {
      await fs.rename(item.staged, item.target);
      promoted.push(item.target);
    }
    await fs.rm(rollbackRoot, { recursive: true, force: true });
  } catch (error) {
    for (const target of promoted.reverse()) {
      await fs.rm(target, { recursive: true, force: true });
    }
    for (const item of backedUp.reverse()) {
      if (await fs.stat(item.rollback).catch(() => null)) {
        await fs.rename(item.rollback, item.target);
      }
    }
    throw error;
  } finally {
    await fs.rm(stagedRoot, { recursive: true, force: true });
    await fs.rm(rollbackRoot, { recursive: true, force: true });
  }
}

module.exports = {
  backupError,
  backupRelativePath,
  commitStagedImport,
  extractBackupZip,
  receiveRequestToFile,
  regenerateThumbnails
};
