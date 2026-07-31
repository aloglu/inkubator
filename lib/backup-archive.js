const fssync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const yauzl = require('yauzl');

const { normalizeManagedRelativeImagePath } = require('./critical-persistence');

// Import workloads touch each image once; retaining decoded image cache only inflates server RSS.
sharp.cache(false);

const MANAGED_IMAGE_SECTIONS = new Set(['pens', 'inks', 'swatches']);
const SAFE_RASTER_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.heic',
  '.heif'
]);

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function backupError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMissingFileError(error) {
  return !!(error && error.code === 'ENOENT');
}

function legacyPngRepairError(error, relativePath) {
  if (error && typeof error.code === 'string') return error;
  return backupError(`Backup contains an unreadable legacy PNG image: ${relativePath}`);
}

async function statIfExists(fileSystem, targetPath) {
  try {
    return await fileSystem.stat(targetPath);
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

async function readDirectoryIfExists(fileSystem, targetPath, options) {
  try {
    return await fileSystem.readdir(targetPath, options);
  } catch (error) {
    if (isMissingFileError(error)) return [];
    throw error;
  }
}

async function lstatIfExists(fileSystem, targetPath) {
  const inspect = typeof fileSystem.lstat === 'function'
    ? fileSystem.lstat.bind(fileSystem)
    : fileSystem.stat.bind(fileSystem);
  try {
    return await inspect(targetPath);
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

function backupRelativePath(rawPath) {
  const normalized = String(rawPath || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const mediaRootIndex = parts.findIndex((part, index) => (
    (part === 'images' || part === 'replaced-images')
    && MANAGED_IMAGE_SECTIONS.has(parts[index + 1])
  ));
  if (mediaRootIndex >= 0) return parts.slice(mediaRootIndex).join('/');

  const filename = parts[parts.length - 1];
  if (filename === 'data.json') return 'data.json';
  if (filename === 'preferences.json') return 'preferences.json';
  if (filename === 'manifest.json') return 'manifest.json';
  return '';
}

function normalizeSafeManagedRasterPath(rawPath, options = {}) {
  if (typeof rawPath !== 'string') return '';
  const value = rawPath.trim();
  if (
    !value
    || (options.strict === true && (
      value !== rawPath
      || value.startsWith('/')
      || value.startsWith('./')
    ))
    || value.includes('\\')
    || /[?#\u0000-\u001f]/.test(value)
  ) {
    return '';
  }

  const normalized = normalizeManagedRelativeImagePath(value);
  const parts = normalized.split('/');
  if (
    parts.length < 2
    || !MANAGED_IMAGE_SECTIONS.has(parts[0])
    || parts.some((part) => !part || part === '.' || part === '..')
    || !SAFE_RASTER_EXTENSIONS.has(path.extname(parts[parts.length - 1]).toLowerCase())
  ) {
    return '';
  }
  return normalized;
}

function backupMediaPath(relativePath) {
  if (relativePath.startsWith('images/')) return relativePath.slice('images/'.length);
  if (relativePath.startsWith('replaced-images/')) {
    return relativePath.slice('replaced-images/'.length);
  }
  return '';
}

function isBackupThumbnailPath(relativePath) {
  return relativePath.startsWith('images/.thumbs/');
}

function isAllowedBackupPath(relativePath) {
  return relativePath === 'data.json'
    || relativePath === 'preferences.json'
    || relativePath === 'manifest.json'
    || !!normalizeSafeManagedRasterPath(backupMediaPath(relativePath));
}

function imageReferenceValues(data = {}) {
  const references = [];
  const add = (value) => {
    if (typeof value === 'string' && value) references.push(value);
  };

  for (const section of ['pens', 'inks', 'swatches']) {
    const records = Array.isArray(data && data[section]) ? data[section] : [];
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      add(record.image);
      add(record.image_url);
      add(record.url);
      const gallery = Array.isArray(record.images) ? record.images : [];
      for (const entry of gallery) {
        if (typeof entry === 'string') {
          add(entry);
          continue;
        }
        if (!entry || typeof entry !== 'object') continue;
        add(entry.path);
        add(entry.image);
        add(entry.url);
      }
    }
  }
  return references;
}

function collectManagedRasterReferencePaths(data = {}, options = {}) {
  const out = new Set();
  for (const value of imageReferenceValues(data)) {
    const normalized = normalizeSafeManagedRasterPath(value, options);
    if (normalized) out.add(normalized);
  }
  return [...out].sort();
}

function validateManagedRasterReferences(values = [], options = {}) {
  for (const rawValue of values) {
    if (typeof rawValue !== 'string') continue;
    const value = rawValue.trim();
    if (options.strict === true && value !== rawValue) {
      throw backupError(`Collection data contains an unsupported managed image path: ${value}`);
    }
    if (
      !value
      || value === 'default_pen.png'
      || /^(?:data:|blob:|https?:|file:)/i.test(value)
    ) {
      continue;
    }
    if (!normalizeSafeManagedRasterPath(rawValue, options)) {
      throw backupError(`Collection data contains an unsupported managed image path: ${value}`);
    }
  }
}

function hasRasterSignature(bytes, extension) {
  if (extension === '.jpg' || extension === '.jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === '.png') {
    return bytes.length >= 8
      && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (extension === '.webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (['.avif', '.heic', '.heif'].includes(extension)) {
    if (bytes.length < 12 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
    const brands = bytes.subarray(8).toString('ascii');
    if (extension === '.avif') return /avif|avis/.test(brands);
    return /heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(brands);
  }
  return false;
}

async function validateRasterImageBuffer(bytes, relativePath, options = {}) {
  const contents = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || '');
  const extension = path.extname(relativePath).toLowerCase();
  if (!hasRasterSignature(contents.subarray(0, 64), extension)) {
    throw backupError(`Image contents do not match the expected raster format: ${relativePath}`);
  }
  if (extension === '.heic' || extension === '.heif') return;
  try {
    const sharpOptions = {
      failOn: 'error',
      limitInputPixels: 100_000_000
    };
    const metadata = await sharp(contents, sharpOptions).metadata();
    if (!metadata.width || !metadata.height || metadata.pages > 1) {
      throw new Error('Image dimensions are invalid.');
    }
    if (options.fullDecode !== false) await sharp(contents, sharpOptions).stats();
  } catch (_) {
    throw backupError(`Image contents are not a readable raster image: ${relativePath}`);
  }
}

async function validateRasterImageFile(filePath, relativePath, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const extension = path.extname(relativePath).toLowerCase();
  const handle = await fileSystem.open(filePath, 'r');
  const signature = Buffer.alloc(64);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(signature, 0, signature.length, 0));
  } finally {
    await handle.close();
  }
  if (!hasRasterSignature(signature.subarray(0, bytesRead), extension)) {
    throw backupError(`Backup contains invalid raster image contents: ${relativePath}`);
  }

  // HEIC/HEIF decoding depends on the platform libvips build. Their signatures still
  // exclude active web content, so do not make otherwise-valid backups platform-specific.
  if (extension === '.heic' || extension === '.heif') return;
  try {
    const sharpOptions = {
      failOn: 'error',
      limitInputPixels: 100_000_000
    };
    const metadata = await sharp(filePath, sharpOptions).metadata();
    if (!metadata.width || !metadata.height || metadata.pages > 1) {
      throw new Error('Image dimensions are invalid.');
    }
    if (options.fullDecode !== false) {
      await sharp(filePath, sharpOptions).stats();
    }
  } catch (error) {
    throw backupError(`Backup contains an unreadable raster image: ${relativePath}`);
  }
}

async function repairLegacyPngWebpFile(filePath, relativePath, options = {}) {
  if (path.extname(relativePath).toLowerCase() !== '.webp') return false;
  const fileSystem = options.fileSystem || fs;
  const handle = await fileSystem.open(filePath, 'r');
  const signature = Buffer.alloc(8);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(signature, 0, signature.length, 0));
  } finally {
    await handle.close();
  }
  if (!hasRasterSignature(signature.subarray(0, bytesRead), '.png')) return false;

  const sharpOptions = {
    failOn: 'error',
    limitInputPixels: 100_000_000
  };
  try {
    const metadata = await sharp(filePath, sharpOptions).metadata();
    if (
      metadata.format !== 'png'
      || !metadata.width
      || !metadata.height
      || metadata.pages > 1
    ) {
      throw new Error('Legacy PNG dimensions are invalid.');
    }
  } catch (error) {
    throw legacyPngRepairError(error, relativePath);
  }

  const temporaryPath = `${filePath}.repair-${randomUUID()}.webp`;
  try {
    await sharp(filePath, sharpOptions)
      .webp({ lossless: true })
      .toFile(temporaryPath);
    const repairedStat = await fileSystem.stat(temporaryPath);
    const maxOutputBytes = Number(options.maxOutputBytes);
    if (Number.isFinite(maxOutputBytes) && repairedStat.size > maxOutputBytes) {
      const expandedLimitBytes = Number(options.expandedLimitBytes || maxOutputBytes);
      throw backupError(
        `Expanded backup exceeds the ${Math.round(expandedLimitBytes / 1024 / 1024)} MiB limit.`
      );
    }
    try {
      await validateRasterImageFile(temporaryPath, relativePath, { fileSystem });
    } catch (error) {
      throw legacyPngRepairError(error, relativePath);
    }
    await syncFile(fileSystem, temporaryPath);
    await fileSystem.rename(temporaryPath, filePath);
    await syncDirectory(fileSystem, path.dirname(filePath));
  } finally {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => {});
  }
  return true;
}

async function clearMissingLegacyInkSwatchAliases({
  collection,
  imagesRoot,
  fileSystem = fs
}) {
  const swatches = Array.isArray(collection?.swatches) ? collection.swatches : [];
  const inkIdsWithCurrentSwatches = new Set();
  for (const swatch of swatches) {
    if (!swatch || typeof swatch !== 'object' || typeof swatch.ink_id !== 'string') continue;
    const canonicalImages = [
      swatch.image,
      ...(Array.isArray(swatch.images)
        ? swatch.images.map((entry) => (
          typeof entry === 'string' ? entry : entry && entry.path
        ))
        : [])
    ];
    const hasCurrentSwatchImage = canonicalImages
      .some((value) => normalizeSafeManagedRasterPath(value, { strict: true }).startsWith('swatches/'));
    if (hasCurrentSwatchImage) inkIdsWithCurrentSwatches.add(swatch.ink_id);
  }

  const inks = Array.isArray(collection?.inks) ? collection.inks : [];
  for (const ink of inks) {
    if (!ink || !inkIdsWithCurrentSwatches.has(ink.id)) continue;
    for (const field of ['image', 'image_url', 'url']) {
      const normalized = normalizeSafeManagedRasterPath(ink[field], { strict: true });
      if (!normalized.startsWith('swatches/')) continue;
      const source = await resolveManagedRasterFile({
        imagesRoot,
        relativePath: normalized,
        fileSystem
      });
      if (!source) ink[field] = '';
    }
  }
}

function normalizedDirectoryParts(relativePath) {
  if (relativePath === '' || relativePath === undefined) return [];
  if (
    typeof relativePath !== 'string'
    || relativePath !== relativePath.trim()
    || relativePath.startsWith('/')
    || relativePath.includes('\\')
    || /[?#\u0000-\u001f]/.test(relativePath)
  ) {
    return null;
  }
  const parts = relativePath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts;
}

async function resolveManagedDirectory({
  root,
  relativePath = '',
  fileSystem = fs,
  create = false,
  statusCode = 400
}) {
  const parts = normalizedDirectoryParts(relativePath);
  if (!parts) {
    throw backupError(`Managed directory path is unsupported: ${relativePath}`, statusCode);
  }

  const rootStat = await lstatIfExists(fileSystem, root);
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink?.()) {
    throw backupError('Managed directory root is missing or is not a real directory.', statusCode);
  }
  const canonicalRoot = typeof fileSystem.realpath === 'function'
    ? await fileSystem.realpath(root)
    : path.resolve(root);

  let current = root;
  for (const [index, part] of parts.entries()) {
    const parent = current;
    current = path.join(current, part);
    let stat = await lstatIfExists(fileSystem, current);
    if (!stat && create) {
      try {
        await fileSystem.mkdir(current);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
      stat = await lstatIfExists(fileSystem, current);
      await syncDirectory(fileSystem, parent);
    }
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink?.()) {
      throw backupError(
        `Managed directory is missing or is not a real directory: `
        + parts.slice(0, index + 1).join('/'),
        statusCode
      );
    }
    const canonicalCurrent = typeof fileSystem.realpath === 'function'
      ? await fileSystem.realpath(current)
      : path.resolve(current);
    if (!isPathInside(canonicalRoot, canonicalCurrent)) {
      throw backupError(`Managed directory leaves its storage root: ${relativePath}`, statusCode);
    }
    current = canonicalCurrent;
  }
  return current;
}

async function resolveManagedRasterFile({
  imagesRoot,
  relativePath,
  fileSystem = fs,
  missingStatusCode = 400
}) {
  const normalized = normalizeSafeManagedRasterPath(relativePath, { strict: true });
  if (!normalized) {
    throw backupError('Managed image reference includes an unsupported path.', missingStatusCode);
  }

  const canonicalRoot = await resolveManagedDirectory({
    root: imagesRoot,
    fileSystem,
    statusCode: missingStatusCode
  });
  const parts = normalized.split('/');
  let current = imagesRoot;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stat = await lstatIfExists(fileSystem, current);
    if (!stat) return null;
    const isFinal = index === parts.length - 1;
    if (stat.isSymbolicLink?.() || (isFinal ? !stat.isFile() : !stat.isDirectory())) {
      throw backupError(
        isFinal
          ? `Referenced image is not a regular file: images/${normalized}`
          : `Referenced image uses a non-directory or symbolic-link parent: images/${normalized}`,
        missingStatusCode
      );
    }
  }

  const canonicalTarget = typeof fileSystem.realpath === 'function'
    ? await fileSystem.realpath(current)
    : path.resolve(current);
  if (!isPathInside(canonicalRoot, canonicalTarget)) {
    throw backupError(
      `Referenced image leaves the managed image directory: images/${normalized}`,
      missingStatusCode
    );
  }
  return { relativePath: normalized, target: canonicalTarget };
}

