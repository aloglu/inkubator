const path = require('path');

function makeSwapSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  runSavePostCommitSteps,
  replaceImagesWithStaging
};
