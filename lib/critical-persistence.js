const fs = require('node:fs/promises');
const path = require('path');
const { randomUUID } = require('node:crypto');

function isUnsupportedWindowsDirectorySync(error) {
  return process.platform === 'win32'
    && ['EISDIR', 'EINVAL', 'ENOTSUP', 'EPERM'].includes(error?.code);
}

async function syncDirectory(fileSystem, directory) {
  let handle;
  try {
    handle = await fileSystem.open(directory, 'r');
    await handle.sync();
  } catch (error) {
    if (!isUnsupportedWindowsDirectorySync(error)) throw error;
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

async function atomicWriteFile(file, contents, fileSystem = fs) {
  const directory = path.dirname(file);
  const tempFile = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`
  );

  await fileSystem.mkdir(directory, { recursive: true });
  try {
    const handle = await fileSystem.open(tempFile, 'wx');
    try {
      await handle.writeFile(contents);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fileSystem.rename(tempFile, file);
    await syncDirectory(fileSystem, directory);
  } finally {
    await fileSystem.rm(tempFile, { force: true });
  }
}

async function atomicWriteJson(file, value, fileSystem = fs) {
  await atomicWriteFile(file, `${JSON.stringify(value, null, 2)}\n`, fileSystem);
}

function createSerializedExecutor() {
  let tail = Promise.resolve();

  return function runSerialized(operation) {
    if (typeof operation !== 'function') {
      return Promise.reject(new TypeError('Serialized operation must be a function.'));
    }
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  };
}

function makeSwapSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeManagedRelativeImagePath(inputPath = '') {
  if (typeof inputPath !== 'string') return '';
  let value = inputPath.trim();
  if (!value) return '';

  if (value.startsWith('file://')) {
    return '';
  }

  value = value.replace(/\\/g, '/');
  value = value.replace(/^\.\/+/, '');
  value = value.replace(/^\/+/, '');
  if (value.startsWith('images/')) {
    value = value.slice('images/'.length);
  }
  return value;
}

function isManagedImageReference(inputPath = '') {
  if (typeof inputPath !== 'string') return false;
  const value = inputPath.trim();
  if (!value) return false;
  if (value.includes('default_')) return false;
  if (
    value.startsWith('data:')
    || value.startsWith('blob:')
    || value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('file://')
  ) {
    return false;
  }
  return !!normalizeManagedRelativeImagePath(value);
}

function collectReferencedImageRelativePaths(data = {}) {
  const out = new Set();
  const pushIfManaged = (imagePath) => {
    if (!isManagedImageReference(imagePath)) return;
    const normalized = normalizeManagedRelativeImagePath(imagePath);
    if (normalized) out.add(normalized);
  };

  const pens = Array.isArray(data.pens) ? data.pens : [];
  const inks = Array.isArray(data.inks) ? data.inks : [];
  const swatches = Array.isArray(data.swatches) ? data.swatches : [];

  pens.forEach((pen) => pushIfManaged(pen && pen.image));
  pens.forEach((pen) => {
    (Array.isArray(pen && pen.images) ? pen.images : []).forEach((image) => pushIfManaged(image && image.path));
  });
  inks.forEach((ink) => {
    const imagePath = ink && ink.image;
    const normalized = normalizeManagedRelativeImagePath(imagePath);
    // Legacy ink records can retain a swatch-owned compatibility path after migration.
    if (normalized.startsWith('swatches/')) return;
    pushIfManaged(imagePath);
  });
  swatches.forEach((swatch) => pushIfManaged(swatch && swatch.image));
  swatches.forEach((swatch) => {
    (Array.isArray(swatch && swatch.images) ? swatch.images : []).forEach((image) => pushIfManaged(image && image.path));
  });

  return [...out].sort();
}

function isPathInside(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function resolveUniquePath(fs, destPath) {
  const pathEntryExists = async (target) => {
    if (typeof fs.lstat !== 'function') return fs.pathExists(target);
    try {
      await fs.lstat(target);
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  };
  if (!(await pathEntryExists(destPath))) return destPath;

  const parsed = path.parse(destPath);
  let i = 2;
  while (true) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!(await pathEntryExists(candidate))) return candidate;
    i += 1;
  }
}

async function copyReferencedImages({
  fs,
  sourceRoot,
  destinationRoot,
  relativePaths = [],
  overwrite = true
}) {
  await fs.ensureDir(destinationRoot);
  const copied = [];

  for (const relativePath of relativePaths) {
    const normalized = normalizeManagedRelativeImagePath(relativePath);
    if (!normalized) continue;

    const sourcePath = path.normalize(path.join(sourceRoot, normalized));
    if (!isPathInside(sourceRoot, sourcePath)) continue;
    if (!(await fs.pathExists(sourcePath))) continue;

    const destinationPath = path.normalize(path.join(destinationRoot, normalized));
    if (!isPathInside(destinationRoot, destinationPath)) continue;

    await fs.ensureDir(path.dirname(destinationPath));
    await fs.copy(sourcePath, destinationPath, { overwrite, errorOnExist: !overwrite });
    copied.push(normalized);
  }

  return copied;
}

async function disposeManagedImage({
  fs,
  imagesRoot,
  archiveRoot,
  imagePath,
  keepArchived = false,
  ensureArchiveDirectory = (directory) => fs.ensureDir(directory),
  syncDirectory: syncMutationDirectory = async () => {}
}) {
  const normalized = normalizeManagedRelativeImagePath(imagePath);
  if (!normalized) {
    return { success: true, action: 'noop', relativePath: '' };
  }

  const sourcePath = path.normalize(path.join(imagesRoot, normalized));
  if (!isPathInside(imagesRoot, sourcePath)) {
    return { success: false, action: 'invalid-path', relativePath: normalized };
  }
  if (!(await fs.pathExists(sourcePath))) {
    return { success: true, action: 'missing', relativePath: normalized };
  }

  if (!keepArchived || !archiveRoot) {
    await fs.remove(sourcePath);
    await syncMutationDirectory(path.dirname(sourcePath));
    return { success: true, action: 'deleted', relativePath: normalized };
  }

  const archiveDestination = path.normalize(path.join(archiveRoot, normalized));
  if (!isPathInside(archiveRoot, archiveDestination)) {
    return { success: false, action: 'invalid-archive-path', relativePath: normalized };
  }

  await ensureArchiveDirectory(path.dirname(archiveDestination));
  const uniqueArchivePath = await resolveUniquePath(fs, archiveDestination);
  await fs.move(sourcePath, uniqueArchivePath, { overwrite: false });
  for (const directory of new Set([
    path.dirname(sourcePath),
    path.dirname(uniqueArchivePath)
  ])) {
    await syncMutationDirectory(directory);
  }
  return {
    success: true,
    action: 'archived',
    relativePath: normalized,
    archivedRelativePath: path.relative(archiveRoot, uniqueArchivePath).replace(/\\/g, '/')
  };
}

async function replaceImagesWithStaging({
  fs,
  backupImagesPath,
  imagesPath,
  tempRoot,
  suffix = makeSwapSuffix(),
  stagingPath: explicitStagingPath,
  rollbackPath: explicitRollbackPath
}) {
  const root = tempRoot || path.dirname(imagesPath);
  const stagingPath = explicitStagingPath || path.join(root, `images-import-staging-${suffix}`);
  const rollbackPath = explicitRollbackPath || path.join(root, `images-import-rollback-${suffix}`);

  try {
    await fs.copy(backupImagesPath, stagingPath, { overwrite: true, errorOnExist: false });

    const hadExistingImages = await fs.pathExists(imagesPath);
    if (hadExistingImages) {
      await fs.move(imagesPath, rollbackPath, { overwrite: true });
    }

    try {
      await fs.move(stagingPath, imagesPath, { overwrite: true });
      if (await fs.pathExists(rollbackPath)) {
        await fs.remove(rollbackPath);
      }
    } catch (swapError) {
      if (await fs.pathExists(imagesPath)) {
        await fs.remove(imagesPath);
      }
      if (await fs.pathExists(rollbackPath)) {
        await fs.move(rollbackPath, imagesPath, { overwrite: true });
      }
      throw swapError;
    }
  } finally {
    if (await fs.pathExists(stagingPath)) {
      await fs.remove(stagingPath);
    }
  }
}

module.exports = {
  atomicWriteFile,
  atomicWriteJson,
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  createSerializedExecutor,
  disposeManagedImage,
  isManagedImageReference,
  normalizeManagedRelativeImagePath,
  replaceImagesWithStaging
};