async function requireManagedRasterFiles({
  imagesRoot,
  relativePaths,
  fileSystem = fs,
  validateContents = false,
  fullDecode = true,
  missingStatusCode = 400
}) {
  const normalizedPaths = [...new Set(relativePaths || [])]
    .map((relativePath) => normalizeSafeManagedRasterPath(relativePath, { strict: true }));
  if (normalizedPaths.some((relativePath) => !relativePath)) {
    throw backupError('Managed image references include an unsupported path.', missingStatusCode);
  }
  normalizedPaths.sort();

  if (normalizedPaths.length === 0) return normalizedPaths;

  for (const relativePath of normalizedPaths) {
    const resolved = await resolveManagedRasterFile({
      imagesRoot,
      relativePath,
      fileSystem,
      missingStatusCode
    });
    if (!resolved) {
      throw backupError(
        `Referenced image is missing or is not a regular file: images/${relativePath}`,
        missingStatusCode
      );
    }
    if (validateContents) {
      await validateRasterImageFile(resolved.target, `images/${relativePath}`, {
        fileSystem,
        fullDecode
      });
    }
  }
  return normalizedPaths;
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
      if (!relative || isBackupThumbnailPath(relative)) continue;
      if (!isAllowedBackupPath(relative)) {
        if (relative.startsWith('images/') || relative.startsWith('replaced-images/')) {
          throw backupError(`Backup contains an unsupported managed media path: ${relative}`);
        }
        continue;
      }
      if (relative.split('/').includes('..') || seen.has(relative)) {
        throw backupError('Backup contains duplicate or unsafe file paths.');
      }
      seen.add(relative);

      const target = path.normalize(path.join(destination, relative));
      if (!isPathInside(destination, target)) throw backupError('Backup contains an unsafe file path.');
      await fs.mkdir(path.dirname(target), { recursive: true });
      const source = await zip.openReadStreamPromise(entry);
      try {
        await pipeline(source, fssync.createWriteStream(target, { flags: 'wx' }));
        await syncFile(fs, target);
      } catch (error) {
        await fs.rm(target, { force: true });
        throw error;
      }
      await syncDirectory(fs, path.dirname(target));
      if (relative.startsWith('images/') || relative.startsWith('replaced-images/')) {
        const originalSize = Number(entry.uncompressedSize || 0);
        const repaired = await repairLegacyPngWebpFile(target, relative, {
          maxOutputBytes: maxExpandedBytes - (expandedBytes - originalSize),
          expandedLimitBytes: maxExpandedBytes
        });
        if (repaired) {
          const repairedSize = (await fs.stat(target)).size;
          expandedBytes += Math.max(0, repairedSize - originalSize);
          if (expandedBytes > maxExpandedBytes) {
            throw backupError(
              `Expanded backup exceeds the ${Math.round(maxExpandedBytes / 1024 / 1024)} MiB limit.`
            );
          }
        } else {
          await validateRasterImageFile(target, relative);
        }
      }
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
    const stat = await statIfExists(fs, source);
    if (!stat || !stat.isFile()) {
      result.skipped += 1;
      return;
    }
    try {
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

async function writeTransactionMarker(fileSystem, markerPath, value) {
  const contents = `${JSON.stringify(value)}\n`;
  const temporaryPath = path.join(
    path.dirname(markerPath),
    `.${path.basename(markerPath)}.${process.pid}.${randomUUID()}.tmp`
  );
  let handle = null;
  let installed = false;
  try {
    if (typeof fileSystem.open === 'function') {
      handle = await fileSystem.open(temporaryPath, 'wx');
      await handle.writeFile(contents);
      await handle.sync();
      await handle.close();
      handle = null;
    } else {
      await fileSystem.writeFile(temporaryPath, contents, { flag: 'wx' });
    }
    await fileSystem.rename(temporaryPath, markerPath);
    installed = true;
    await syncDirectory(fileSystem, path.dirname(markerPath));
  } catch (error) {
    if (installed && error && typeof error === 'object') {
      error.transactionMarkerInstalled = true;
      error.transactionMarkerState = value.state;
    }
    throw error;
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function syncDirectory(fileSystem, directoryPath) {
  if (typeof fileSystem.open !== 'function') return;
  if (!(await statIfExists(fileSystem, directoryPath))) return;
  let handle = null;
  try {
    handle = await fileSystem.open(directoryPath, 'r');
    await handle.sync();
  } catch (error) {
    const unsupportedOnWindows = process.platform === 'win32'
      && ['EISDIR', 'EINVAL', 'ENOTSUP', 'EPERM'].includes(error?.code);
    if (!unsupportedOnWindows) throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function syncFile(fileSystem, filePath) {
  if (typeof fileSystem.open !== 'function') return;
  const handle = await fileSystem.open(filePath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncTree(fileSystem, targetPath) {
  if (typeof fileSystem.open !== 'function') return;
  const stat = await statIfExists(fileSystem, targetPath);
  if (!stat) return;
  if (!stat.isDirectory()) {
    await syncFile(fileSystem, targetPath);
    return;
  }
  if (typeof fileSystem.readdir === 'function') {
    const entries = await readDirectoryIfExists(fileSystem, targetPath, { withFileTypes: true });
    for (const entry of entries) {
      await syncTree(fileSystem, path.join(targetPath, entry.name));
    }
  }
  await syncDirectory(fileSystem, targetPath);
}

async function syncDirectories(fileSystem, directoryPaths) {
  for (const directoryPath of new Set(directoryPaths.filter(Boolean))) {
    await syncDirectory(fileSystem, directoryPath);
  }
}

function recoveryError(message, rollbackRoot, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.rollbackRoot = rollbackRoot;
  return error;
}

function attachRollbackRoot(error, rollbackRoot) {
  if (error && !error.rollbackRoot) error.rollbackRoot = rollbackRoot;
  return error;
}

function transactionPathMatchesKind(stat, kind) {
  if (!stat || !kind) return !!stat;
  if (kind === 'file') return stat.isFile();
  if (kind === 'directory') return stat.isDirectory();
  return false;
}

function transactionKindDescription(kind) {
  return kind === 'directory' ? 'directory' : 'regular file';
}

function validateTransactionMarker(marker, targets, rollbackRoot) {
  const expectedNames = targets.map((item) => item && item.name);
  const expected = new Set(expectedNames);
  const expectedNamesAreSafe = expected.size === expectedNames.length
    && expectedNames.every((name) => (
      typeof name === 'string'
      && !!name
      && name !== '.'
      && name !== '..'
      && !name.includes('/')
      && !name.includes('\\')
    ));
  const expectedKindsAreValid = targets.every(
    (item) => !item.kind || ['file', 'directory'].includes(item.kind)
  );
  const structurallyValid = marker
    && typeof marker === 'object'
    && !Array.isArray(marker)
    && marker.version === 1
    && ['prepared', 'committed', 'rolled-back'].includes(marker.state)
    && Array.isArray(marker.items)
    && marker.items.length === expectedNames.length
    && expectedNamesAreSafe
    && expectedKindsAreValid;

  if (!structurallyValid) {
    throw recoveryError(`Transaction marker is invalid at ${rollbackRoot}.`, rollbackRoot);
  }

  const seen = new Set();
  for (const item of marker.items) {
    const validItem = item
      && typeof item === 'object'
      && !Array.isArray(item)
      && typeof item.name === 'string'
      && expected.has(item.name)
      && !seen.has(item.name)
      && typeof item.hadExisting === 'boolean';
    if (!validItem) {
      throw recoveryError(`Transaction marker is invalid at ${rollbackRoot}.`, rollbackRoot);
    }
    seen.add(item.name);
  }
  if (seen.size !== expected.size) {
    throw recoveryError(`Transaction marker is invalid at ${rollbackRoot}.`, rollbackRoot);
  }
  return marker;
}

async function removeTransactionPath(fileSystem, targetPath, rollbackRoot) {
  try {
    await fileSystem.rm(targetPath, { recursive: true, force: true });
    await syncDirectory(fileSystem, path.dirname(targetPath));
  } catch (cause) {
    throw recoveryError(
      `Transaction cleanup failed for ${targetPath}: ${cause.message}`,
      rollbackRoot,
      cause
    );
  }
}

function retiredCleanupError(message, retiredRoot, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.retiredRoot = retiredRoot;
  return error;
}

async function retireTransactionRoot(fileSystem, rollbackRoot) {
  const parent = path.dirname(rollbackRoot);
  const retiredRoot = path.join(
    parent,
    `.transaction-cleanup-${path.basename(rollbackRoot).replace(/^\.+/, '')}-${randomUUID()}`
  );
  try {
    await fileSystem.rename(rollbackRoot, retiredRoot);
  } catch (cause) {
    if (isMissingFileError(cause)) return [];
    throw recoveryError(
      `Transaction cleanup could not retire ${rollbackRoot}: ${cause.message}`,
      rollbackRoot,
      cause
    );
  }

  const cleanupErrors = [];
  try {
    await syncDirectory(fileSystem, parent);
  } catch (cause) {
    cleanupErrors.push(retiredCleanupError(
      `Retired transaction directory could not be synchronized: ${retiredRoot}: ${cause.message}`,
      retiredRoot,
      cause
    ));
    return cleanupErrors;
  }
  try {
    await fileSystem.rm(retiredRoot, { recursive: true, force: true });
    await syncDirectory(fileSystem, parent);
  } catch (cause) {
    cleanupErrors.push(retiredCleanupError(
      `Retired transaction cleanup failed for ${retiredRoot}: ${cause.message}`,
      retiredRoot,
      cause
    ));
  }
  return cleanupErrors;
}

async function cleanupTransaction(fileSystem, stagedRoot, rollbackRoot) {
  await removeTransactionPath(fileSystem, stagedRoot, rollbackRoot);
  return retireTransactionRoot(fileSystem, rollbackRoot);
}

async function commitStagedImport({
  stagedRoot,
  targets,
  rollbackRoot,
  fileSystem = fs
}) {
  try {
    await fileSystem.rm(rollbackRoot, { recursive: true, force: true });
    await syncDirectory(fileSystem, path.dirname(rollbackRoot));
    await fileSystem.mkdir(rollbackRoot, { recursive: true });
    await syncDirectory(fileSystem, path.dirname(rollbackRoot));
  } catch (error) {
    throw attachRollbackRoot(error, rollbackRoot);
  }
  const backedUp = [];
  const promoted = [];
  const recoveryItems = [];
  let outcomeError = null;
  let committed = false;
  let preparedMarkerInstalled = false;
  let finalityError = null;
  const transactionMarker = path.join(rollbackRoot, 'transaction.json');

  try {
    for (const item of targets) {
      const stagedStat = await lstatIfExists(fileSystem, item.staged);
      if (!stagedStat) {
        throw new Error(`Staged import item is missing: ${path.basename(item.staged)}`);
      }
      if (!transactionPathMatchesKind(stagedStat, item.kind)) {
        throw new Error(
          `Staged import item must be a ${transactionKindDescription(item.kind)}: ${item.staged}`
        );
      }
      await syncTree(fileSystem, item.staged);
      const targetStat = await lstatIfExists(fileSystem, item.target);
      if (targetStat && !transactionPathMatchesKind(targetStat, item.kind)) {
        throw new Error(
          `Live transaction target must be a ${transactionKindDescription(item.kind)}: ${item.target}`
        );
      }
      recoveryItems.push({
        name: item.name,
        hadExisting: !!targetStat
      });
    }
    await writeTransactionMarker(fileSystem, transactionMarker, {
      version: 1,
      state: 'prepared',
      items: recoveryItems
    });
    preparedMarkerInstalled = true;
    for (const [index, item] of targets.entries()) {
      const rollback = path.join(rollbackRoot, item.name);
      const targetStat = await lstatIfExists(fileSystem, item.target);
      if (!!targetStat !== recoveryItems[index].hadExisting) {
        throw new Error(`Live transaction target changed during commit: ${item.target}`);
      }
      if (targetStat && !transactionPathMatchesKind(targetStat, item.kind)) {
        throw new Error(
          `Live transaction target must be a ${transactionKindDescription(item.kind)}: ${item.target}`
        );
      }
      if (targetStat) {
        await fileSystem.rename(item.target, rollback);
        backedUp.push({ target: item.target, rollback });
      }
    }
    await syncDirectories(fileSystem, [
      rollbackRoot,
      ...targets.map((item) => path.dirname(item.target))
    ]);
    for (const item of targets) {
      await fileSystem.rename(item.staged, item.target);
      promoted.push(item.target);
    }
    await syncDirectories(fileSystem, [
      stagedRoot,
      ...targets.map((item) => path.dirname(item.target))
    ]);
    await writeTransactionMarker(fileSystem, transactionMarker, {
      version: 1,
      state: 'committed',
      items: recoveryItems
    });
    committed = true;
  } catch (error) {
    if (error.transactionMarkerInstalled && error.transactionMarkerState === 'committed') {
      committed = true;
      finalityError = recoveryError(
        `The committed transaction marker could not be durably synchronized. `
        + `Recovery files remain at ${rollbackRoot}.`,
        rollbackRoot,
        error
      );
    } else {
      if (error.transactionMarkerInstalled && error.transactionMarkerState === 'prepared') {
        preparedMarkerInstalled = true;
      }
      const restorationErrors = [];
      for (const target of promoted.reverse()) {
        try {
          await fileSystem.rm(target, { recursive: true, force: true });
        } catch (restoreError) {
          restorationErrors.push(restoreError);
        }
      }
      for (const item of backedUp.reverse()) {
        try {
          if (await statIfExists(fileSystem, item.rollback)) {
            await fileSystem.rename(item.rollback, item.target);
          }
        } catch (restoreError) {
          restorationErrors.push(restoreError);
        }
      }
      if (restorationErrors.length === 0 && preparedMarkerInstalled) {
        for (const [index, item] of targets.entries()) {
          try {
            const targetStat = await lstatIfExists(fileSystem, item.target);
            const shouldExist = recoveryItems[index].hadExisting;
            if (
              !!targetStat !== shouldExist
              || (targetStat && !transactionPathMatchesKind(targetStat, item.kind))
            ) {
              throw new Error(`Rollback did not restore the expected target: ${item.target}`);
            }
          } catch (restoreError) {
            restorationErrors.push(restoreError);
          }
        }
      }
      if (restorationErrors.length === 0 && preparedMarkerInstalled) {
        try {
          await syncDirectories(fileSystem, [
            rollbackRoot,
            ...targets.map((item) => path.dirname(item.target))
          ]);
          await writeTransactionMarker(fileSystem, transactionMarker, {
            version: 1,
            state: 'rolled-back',
            items: recoveryItems
          });
        } catch (restoreError) {
          restorationErrors.push(restoreError);
        }
      }

      if (restorationErrors.length === 0) {
        outcomeError = error;
      } else {
        const incompleteError = recoveryError(
          `Import failed and rollback restoration was incomplete. Recoverable files remain at ${rollbackRoot}. `
          + `Original error: ${error.message}. Restoration error: ${restorationErrors[0].message}`,
          rollbackRoot,
          error
        );
        incompleteError.restorationErrors = restorationErrors;
        throw incompleteError;
      }
    }
  }

  if (finalityError) {
    return { cleanupErrors: [finalityError], recoveryRequired: true };
  }

  let cleanupErrors;
  try {
    cleanupErrors = await cleanupTransaction(fileSystem, stagedRoot, rollbackRoot);
  } catch (cleanupError) {
    if (committed) {
      return { cleanupErrors: [cleanupError], recoveryRequired: true };
    }
    if (outcomeError) cleanupError.originalError = outcomeError;
    throw cleanupError;
  }
  if (outcomeError) {
    if (cleanupErrors.length > 0) outcomeError.cleanupErrors = cleanupErrors;
    throw outcomeError;
  }
  return { cleanupErrors };
}

async function recoverInterruptedTransaction({
  stagedRoot,
  targets,
  rollbackRoot,
  fileSystem = fs
}) {
  let rollbackStat;
  try {
    rollbackStat = await lstatIfExists(fileSystem, rollbackRoot);
  } catch (error) {
    throw attachRollbackRoot(error, rollbackRoot);
  }
  if (!rollbackStat || !rollbackStat.isDirectory()) {
    if (rollbackStat && !rollbackStat.isDirectory()) {
      throw recoveryError(`Transaction rollback path is not a directory: ${rollbackRoot}`, rollbackRoot);
    }
    await removeTransactionPath(fileSystem, stagedRoot, rollbackRoot);
    return { recovered: false, action: 'none' };
  }

  let marker = null;
  const markerPath = path.join(rollbackRoot, 'transaction.json');
  try {
    const markerStat = await lstatIfExists(fileSystem, markerPath);
    if (markerStat) {
      if (!markerStat.isFile()) {
        throw recoveryError(
          `Transaction marker is not a regular file at ${rollbackRoot}.`,
          rollbackRoot
        );
      }
      const markerContents = await fileSystem.readFile(markerPath, 'utf8');
      try {
        marker = JSON.parse(markerContents);
      } catch (cause) {
        throw recoveryError(
          `Transaction marker is invalid JSON at ${rollbackRoot}.`,
          rollbackRoot,
          cause
        );
      }
    }
  } catch (error) {
    throw attachRollbackRoot(error, rollbackRoot);
  }

  if (marker) {
    validateTransactionMarker(marker, targets, rollbackRoot);
    if (marker.state === 'rolled-back') {
      const cleanupErrors = await cleanupTransaction(fileSystem, stagedRoot, rollbackRoot);
      const result = {
        recovered: true,
        action: 'kept-rolled-back'
      };
      if (cleanupErrors.length > 0) result.cleanupErrors = cleanupErrors;
      return result;
    }
    if (marker.state === 'committed') {
      try {
        const targetStats = await Promise.all(
          targets.map((item) => lstatIfExists(fileSystem, item.target))
        );
        if (targetStats.every((stat, index) => (
          !!stat && transactionPathMatchesKind(stat, targets[index].kind)
        ))) {
          const cleanupErrors = await cleanupTransaction(fileSystem, stagedRoot, rollbackRoot);
          const result = { recovered: true, action: 'kept-committed' };
          if (cleanupErrors.length > 0) result.cleanupErrors = cleanupErrors;
          return result;
        }
      } catch (error) {
        throw attachRollbackRoot(error, rollbackRoot);
      }
    }
  }

  const markerItems = new Map(
    marker ? marker.items.map((item) => [item.name, item]) : []
  );
  try {
    const rollbackStats = new Map();
    for (const item of targets) {
      rollbackStats.set(
        item.name,
        await lstatIfExists(fileSystem, path.join(rollbackRoot, item.name))
      );
    }
    const terminalItems = marker
      ? marker.items
      : targets.map((item) => ({
        name: item.name,
        hadExisting: !!rollbackStats.get(item.name)
      }));
    if (marker?.state === 'committed') {
      await writeTransactionMarker(fileSystem, markerPath, {
        version: 1,
        state: 'prepared',
        items: terminalItems
      });
      marker = { ...marker, state: 'prepared' };
    }

    for (const item of [...targets].reverse()) {
      const rollback = path.join(rollbackRoot, item.name);
      const rollbackStat = rollbackStats.get(item.name);
      const rollbackExists = !!rollbackStat;
      const markerItem = markerItems.get(item.name);

      if (rollbackExists) {
        if (markerItem && markerItem.hadExisting === false) {
          throw recoveryError(
            `Transaction marker conflicts with rollback data at ${rollback}.`,
            rollbackRoot
          );
        }
        if (!transactionPathMatchesKind(rollbackStat, item.kind)) {
          throw recoveryError(
            `Transaction rollback item must be a ${transactionKindDescription(item.kind)}: ${rollback}`,
            rollbackRoot
          );
        }
        await fileSystem.rm(item.target, { recursive: true, force: true });
        await fileSystem.mkdir(path.dirname(item.target), { recursive: true });
        await fileSystem.rename(rollback, item.target);
        await syncDirectories(fileSystem, [
          rollbackRoot,
          path.dirname(item.target)
        ]);
      } else if (markerItem && markerItem.hadExisting === false) {
        await fileSystem.rm(item.target, { recursive: true, force: true });
        await syncDirectory(fileSystem, path.dirname(item.target));
      } else if (markerItem && markerItem.hadExisting === true) {
        const targetStat = await lstatIfExists(fileSystem, item.target);
        if (!targetStat || !transactionPathMatchesKind(targetStat, item.kind)) {
          throw recoveryError(
            `Interrupted transaction recovery is missing both a valid `
            + `${transactionKindDescription(item.kind)} at ${item.target} and its rollback copy. `
            + `Recovery files remain at ${rollbackRoot}.`,
            rollbackRoot
          );
        }
      }
    }

    await syncDirectories(fileSystem, [
      rollbackRoot,
      ...targets.map((item) => path.dirname(item.target))
    ]);
    await writeTransactionMarker(fileSystem, markerPath, {
      version: 1,
      state: 'rolled-back',
      items: terminalItems
    });
  } catch (error) {
    throw attachRollbackRoot(error, rollbackRoot);
  }
  const cleanupErrors = await cleanupTransaction(fileSystem, stagedRoot, rollbackRoot);
  const result = { recovered: true, action: 'rolled-back' };
  if (cleanupErrors.length > 0) result.cleanupErrors = cleanupErrors;
  return result;
}

module.exports = {
  backupError,
  backupRelativePath,
  clearMissingLegacyInkSwatchAliases,
  collectManagedRasterReferencePaths,
  commitStagedImport,
  extractBackupZip,
  imageReferenceValues,
  isMissingFileError,
  normalizeSafeManagedRasterPath,
  readDirectoryIfExists,
  receiveRequestToFile,
  recoverInterruptedTransaction,
  regenerateThumbnails,
  requireManagedRasterFiles,
  resolveManagedDirectory,
  resolveManagedRasterFile,
  statIfExists,
  syncDirectory,
  syncFile,
  syncTree,
  validateManagedRasterReferences,
  validateRasterImageBuffer,
  validateRasterImageFile
};
