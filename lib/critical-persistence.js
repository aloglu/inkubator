const path = require('path');

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
  if (!(await fs.pathExists(destPath))) return destPath;

  const parsed = path.parse(destPath);
  let i = 2;
  while (true) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!(await fs.pathExists(candidate))) return candidate;
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
  keepArchived = false
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
    return { success: true, action: 'deleted', relativePath: normalized };
  }

  const archiveDestination = path.normalize(path.join(archiveRoot, normalized));
  if (!isPathInside(archiveRoot, archiveDestination)) {
    return { success: false, action: 'invalid-archive-path', relativePath: normalized };
  }

  const uniqueArchivePath = await resolveUniquePath(fs, archiveDestination);
  await fs.ensureDir(path.dirname(uniqueArchivePath));
  await fs.move(sourcePath, uniqueArchivePath, { overwrite: false });
  return {
    success: true,
    action: 'archived',
    relativePath: normalized,
    archivedRelativePath: path.relative(archiveRoot, uniqueArchivePath).replace(/\\/g, '/')
  };
}

async function runSavePostCommitSteps({
  committed = false,
  requestedPreferences,
  combined,
  savePreferencesToDisk,
  enforceAutoBackupRetention,
  createAutoBackupSnapshot
}) {
  try {
    await savePreferencesToDisk(requestedPreferences);
  } catch (preferencesError) {
    if (!committed) throw preferencesError;
    return {
      success: true,
      warning: true,
      message: `Data saved, but preferences could not be saved: ${preferencesError.message}`
    };
  }

  try {
    await enforceAutoBackupRetention(combined);
    await createAutoBackupSnapshot(combined, 'save-data');
    return { success: true };
  } catch (backupError) {
    if (!committed) throw backupError;
    return {
      success: true,
      warning: true,
      message: `Data and preferences saved, but a backup step failed: ${backupError.message}`
    };
  }
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
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  disposeManagedImage,
  isManagedImageReference,
  normalizeManagedRelativeImagePath,
  runSavePostCommitSteps,
  replaceImagesWithStaging
};
