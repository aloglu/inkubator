const { app, BrowserWindow, ipcMain, dialog, Menu, shell, globalShortcut } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs-extra');
const { normalizeAppData } = require('./lib/data-schema');
const { prepareImageInputForSharp } = require('./lib/image-import');
const {
  resolveReleaseVersion,
  getReleaseVersionState
} = require('./lib/release-version');
const {
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  disposeManagedImage,
  runSavePostCommitSteps,
  replaceImagesWithStaging
} = require('./lib/critical-persistence');
const packageInfo = require('./package.json');

let mainWindow;
const AUTO_BACKUP_DEFAULT_MAX_FILES = 30;
const AUTO_BACKUP_HARD_MAX_FILES = 365;
const AUTO_BACKUP_TICK_MS = 15 * 60 * 1000;
const APP_NAME = 'Inkubator';
const WINDOWS_APP_USER_MODEL_ID = 'com.inkubator.app';
const GPU_FALLBACK_ARG = '--inkubator-gpu-fallback';
const GPU_TOGGLE_SHORTCUT = 'CommandOrControl+Shift+F12';
const WINDOWS_WHITE_FRAME_CHECK_DELAY_MS = 2000;
const WINDOWS_WHITE_FRAME_THRESHOLD = 0.997;
let autoBackupIntervalHandle = null;
const GITHUB_REPO = 'aloglu/inkubator';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const REMOTE_FETCH_TIMEOUT_MS = 15000;
const isWindows = process.platform === 'win32';
const isGpuFallbackRun = process.argv.includes(GPU_FALLBACK_ARG);
let hasTriggeredWindowsGpuFallback = false;
const MANAGED_IMAGE_SUBDIRS = ['pens', 'inks', 'swatches'];

if (typeof app.setName === 'function') {
  app.setName(APP_NAME);
}
if (isWindows && typeof app.setAppUserModelId === 'function') {
  app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}
if (
  (
    isGpuFallbackRun
    || process.env.INKUBATOR_DISABLE_GPU === '1'
    || process.env.INKUBATOR_ALLOW_GPU === '0'
  )
  && typeof app.disableHardwareAcceleration === 'function'
) {
  // Optional override and one-shot recovery path for compositor issues.
  app.disableHardwareAcceleration();
}

function triggerWindowsGpuFallback(reason, error) {
  if (!isWindows) return false;
  if (isGpuFallbackRun) return false;
  if (process.env.INKUBATOR_DISABLE_GPU === '1' || process.env.INKUBATOR_ALLOW_GPU === '0') return false;
  if (hasTriggeredWindowsGpuFallback) return false;

  hasTriggeredWindowsGpuFallback = true;
  const detail = error && error.message ? ` (${error.message})` : '';
  console.warn(`Windows GPU fallback triggered: ${reason}${detail}`);
  const args = process.argv.slice(1).filter((arg) => arg !== GPU_FALLBACK_ARG);
  args.push(GPU_FALLBACK_ARG);
  app.relaunch({ args });
  app.exit(0);
  return true;
}

function relaunchWithGpuMode(enableGpu, reason = '') {
  const detail = reason ? `: ${reason}` : '';
  console.warn(`Relaunching with GPU ${enableGpu ? 'enabled' : 'disabled'}${detail}`);

  const args = process.argv.slice(1).filter((arg) => arg !== GPU_FALLBACK_ARG);
  if (!enableGpu) args.push(GPU_FALLBACK_ARG);
  app.relaunch({ args });
  app.exit(0);
  return true;
}

function registerGpuToggleShortcut() {
  if (!globalShortcut || typeof globalShortcut.register !== 'function') return;

  const registered = globalShortcut.register(GPU_TOGGLE_SHORTCUT, () => {
    const nextEnableGpu = isGpuFallbackRun;
    relaunchWithGpuMode(
      nextEnableGpu,
      `emergency shortcut ${GPU_TOGGLE_SHORTCUT}`
    );
  });

  if (!registered) {
    console.warn(`Failed to register emergency GPU toggle shortcut: ${GPU_TOGGLE_SHORTCUT}`);
  }
}

function isLikelyWhiteFrame(image) {
  if (!image || image.isEmpty()) return true;
  const size = image.getSize();
  if (!size || size.width < 2 || size.height < 2) return true;

  const bitmap = image.toBitmap();
  if (!bitmap || bitmap.length < 4) return true;

  // NativeImage bitmap is BGRA. Sample sparsely to keep startup overhead low.
  const pixelCount = size.width * size.height;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 30000));
  let whiteLike = 0;
  let sampled = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += sampleStep) {
    const offset = pixel * 4;
    const b = bitmap[offset];
    const g = bitmap[offset + 1];
    const r = bitmap[offset + 2];
    const a = bitmap[offset + 3];
    if (a >= 245 && r >= 245 && g >= 245 && b >= 245) {
      whiteLike += 1;
    }
    sampled += 1;
  }

  if (!sampled) return false;
  return (whiteLike / sampled) >= WINDOWS_WHITE_FRAME_THRESHOLD;
}
if (
  process.platform === 'linux'
  && process.env.INKUBATOR_DISABLE_XDG_PORTAL_FALLBACK !== '1'
  && app.commandLine
  && typeof app.commandLine.appendSwitch === 'function'
) {
  app.commandLine.appendSwitch('xdg-portal-required-version', '4');
}

function getBundledDataPath() {
  return path.join(__dirname, 'data.json');
}

function getBundledImagesPath() {
  return path.join(__dirname, 'images');
}

function getBundledRendererPath() {
  return path.join(__dirname, 'renderer');
}

function getBundledIconsPath() {
  return path.join(__dirname, 'assets', 'icons');
}

function getBundledFontsPath() {
  return path.join(__dirname, 'assets', 'fonts');
}

function getBundledWindowIconPath() {
  return path.join(__dirname, 'assets', 'icons', 'ink-drop-white-icon.png');
}

function getDataPath() {
  return path.join(app.getPath('userData'), 'data.json');
}

function getPreferencesPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function getImagesPath() {
  return path.join(app.getPath('userData'), 'images');
}

function getReplacedImagesArchivePath() {
  return path.join(app.getPath('userData'), 'replaced-images');
}

function getBackupPaths() {
  const root = path.join(app.getPath('userData'), 'backups');
  return {
    root,
    auto: path.join(root, 'auto'),
    manual: path.join(root, 'manual')
  };
}

function makeTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toNormalizedData(input) {
  return normalizeAppData(input && typeof input === 'object' ? input : {});
}

function toNormalizedPreferences(input) {
  return toNormalizedData({ preferences: input }).preferences;
}

function toCollectionData(input) {
  const normalized = toNormalizedData(input);
  const { preferences, ...collection } = normalized;
  return collection;
}

function combineCollectionWithPreferences(collectionData, preferences) {
  const collection = toCollectionData(collectionData);
  return {
    ...collection,
    preferences: toNormalizedPreferences(preferences)
  };
}

let currentPreferences = toNormalizedPreferences({});

async function loadPreferencesFromDisk() {
  const preferencesPath = getPreferencesPath();
  let raw = {};
  if (await fs.pathExists(preferencesPath)) {
    raw = await fs.readJson(preferencesPath).catch(() => ({}));
  }
  const normalized = toNormalizedPreferences(raw);
  currentPreferences = normalized;
  await fs.writeJson(preferencesPath, normalized, { spaces: 2 });
  return normalized;
}

async function savePreferencesToDisk(preferences) {
  const normalized = toNormalizedPreferences(preferences);
  currentPreferences = normalized;
  await fs.writeJson(getPreferencesPath(), normalized, { spaces: 2 });
  return normalized;
}

function getPreferences(data) {
  return (data && data.preferences && typeof data.preferences === 'object')
    ? data.preferences
    : currentPreferences;
}

function getImportExportSettings(data) {
  const prefs = getPreferences(data);
  const raw = (prefs.import_export && typeof prefs.import_export === 'object') ? prefs.import_export : {};
  const behavior = String(raw.conflict_behavior || 'overwrite').toLowerCase();
  return {
    auto_validate_import: typeof raw.auto_validate_import === 'boolean' ? raw.auto_validate_import : true,
    conflict_behavior: ['skip', 'overwrite', 'merge'].includes(behavior) ? behavior : 'overwrite',
    include_optional_metadata: typeof raw.include_optional_metadata === 'boolean' ? raw.include_optional_metadata : true
  };
}

function getBackupSettings(data) {
  const prefs = getPreferences(data);
  const raw = (prefs.backup && typeof prefs.backup === 'object') ? prefs.backup : {};
  const frequency = String(raw.auto_frequency || 'daily').toLowerCase();
  return {
    auto_frequency: ['off', 'daily', 'weekly', 'monthly'].includes(frequency) ? frequency : 'daily',
    retention_count: clampInt(raw.retention_count, 1, AUTO_BACKUP_HARD_MAX_FILES, AUTO_BACKUP_DEFAULT_MAX_FILES),
    include_images: typeof raw.include_images === 'boolean' ? raw.include_images : true,
    keep_replaced_images: typeof raw.keep_replaced_images === 'boolean' ? raw.keep_replaced_images : false
  };
}

function getBackupFrequencyMs(frequency) {
  if (frequency === 'daily') return 24 * 60 * 60 * 1000;
  if (frequency === 'weekly') return 7 * 24 * 60 * 60 * 1000;
  if (frequency === 'monthly') return 30 * 24 * 60 * 60 * 1000;
  return null;
}

function shouldValidateImportData(data) {
  if (!data || typeof data !== 'object') return false;
  return Array.isArray(data.pens)
    && Array.isArray(data.inks)
    && (!Object.prototype.hasOwnProperty.call(data, 'swatches') || Array.isArray(data.swatches))
    && Array.isArray(data.currently_inked)
    && Array.isArray(data.activity_log);
}

function sanitizeDataForExport(data, includeOptionalMetadata = true) {
  const normalized = toCollectionData(data);
  if (includeOptionalMetadata) return normalized;

  const cloned = JSON.parse(JSON.stringify(normalized));
  if (Array.isArray(cloned.activity_log)) {
    cloned.activity_log = cloned.activity_log.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const next = { ...entry };
      delete next.metadata;
      return next;
    });
  }
  return cloned;
}

async function ensureManagedImageTypeDirs(rootPath) {
  await Promise.all(
    MANAGED_IMAGE_SUBDIRS.map((dirName) => fs.ensureDir(path.join(rootPath, dirName)))
  );
}

async function writeCurrentImagesSnapshot(collectionData, destinationRoot) {
  const referencedImages = collectReferencedImageRelativePaths(collectionData);
  await fs.remove(destinationRoot);
  await fs.ensureDir(destinationRoot);
  await ensureManagedImageTypeDirs(destinationRoot);
  await copyReferencedImages({
    fs,
    sourceRoot: getImagesPath(),
    destinationRoot,
    relativePaths: referencedImages
  });
  return referencedImages;
}

async function writeReplacedImagesSnapshot(destinationRoot, includeArchivedImages) {
  await fs.remove(destinationRoot);
  if (!includeArchivedImages) {
    return false;
  }

  await fs.ensureDir(destinationRoot);
  await ensureManagedImageTypeDirs(destinationRoot);
  const archiveRoot = getReplacedImagesArchivePath();
  if (await fs.pathExists(archiveRoot)) {
    await fs.copy(archiveRoot, destinationRoot, {
      overwrite: true,
      errorOnExist: false
    });
  }
  return true;
}

function mergeById(existingArr = [], incomingArr = [], behavior = 'overwrite') {
  const existing = Array.isArray(existingArr) ? existingArr : [];
  const incoming = Array.isArray(incomingArr) ? incomingArr : [];
  const byId = new Map();

  existing.forEach((item) => {
    const key = item && item.id;
    if (typeof key === 'string' && key) byId.set(key, item);
  });

  if (behavior === 'skip') {
    const out = [...existing];
    const seen = new Set(existing.map(i => i && i.id).filter(Boolean));
    incoming.forEach((item) => {
      const key = item && item.id;
      if (typeof key === 'string' && key && !seen.has(key)) {
        out.push(item);
        seen.add(key);
      } else if (!key) {
        out.push(item);
      }
    });
    return out;
  }

  if (behavior === 'merge') {
    incoming.forEach((item) => {
      const key = item && item.id;
      if (typeof key === 'string' && key) {
        const prev = byId.get(key);
        if (prev && typeof prev === 'object' && typeof item === 'object') {
          byId.set(key, { ...prev, ...item });
        } else {
          byId.set(key, item);
        }
      }
    });
    const out = [];
    const inserted = new Set();
    existing.forEach((item) => {
      const key = item && item.id;
      if (typeof key === 'string' && key) {
        out.push(byId.get(key));
        inserted.add(key);
      } else {
        out.push(item);
      }
    });
    incoming.forEach((item) => {
      const key = item && item.id;
      if (typeof key === 'string' && key && !inserted.has(key)) {
        out.push(byId.get(key));
        inserted.add(key);
      } else if (!key) {
        out.push(item);
      }
    });
    return out;
  }

  // overwrite
  incoming.forEach((item) => {
    const key = item && item.id;
    if (typeof key === 'string' && key) byId.set(key, item);
  });
  const out = [];
  const inserted = new Set();
  existing.forEach((item) => {
    const key = item && item.id;
    if (typeof key === 'string' && key) {
      out.push(byId.get(key));
      inserted.add(key);
    } else {
      out.push(item);
    }
  });
  incoming.forEach((item) => {
    const key = item && item.id;
    if (typeof key === 'string' && key && !inserted.has(key)) {
      out.push(item);
      inserted.add(key);
    } else if (!key) {
      out.push(item);
    }
  });
  return out;
}

function dedupeCurrentlyInkedByPen(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const lastIndexByPenId = new Map();

  list.forEach((entry, index) => {
    const penId = (entry && typeof entry.pen_id === 'string') ? entry.pen_id : '';
    if (penId) lastIndexByPenId.set(penId, index);
  });

  return list.filter((entry, index) => {
    const penId = (entry && typeof entry.pen_id === 'string') ? entry.pen_id : '';
    if (!penId) return true;
    return lastIndexByPenId.get(penId) === index;
  });
}

async function ensureBackupDirs() {
  const paths = getBackupPaths();
  await fs.ensureDir(paths.auto);
  await fs.ensureDir(paths.manual);
  return paths;
}

async function listAutoBackupEntries() {
  const paths = await ensureBackupDirs();
  const entries = await fs.readdir(paths.auto);
  const stats = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(paths.auto, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) return null;
      return { name: entry, full, mtimeMs: stat.mtimeMs, isDirectory: stat.isDirectory() };
    })
  );
  const items = stats.filter(Boolean);
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items;
}

async function pruneAutoBackups(maxFiles = AUTO_BACKUP_DEFAULT_MAX_FILES) {
  const files = await listAutoBackupEntries();
  const limit = clampInt(maxFiles, 1, AUTO_BACKUP_HARD_MAX_FILES, AUTO_BACKUP_DEFAULT_MAX_FILES);
  const toDelete = files.slice(limit);
  await Promise.all(toDelete.map(f => fs.remove(f.full)));
}

async function getLatestAutoBackupEntry() {
  const files = await listAutoBackupEntries();
  return files[0] || null;
}

async function createAutoBackupSnapshot(data, reason = 'save', options = {}) {
  const normalizedCollection = toCollectionData(data);
  const normalizedPreferences = toNormalizedPreferences(getPreferences(data));
  const backupSettings = getBackupSettings({ preferences: normalizedPreferences });
  const frequencyMs = getBackupFrequencyMs(backupSettings.auto_frequency);
  const force = !!options.force;
  if (!force && !frequencyMs) {
    return null;
  }

  if (!force && frequencyMs) {
    const latest = await getLatestAutoBackupEntry();
    if (latest && (Date.now() - latest.mtimeMs) < frequencyMs) {
      return null;
    }
  }

  const paths = await ensureBackupDirs();
  const backupPath = path.join(paths.auto, `auto-${makeTimestamp()}`);
  const exportData = sanitizeDataForExport(normalizedCollection, true);
  const includeReplacedImages = !!backupSettings.keep_replaced_images;
  await fs.ensureDir(backupPath);
  await fs.writeJson(path.join(backupPath, 'data.json'), exportData, { spaces: 2 });
  await fs.writeJson(path.join(backupPath, 'preferences.json'), normalizedPreferences, { spaces: 2 });
  await writeCurrentImagesSnapshot(normalizedCollection, path.join(backupPath, 'images'));
  await writeReplacedImagesSnapshot(
    path.join(backupPath, 'replaced-images'),
    includeReplacedImages
  );
  await fs.writeJson(path.join(backupPath, 'manifest.json'), {
    type: 'inkubator-auto-backup',
    version: 3,
    created_at: new Date().toISOString(),
    reason,
    include_images: true,
    include_replaced_images: includeReplacedImages,
    include_preferences: true,
    include_optional_metadata: true,
    auto_frequency: backupSettings.auto_frequency,
    retention_count: backupSettings.retention_count,
    keep_replaced_images: includeReplacedImages
  }, { spaces: 2 });
  await pruneAutoBackups(backupSettings.retention_count);
  return backupPath;
}

async function enforceAutoBackupRetention(data) {
  const normalizedPreferences = toNormalizedPreferences(getPreferences(data));
  const backupSettings = getBackupSettings({ preferences: normalizedPreferences });
  await pruneAutoBackups(backupSettings.retention_count);
}

async function getAutoBackupStatus() {
  const files = await listAutoBackupEntries();
  const latest = files[0] || null;
  let latestManifest = null;
  if (latest && latest.isDirectory) {
    const manifestPath = path.join(latest.full, 'manifest.json');
    if (await fs.pathExists(manifestPath)) {
      latestManifest = await fs.readJson(manifestPath).catch(() => null);
    }
  }
  return {
    success: true,
    count: files.length,
    latest: latest ? {
      name: latest.name,
      path: latest.full,
      updated_at: new Date(latest.mtimeMs).toISOString(),
      include_images: latestManifest ? !!latestManifest.include_images : false,
      reason: latestManifest ? latestManifest.reason || '' : ''
    } : null
  };
}

async function runScheduledAutoBackupTick() {
  try {
    const dataPath = getDataPath();
    if (!(await fs.pathExists(dataPath))) return;
    const raw = await fs.readJson(dataPath);
    await createAutoBackupSnapshot(combineCollectionWithPreferences(raw, currentPreferences), 'scheduled');
  } catch (error) {
    console.error('Scheduled auto-backup tick failed:', error);
  }
}

function startAutoBackupScheduler() {
  if (autoBackupIntervalHandle) {
    clearInterval(autoBackupIntervalHandle);
  }
  autoBackupIntervalHandle = setInterval(() => {
    runScheduledAutoBackupTick().catch((error) => {
      console.error('Auto-backup interval failure:', error);
    });
  }, AUTO_BACKUP_TICK_MS);
}

async function createManualBackup(targetFolder) {
  await ensureAppStorage();
  const folder = path.join(targetFolder, `inkubator-backup-${makeTimestamp()}`);
  await fs.ensureDir(folder);
  const dataPath = getDataPath();
  const preferencesPath = getPreferencesPath();
  const imagesPath = getImagesPath();
  const backupDataPath = path.join(folder, 'data.json');
  const backupPreferencesPath = path.join(folder, 'preferences.json');
  const backupImagesPath = path.join(folder, 'images');
  const backupReplacedImagesPath = path.join(folder, 'replaced-images');
  const rawData = await fs.readJson(dataPath);
  const rawPreferences = (await fs.pathExists(preferencesPath))
    ? await fs.readJson(preferencesPath).catch(() => ({}))
    : currentPreferences;
  const normalizedCollection = toCollectionData(rawData);
  const exportData = sanitizeDataForExport(rawData, true);
  const exportPreferences = toNormalizedPreferences(rawPreferences);
  const backupSettings = getBackupSettings({ preferences: exportPreferences });
  const includeReplacedImages = !!backupSettings.keep_replaced_images;
  await fs.writeJson(backupDataPath, exportData, { spaces: 2 });
  await fs.writeJson(backupPreferencesPath, exportPreferences, { spaces: 2 });
  await writeCurrentImagesSnapshot(normalizedCollection, backupImagesPath);
  await writeReplacedImagesSnapshot(backupReplacedImagesPath, includeReplacedImages);
  await fs.writeJson(path.join(folder, 'manifest.json'), {
    type: 'inkubator-backup',
    version: 3,
    created_at: new Date().toISOString(),
    includes_images: true,
    includes_replaced_images: includeReplacedImages,
    includes_preferences: true,
    include_optional_metadata: true,
    keep_replaced_images: includeReplacedImages
  }, { spaces: 2 });
  return folder;
}

async function importManualBackup(backupFolder, options = {}) {
  await ensureAppStorage();
  const backupDataPath = path.join(backupFolder, 'data.json');
  const backupPreferencesPath = path.join(backupFolder, 'preferences.json');
  if (!(await fs.pathExists(backupDataPath))) {
    return { success: false, message: 'Selected folder is not a valid backup (missing data.json).' };
  }
  if (!(await fs.pathExists(backupPreferencesPath))) {
    return { success: false, message: 'Selected folder is not a valid backup (missing preferences.json).' };
  }

  const incomingRaw = await fs.readJson(backupDataPath);
  const incomingPreferencesRaw = await fs.readJson(backupPreferencesPath).catch(() => ({}));
  const incomingNormalized = toCollectionData(incomingRaw);
  const incomingPreferences = toNormalizedPreferences(incomingPreferencesRaw);
  const currentData = await readNormalizedDataIfExists(getDataPath()) || toCollectionData({});
  const importSettings = getImportExportSettings({ preferences: currentPreferences });
  const conflictBehavior = options.conflict_behavior || importSettings.conflict_behavior || 'overwrite';
  const validateImport = typeof options.auto_validate_import === 'boolean'
    ? options.auto_validate_import
    : importSettings.auto_validate_import;

  if (validateImport && !shouldValidateImportData(incomingRaw)) {
    return { success: false, message: 'Import validation failed: invalid data shape.' };
  }

  let merged;
  if (conflictBehavior === 'overwrite') {
    merged = incomingNormalized;
  } else {
    const mergedCurrentlyInked = dedupeCurrentlyInkedByPen(
      mergeById(currentData.currently_inked, incomingNormalized.currently_inked, conflictBehavior)
    );
    merged = toCollectionData({
      ...toCollectionData(currentData),
      pens: mergeById(currentData.pens, incomingNormalized.pens, conflictBehavior),
      inks: mergeById(currentData.inks, incomingNormalized.inks, conflictBehavior),
      swatches: mergeById(currentData.swatches, incomingNormalized.swatches, conflictBehavior),
      currently_inked: mergedCurrentlyInked,
      activity_log: mergeById(currentData.activity_log, incomingNormalized.activity_log, conflictBehavior)
    });
  }

  merged = toCollectionData({
    ...merged,
    currently_inked: dedupeCurrentlyInkedByPen(merged.currently_inked)
  });

  // Safety snapshot before restore.
  if (await fs.pathExists(getDataPath())) {
    const existing = await fs.readJson(getDataPath());
    await createAutoBackupSnapshot(existing, 'pre-import-restore', { force: true });
  }

  let committedData = false;
  await fs.writeJson(getDataPath(), merged, { spaces: 2 });
  committedData = true;

  try {
    await savePreferencesToDisk(incomingPreferences);

    const backupImagesPath = path.join(backupFolder, 'images');
    if (await fs.pathExists(backupImagesPath)) {
      if (conflictBehavior === 'overwrite') {
        await replaceImagesWithStaging({
          fs,
          backupImagesPath,
          imagesPath: getImagesPath(),
          tempRoot: app.getPath('userData')
        });
      } else if (conflictBehavior === 'skip') {
        await fs.copy(backupImagesPath, getImagesPath(), { overwrite: false, errorOnExist: false });
      } else {
        await fs.copy(backupImagesPath, getImagesPath(), { overwrite: true });
      }
    }

    const backupReplacedImagesPath = path.join(backupFolder, 'replaced-images');
    const replacedImagesPath = getReplacedImagesArchivePath();
    if (await fs.pathExists(backupReplacedImagesPath)) {
      if (conflictBehavior === 'overwrite') {
        await replaceImagesWithStaging({
          fs,
          backupImagesPath: backupReplacedImagesPath,
          imagesPath: replacedImagesPath,
          tempRoot: app.getPath('userData')
        });
      } else if (conflictBehavior === 'skip') {
        await fs.copy(backupReplacedImagesPath, replacedImagesPath, { overwrite: false, errorOnExist: false });
      } else {
        await fs.copy(backupReplacedImagesPath, replacedImagesPath, { overwrite: true });
      }
    } else if (conflictBehavior === 'overwrite' && await fs.pathExists(replacedImagesPath)) {
      await fs.remove(replacedImagesPath);
    }

    await ensureManagedImageTypeDirs(getImagesPath());

    const combined = combineCollectionWithPreferences(merged, incomingPreferences);
    await createAutoBackupSnapshot(combined, 'post-import-restore', { force: true });
    return { success: true, data: combined };
  } catch (postCommitError) {
    if (!committedData) throw postCommitError;
    const combined = combineCollectionWithPreferences(merged, currentPreferences);
    return {
      success: true,
      data: combined,
      warning: true,
      message: `Import applied, but a post-import step failed: ${postCommitError.message}`
    };
  }
}

async function exportShowcaseBundle(targetFolder) {
  await ensureAppStorage();

  const showcaseRoot = path.join(targetFolder, 'showcase');
  const bundledRoot = __dirname;
  const dataPath = getDataPath();
  const rendererPath = getBundledRendererPath();
  const iconsPath = getBundledIconsPath();
  const fontsPath = getBundledFontsPath();

  await fs.ensureDir(showcaseRoot);

  const fileCopies = [
    ['index.html', 'index.html'],
    ['style.css', 'style.css'],
    ['renderer.js', 'renderer.js']
  ];

  for (const [srcName, dstName] of fileCopies) {
    await fs.copy(path.join(bundledRoot, srcName), path.join(showcaseRoot, dstName), {
      overwrite: true,
      errorOnExist: false
    });
  }

  if (await fs.pathExists(rendererPath)) {
    await fs.copy(rendererPath, path.join(showcaseRoot, 'renderer'), {
      overwrite: true,
      errorOnExist: false
    });
  }

  if (await fs.pathExists(iconsPath)) {
    await fs.copy(iconsPath, path.join(showcaseRoot, 'assets', 'icons'), {
      overwrite: true,
      errorOnExist: false
    });
  }

  if (await fs.pathExists(fontsPath)) {
    await fs.copy(fontsPath, path.join(showcaseRoot, 'assets', 'fonts'), {
      overwrite: true,
      errorOnExist: false
    });
  }

  let showcaseData;
  if (await fs.pathExists(dataPath)) {
    const raw = await fs.readJson(dataPath);
    const normalized = toCollectionData(raw);
    const exportSettings = getImportExportSettings({ preferences: currentPreferences });
    const sanitizedCollection = sanitizeDataForExport(normalized, exportSettings.include_optional_metadata);
    showcaseData = combineCollectionWithPreferences(sanitizedCollection, currentPreferences);
  } else {
    showcaseData = combineCollectionWithPreferences(
      toCollectionData({ pens: [], inks: [], currently_inked: [] }),
      currentPreferences
    );
  }

  await fs.writeJson(path.join(showcaseRoot, 'data.json'), showcaseData, { spaces: 2 });
  await fs.writeFile(
    path.join(showcaseRoot, 'data.js'),
    `window.__INKUBATOR_DATA__ = ${JSON.stringify(showcaseData)};\n`,
    'utf8'
  );

  await writeCurrentImagesSnapshot(showcaseData, path.join(showcaseRoot, 'images'));

  const showcaseIndexPath = path.join(showcaseRoot, 'index.html');
  if (await fs.pathExists(showcaseIndexPath)) {
    let html = await fs.readFile(showcaseIndexPath, 'utf8');
    if (!html.includes('src="data.js"')) {
      html = html.replace(
        '<script src="renderer.js"></script>',
        '    <script src="data.js"></script>\n    <script src="renderer.js"></script>'
      );
    }
    await fs.writeFile(showcaseIndexPath, html, 'utf8');

    // Route entry files for static hosts without rewrite rules:
    // /inks, /pens, /swatches, etc. resolve to their own index.html and still load shared assets.
    const routeNames = ['dashboard', 'pens', 'inks', 'swatches', 'stats', 'activity', 'settings'];
    const headMatch = html.match(/<head[^>]*>/i);
    const routeHtml = headMatch
      ? html.replace(headMatch[0], `${headMatch[0]}\n    <base href="../">`)
      : html;
    for (const routeName of routeNames) {
      const routeDir = path.join(showcaseRoot, routeName);
      await fs.ensureDir(routeDir);
      await fs.writeFile(path.join(routeDir, 'index.html'), routeHtml, 'utf8');
    }
  }

  return showcaseRoot;
}

async function migratePenImageNames(data) {
  const normalized = toCollectionData(data);
  const pens = Array.isArray(normalized.pens) ? normalized.pens : [];
  const imagesRoot = getImagesPath();
  let changed = false;

  for (const pen of pens) {
    if (!pen || typeof pen !== 'object') continue;
    const image = pen.image;
    if (!image || image === 'default_pen.png' || image.startsWith('data:')) continue;
    if (typeof image !== 'string' || !image.startsWith('pens/')) continue;

    const sourcePath = path.join(imagesRoot, image);
    if (!(await fs.pathExists(sourcePath))) continue;

    const targetName = buildPenFilename({
      brand: pen.brand,
      model: pen.model,
      nib: pen.nib,
      color: pen.color,
      hex_color: pen.hex_color,
      hex_colors: pen.hex_colors
    });
    const targetStem = buildPenFilenameStem({
      brand: pen.brand,
      model: pen.model,
      nib: pen.nib,
      color: pen.color,
      hex_color: pen.hex_color,
      hex_colors: pen.hex_colors
    });
    const alreadyNumbered = new RegExp(`^pens/${escapeRegExp(targetStem)}-\\d+\\.webp$`, 'i');
    if (alreadyNumbered.test(image)) continue;
    const targetRel = `pens/${targetName}`;
    if (targetRel === image) continue;

    await fs.ensureDir(path.dirname(sourcePath));
    let targetPath = path.join(imagesRoot, targetRel);
    targetPath = await resolveUniquePath(targetPath);
    if (targetPath !== sourcePath) {
      await fs.move(sourcePath, targetPath, { overwrite: false });
      pen.image = path.relative(imagesRoot, targetPath).replace(/\\/g, '/');
      changed = true;
    }
  }

  return { data: normalized, changed };
}

function getCollectionEntityCount(data = {}) {
  const pens = Array.isArray(data.pens) ? data.pens.length : 0;
  const inks = Array.isArray(data.inks) ? data.inks.length : 0;
  const swatches = Array.isArray(data.swatches) ? data.swatches.length : 0;
  const currentlyInked = Array.isArray(data.currently_inked) ? data.currently_inked.length : 0;
  return pens + inks + swatches + currentlyInked;
}

async function readNormalizedDataIfExists(filePath) {
  if (!(await fs.pathExists(filePath))) return null;
  try {
    const raw = await fs.readJson(filePath);
    return toCollectionData(raw);
  } catch (error) {
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getBundledWindowIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  let startupWatchdog = null;
  if (isWindows && !isGpuFallbackRun) {
    startupWatchdog = setTimeout(() => {
      triggerWindowsGpuFallback('window failed to become ready in time');
    }, 15000);
  }

  mainWindow.once('ready-to-show', () => {
    if (startupWatchdog) {
      clearTimeout(startupWatchdog);
      startupWatchdog = null;
    }
  });

  mainWindow.on('unresponsive', () => {
    triggerWindowsGpuFallback('window became unresponsive');
  });

  mainWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
    if (isMainFrame) {
      triggerWindowsGpuFallback(`main frame failed to load (${errorCode}: ${errorDescription || 'unknown'})`);
    }
  });

  mainWindow.webContents.once('render-process-gone', (_event, details) => {
    triggerWindowsGpuFallback(`renderer process exited (${details.reason || 'unknown'})`);
  });

  if (isWindows && !isGpuFallbackRun) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        try {
          const screenshot = await mainWindow.capturePage();
          if (isLikelyWhiteFrame(screenshot)) {
            triggerWindowsGpuFallback('captured a likely white compositor frame after load');
          }
        } catch (error) {
          triggerWindowsGpuFallback('white-frame probe failed', error);
        }
      }, WINDOWS_WHITE_FRAME_CHECK_DELAY_MS);
    });
  }

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

async function ensureAppStorage() {
  const dataPath = getDataPath();
  const preferencesPath = getPreferencesPath();
  const imagesPath = getImagesPath();
  const bundledDataPath = getBundledDataPath();
  const bundledImagesPath = getBundledImagesPath();
  const bundledData = await readNormalizedDataIfExists(bundledDataPath);
  const bundledCount = getCollectionEntityCount(bundledData || {});

  await fs.ensureDir(path.dirname(dataPath));
  if (!(await fs.pathExists(dataPath))) {
    if (bundledData) {
      await fs.writeJson(dataPath, bundledData, { spaces: 2 });
    } else {
      const initialData = toCollectionData({ pens: [], inks: [], currently_inked: [] });
      await fs.writeJson(dataPath, initialData, { spaces: 2 });
    }
  } else if (!app.isPackaged && bundledData && bundledCount > 0) {
    const currentData = await readNormalizedDataIfExists(dataPath);
    const currentCount = getCollectionEntityCount(currentData || {});
    if (currentCount === 0) {
      await fs.writeJson(dataPath, bundledData, { spaces: 2 });
    }
  }

  if (!(await fs.pathExists(preferencesPath))) {
    await fs.writeJson(preferencesPath, currentPreferences, { spaces: 2 });
  }
  await loadPreferencesFromDisk();

  if (!(await fs.pathExists(imagesPath))) {
    if (await fs.pathExists(bundledImagesPath)) {
      await fs.copy(bundledImagesPath, imagesPath, { overwrite: false, errorOnExist: false });
    } else {
      await fs.ensureDir(imagesPath);
    }
  } else if (!app.isPackaged && await fs.pathExists(bundledImagesPath)) {
    await fs.copy(bundledImagesPath, imagesPath, { overwrite: false, errorOnExist: false });
  }

  await Promise.all([
    fs.ensureDir(path.join(imagesPath, 'pens')),
    fs.ensureDir(path.join(imagesPath, 'inks')),
    fs.ensureDir(path.join(imagesPath, 'swatches'))
  ]);
}

app.whenReady().then(async () => {
  await ensureAppStorage().catch((error) => {
    console.error("Failed to initialize app storage:", error);
  });
  ensureBackupDirs().catch((error) => {
    console.error("Failed to initialize backup directories:", error);
  });
  readNormalizedDataIfExists(getDataPath())
    .then((data) => {
      if (data) return enforceAutoBackupRetention(data);
      return null;
    })
    .catch((error) => {
      console.error("Failed to enforce backup retention at startup:", error);
    });
  startAutoBackupScheduler();
  runScheduledAutoBackupTick().catch((error) => {
    console.error("Initial scheduled auto-backup failed:", error);
  });
  registerGpuToggleShortcut();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('child-process-gone', (_event, details) => {
  if (!details || details.type !== 'GPU') return;
  triggerWindowsGpuFallback(`GPU process exited (${details.reason || 'unknown'})`);
});

app.on('window-all-closed', () => {
  if (autoBackupIntervalHandle) {
    clearInterval(autoBackupIntervalHandle);
    autoBackupIntervalHandle = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (globalShortcut && typeof globalShortcut.unregisterAll === 'function') {
    globalShortcut.unregisterAll();
  }
});


// Helper to slugify strings for filenames
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')  // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePenColorForFilename(metadata = {}) {
  const colorText = typeof metadata.color === 'string' ? metadata.color.split(',')[0].trim() : '';
  const fromColor = slugify(colorText || '');
  if (fromColor) return fromColor;

  const hexColors = Array.isArray(metadata.hex_colors) ? metadata.hex_colors : [];
  const firstHex = typeof hexColors[0] === 'string' ? hexColors[0].replace('#', '') : '';
  if (firstHex) return slugify(firstHex);

  const hexColor = typeof metadata.hex_color === 'string' ? metadata.hex_color.replace('#', '') : '';
  if (hexColor) return slugify(hexColor);

  return 'standard';
}

function buildPenFilenameStem(metadata = {}) {
  const brand = slugify(metadata.brand || 'unknown');
  const model = slugify(metadata.model || 'pen');
  const nib = slugify(metadata.nib || 'standard');
  const color = normalizePenColorForFilename(metadata);
  return `${brand}-${model}-${nib}-${color}`;
}

function buildPenFilename(metadata = {}, sequence = 1) {
  const stem = buildPenFilenameStem(metadata);
  const safeSequence = Number.isFinite(sequence) && sequence > 0 ? Math.floor(sequence) : 1;
  return `${stem}-${safeSequence}.webp`;
}

async function buildNextPenFilename(imagesDir, metadata = {}) {
  const stem = buildPenFilenameStem(metadata);
  const regex = new RegExp(`^${escapeRegExp(stem)}-(\\d+)\\.webp$`, 'i');
  const files = await fs.readdir(imagesDir);
  const used = new Set();

  files.forEach((file) => {
    const match = file.match(regex);
    if (!match) return;
    const n = parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) used.add(n);
  });

  let next = used.size + 1;
  while (used.has(next)) {
    next += 1;
  }
  return buildPenFilename(metadata, next);
}

function buildInkFilename(metadata = {}) {
  const brand = slugify(metadata.brand || 'unknown');
  const model = slugify(metadata.model || 'ink');
  return `${brand}-${model}.webp`;
}

function buildUniqueSwatchFilename(metadata = {}) {
  const brand = slugify(metadata.brand || 'unknown');
  const model = slugify(metadata.model || 'swatch');
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${brand}-${model}-${stamp}-${rand}.webp`;
}

async function buildNextInkFilename(imagesDir, metadata = {}) {
  const baseFilename = buildInkFilename(metadata);
  const parsed = path.parse(baseFilename);
  let candidate = path.join(imagesDir, baseFilename);
  if (!(await fs.pathExists(candidate))) {
    return baseFilename;
  }

  let i = 2;
  while (true) {
    const numberedName = `${parsed.name}-${i}${parsed.ext}`;
    candidate = path.join(imagesDir, numberedName);
    if (!(await fs.pathExists(candidate))) {
      return numberedName;
    }
    i += 1;
  }
}

async function resolveUniquePath(destPath) {
  if (!(await fs.pathExists(destPath))) return destPath;

  const parsed = path.parse(destPath);
  let i = 2;
  while (true) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!(await fs.pathExists(candidate))) return candidate;
    i += 1;
  }
}

function normalizeRelativeImagePath(inputPath = '') {
  if (typeof inputPath !== 'string') return '';
  let value = inputPath.trim();
  if (!value) return '';

  if (value.startsWith('file://')) {
    try {
      value = decodeURIComponent(value.replace('file://', ''));
    } catch (_) {
      value = value.replace('file://', '');
    }
  }

  value = value.replace(/\\/g, '/');
  value = value.replace(/^\.\/+/, '');
  value = value.replace(/^\/+/, '');
  if (value.startsWith('images/')) {
    value = value.slice('images/'.length);
  }
  return value;
}

function isPathInside(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REMOTE_FETCH_TIMEOUT_MS) {
  const timeout = Number(timeoutMs);
  const safeTimeout = Number.isFinite(timeout) && timeout > 0 ? timeout : REMOTE_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeoutSeconds = Math.round(safeTimeout / 1000);
      throw new Error(`Request timed out after ${timeoutSeconds} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------
//  File System Handlers (The "Manager" Logic)
// ----------------------------------------------------------------

let sharpModule = null;
let heicConvertModule = null;
let ort = null;
let penModelSessionPromise = null;

function getSharpOrThrow() {
  if (sharpModule) return sharpModule;
  try {
    sharpModule = require('sharp');
    return sharpModule;
  } catch (error) {
    const message = [
      'Image processing module "sharp" is unavailable in this build.',
      'Build Linux artifacts on Linux with optional dependencies included.',
      `Original error: ${error && error.message ? error.message : String(error)}`
    ].join(' ');
    const wrapped = new Error(message);
    wrapped.code = 'SHARP_UNAVAILABLE';
    wrapped.cause = error;
    throw wrapped;
  }
}

function getHeicConvertOrThrow() {
  if (heicConvertModule) return heicConvertModule;
  try {
    heicConvertModule = require('heic-convert');
    return heicConvertModule;
  } catch (error) {
    const message = [
      'HEIC/HEIF conversion module "heic-convert" is unavailable in this build.',
      `Original error: ${error && error.message ? error.message : String(error)}`
    ].join(' ');
    const wrapped = new Error(message);
    wrapped.code = 'HEIC_CONVERT_UNAVAILABLE';
    wrapped.cause = error;
    throw wrapped;
  }
}

async function convertHeicBufferForSharp(inputBuffer) {
  const heicConvert = getHeicConvertOrThrow();
  return await heicConvert({
    buffer: inputBuffer,
    format: 'PNG'
  });
}

async function getLocalImagePreviewUrl(sourcePath) {
  if (!sourcePath) {
    throw new Error('Missing source path.');
  }

  const sharpInput = await prepareImageInputForSharp({
    input: sourcePath,
    fs,
    sourcePath,
    convertHeicBuffer: convertHeicBufferForSharp
  });

  if (!Buffer.isBuffer(sharpInput)) {
    return pathToFileURL(sourcePath).href;
  }

  const sharp = getSharpOrThrow();
  const previewBuffer = await sharp(sharpInput)
    .resize({ width: 1200, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer();

  return `data:image/webp;base64,${previewBuffer.toString('base64')}`;
}

async function getOrtModule() {
  if (!ort) {
    ort = require('onnxruntime-node');
  }
  return ort;
}

async function getPenModelSession() {
  if (penModelSessionPromise) return penModelSessionPromise;

  penModelSessionPromise = (async () => {
    const ortLib = await getOrtModule();
    const modelPath = path.join(__dirname, 'assets', 'models', 'u2netp.onnx');
    if (!(await fs.pathExists(modelPath))) {
      throw new Error(`Missing local ML model at ${modelPath}`);
    }
    return await ortLib.InferenceSession.create(modelPath, {
      executionProviders: ['cpu']
    });
  })();

  return penModelSessionPromise;
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => {
    const x = Math.max(0, Math.min(255, Math.round(v)));
    const hex = x.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  }).join('')}`;
}

function normalizeMask(maskData) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < maskData.length; i += 1) {
    const v = maskData[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1e-6, max - min);
  const out = new Float32Array(maskData.length);
  for (let i = 0; i < maskData.length; i += 1) {
    out[i] = (maskData[i] - min) / range;
  }
  return out;
}

function pickPenLikeComponent(binaryMask, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const components = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!binaryMask[start] || visited[start]) continue;

      let qh = 0;
      let qt = 0;
      queue[qt++] = start;
      visited[start] = 1;

      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0;
      const points = [];

      while (qh < qt) {
        const p = queue[qh++];
        const px = p % width;
        const py = (p / width) | 0;
        area += 1;
        sumX += px;
        sumY += py;
        points.push(p);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        for (const [dx, dy] of neighbors) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!binaryMask[np] || visited[np]) continue;
          visited[np] = 1;
          queue[qt++] = np;
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const major = Math.max(bw, bh);
      const minor = Math.max(1, Math.min(bw, bh));
      const elongation = major / minor;
      const fillRatio = area / Math.max(1, bw * bh);
      const areaNorm = area / total;
      const minorNorm = minor / Math.min(width, height);
      const cx = sumX / area;
      const cy = sumY / area;
      const centerDist = Math.hypot(cx - width / 2, cy - height / 2);
      const centerNorm = centerDist / Math.hypot(width / 2, height / 2);
      const centerScore = Math.max(0, 1 - centerNorm);

      const areaScore = Math.exp(-Math.pow((areaNorm - 0.08) / 0.12, 2));
      const thickPenalty = Math.exp(-Math.pow((minorNorm - 0.14) / 0.12, 2));
      const fillPenalty = Math.exp(-Math.pow((fillRatio - 0.42) / 0.34, 2));
      const elongScore = Math.min(3.8, Math.max(1, elongation));
      const score = centerScore * areaScore * thickPenalty * fillPenalty * elongScore;

      components.push({ score, points, areaNorm });
    }
  }

  if (components.length === 0) return null;
  components.sort((a, b) => b.score - a.score);
  let chosen = components.find(c => c.areaNorm > 0.01 && c.areaNorm < 0.5);
  if (!chosen) chosen = components[0];
  return chosen && chosen.points.length >= 30 ? chosen : null;
}

function extractColorsFromPoints(rgb, points, width) {
  const colorMap = Object.create(null);
  const q = 16;
  let dominant = null;
  let maxWeight = 0;

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const base = p * 3;
    const r = rgb[base];
    const g = rgb[base + 1];
    const b = rgb[base + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const weight = 0.8 + sat * 1.4;

    const rQ = Math.round(r / q) * q;
    const gQ = Math.round(g / q) * q;
    const bQ = Math.round(b / q) * q;
    const key = `${rQ},${gQ},${bQ}`;
    const c = (colorMap[key] || 0) + weight;
    colorMap[key] = c;
    if (c > maxWeight) {
      maxWeight = c;
      dominant = { r: rQ, g: gQ, b: bQ };
    }
  }
  if (!dominant) return null;

  const entries = Object.keys(colorMap).map((key) => {
    const [r, g, b] = key.split(',').map(Number);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return { r, g, b, sat, count: colorMap[key] };
  }).sort((a, b) => b.count - a.count);

  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  let accent = entries.find(e => dist(e, dominant) > 30 && e.sat > 0.1);
  if (!accent) accent = entries.find(e => dist(e, dominant) > 24);
  if (!accent) {
    accent = {
      r: Math.max(0, Math.round(dominant.r * 0.72)),
      g: Math.max(0, Math.round(dominant.g * 0.72)),
      b: Math.max(0, Math.round(dominant.b * 0.72))
    };
  }

  const palette = entries
    .filter(e => e.sat > 0.06)
    .slice(0, 4)
    .map(e => rgbToHex(e.r, e.g, e.b));

  const baseHex = rgbToHex(dominant.r, dominant.g, dominant.b);
  const accentHex = rgbToHex(accent.r, accent.g, accent.b);
  if (!palette.includes(baseHex)) palette.unshift(baseHex);
  if (!palette.includes(accentHex)) palette.push(accentHex);

  return {
    base: baseHex,
    accent: accentHex,
    palette: palette.slice(0, 4)
  };
}

function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function isolatePenCorePoints(points, width, height) {
  if (!Array.isArray(points) || points.length < 30) return points || [];

  let sumX = 0;
  let sumY = 0;
  const coords = new Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const x = p % width;
    const y = (p / width) | 0;
    coords[i] = { p, x, y };
    sumX += x;
    sumY += y;
  }
  const cx = sumX / points.length;
  const cy = sumY / points.length;

  let cxx = 0;
  let cxy = 0;
  let cyy = 0;
  for (let i = 0; i < coords.length; i += 1) {
    const dx = coords[i].x - cx;
    const dy = coords[i].y - cy;
    cxx += dx * dx;
    cxy += dx * dy;
    cyy += dy * dy;
  }
  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.max(0, trace * trace - 4 * det);
  const lambda1 = (trace + Math.sqrt(disc)) / 2;

  let ux = cxy;
  let uy = lambda1 - cxx;
  if (Math.abs(ux) + Math.abs(uy) < 1e-6) {
    ux = 1;
    uy = 0;
  }
  const un = Math.hypot(ux, uy) || 1;
  ux /= un;
  uy /= un;
  const vx = -uy;
  const vy = ux;

  const projections = new Array(coords.length);
  const minorAbs = new Array(coords.length);
  let tMin = Infinity;
  let tMax = -Infinity;
  for (let i = 0; i < coords.length; i += 1) {
    const dx = coords[i].x - cx;
    const dy = coords[i].y - cy;
    const t = dx * ux + dy * uy; // along major axis
    const s = dx * vx + dy * vy; // orthogonal distance
    projections[i] = { t, s, p: coords[i].p };
    const absS = Math.abs(s);
    minorAbs[i] = absS;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }

  const range = Math.max(1, tMax - tMin);
  const centerBand = Math.max(2, percentile(minorAbs, 0.25));
  const overhangBand = centerBand * 1.25;
  const tailFrac = 0.18;
  const lowTail = tMin + range * tailFrac;
  const highTail = tMax - range * tailFrac;

  const core = [];
  const tails = [];
  for (let i = 0; i < projections.length; i += 1) {
    const { t, s, p } = projections[i];
    const absS = Math.abs(s);
    if (absS <= centerBand) {
      core.push(p);
      if (t <= lowTail || t >= highTail) {
        tails.push(p);
      }
    } else if ((t <= lowTail || t >= highTail) && absS <= overhangBand) {
      tails.push(p);
    }
  }

  // Prefer pen-like narrow core + overhangs when enough support exists.
  const minCore = Math.max(24, Math.floor(points.length * 0.08));
  if (core.length >= minCore) {
    const merged = tails.length > 8 ? [...new Set([...core, ...tails])] : core;
    return merged.length >= minCore ? merged : core;
  }

  return points;
}

async function detectPenColorsWithML(sourcePath) {
  const sharp = getSharpOrThrow();
  const modelSize = 320;
  const sharpInput = await prepareImageInputForSharp({
    input: sourcePath,
    fs,
    sourcePath,
    convertHeicBuffer: convertHeicBufferForSharp
  });
  const { data: rgbBuffer } = await sharp(sharpInput)
    .removeAlpha()
    .resize(modelSize, modelSize, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgb = new Uint8Array(rgbBuffer);
  const chw = new Float32Array(1 * 3 * modelSize * modelSize);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let i = 0; i < modelSize * modelSize; i += 1) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    chw[i] = (r - mean[0]) / std[0];
    chw[modelSize * modelSize + i] = (g - mean[1]) / std[1];
    chw[2 * modelSize * modelSize + i] = (b - mean[2]) / std[2];
  }

  const session = await getPenModelSession();
  const ortLib = await getOrtModule();
  const inputName = session.inputNames[0];
  const feeds = {};
  feeds[inputName] = new ortLib.Tensor('float32', chw, [1, 3, modelSize, modelSize]);
  const output = await session.run(feeds);
  const outName = session.outputNames[0];
  const outTensor = output[outName];
  if (!outTensor || !outTensor.data) return null;

  const normMask = normalizeMask(outTensor.data);
  const binary = new Uint8Array(normMask.length);
  for (let i = 0; i < normMask.length; i += 1) {
    binary[i] = normMask[i] > 0.45 ? 1 : 0;
  }

  const chosen = pickPenLikeComponent(binary, modelSize, modelSize);
  if (!chosen) return null;
  const penCorePoints = isolatePenCorePoints(chosen.points, modelSize, modelSize);
  return extractColorsFromPoints(rgb, penCorePoints, modelSize);
}

// 1. Load Data
ipcMain.handle('load-data', async () => {
  try {
    await ensureAppStorage();
    const dataPath = getDataPath();
    const preferences = await loadPreferencesFromDisk();
    if (!(await fs.pathExists(dataPath))) {
      // Create empty if missing
      const initialData = toCollectionData({ pens: [], inks: [], currently_inked: [] });
      await fs.writeJson(dataPath, initialData, { spaces: 2 });
      return combineCollectionWithPreferences(initialData, preferences);
    }
    const raw = await fs.readJson(dataPath);
    const migrated = await migratePenImageNames(raw);
    if (migrated.changed) {
      await fs.writeJson(dataPath, toCollectionData(migrated.data), { spaces: 2 });
    }
    return combineCollectionWithPreferences(migrated.data, preferences);
  } catch (err) {
    console.error("Error reading data:", err);
    return null;
  }
});

// 2. Save Data
ipcMain.handle('save-data', async (event, newData) => {
  try {
    await ensureAppStorage();
    const dataPath = getDataPath();
    const normalizedData = toCollectionData(newData);
    const requestedPreferences = toNormalizedPreferences(getPreferences(newData));
    const combined = combineCollectionWithPreferences(normalizedData, requestedPreferences);
    let committed = false;
    await fs.writeJson(dataPath, normalizedData, { spaces: 2 });
    committed = true;
    return await runSavePostCommitSteps({
      committed,
      requestedPreferences,
      combined,
      savePreferencesToDisk,
      enforceAutoBackupRetention,
      createAutoBackupSnapshot
    });
  } catch (err) {
    console.error("Error saving data:", err);
    return { success: false, error: err.message };
  }
});

// 3. Save Image (Copies, resizes, and converts to WebP)
ipcMain.handle('save-image', async (event, sourcePath, type, metadata) => {
  if (!sourcePath) return null;
  try {
    const sharp = getSharpOrThrow();
    const typeFolder = (type === 'pen') ? 'pens' : (type === 'ink' ? 'inks' : 'swatches');
    const imagesDir = path.join(getImagesPath(), typeFolder);
    await fs.ensureDir(imagesDir);

    let filename = '';
    if (type === 'pen') {
      filename = await buildNextPenFilename(imagesDir, metadata);
    } else if (type === 'swatch') {
      filename = buildUniqueSwatchFilename(metadata);
    } else {
      filename = await buildNextInkFilename(imagesDir, metadata);
    }

    const destPath = path.join(imagesDir, filename);
    const sharpInput = await prepareImageInputForSharp({
      input: sourcePath,
      fs,
      sourcePath,
      convertHeicBuffer: convertHeicBufferForSharp
    });

    // Process with Sharp: Resize max-width 1200px and convert to WebP
    await sharp(sharpInput)
      .resize({ width: 1200, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80 })
      .toFile(destPath);

    return `${typeFolder}/${filename}`; // Return relative path from /images
  } catch (err) {
    console.error("Error saving image:", err);
    return null;
  }
});

// 4. Delete Image
ipcMain.handle('delete-image', async (event, relativePath) => {
  if (!relativePath || (typeof relativePath === 'string' && relativePath.includes('default_'))) {
    return { success: true };
  }
  try {
    const imagesRoot = getImagesPath();
    const normalized = normalizeRelativeImagePath(relativePath);
    if (!normalized) return { success: true };

    const deletionCandidates = new Set();

    // Standard case: relative path under images root.
    deletionCandidates.add(path.join(imagesRoot, normalized));

    // Legacy case: bare filename with unknown folder.
    if (!normalized.includes('/')) {
      deletionCandidates.add(path.join(imagesRoot, 'pens', normalized));
      deletionCandidates.add(path.join(imagesRoot, 'inks', normalized));
      deletionCandidates.add(path.join(imagesRoot, 'swatches', normalized));
    }

    // Absolute path case (only if inside images root).
    if (path.isAbsolute(relativePath)) {
      const absPath = path.normalize(relativePath);
      if (isPathInside(imagesRoot, absPath)) {
        deletionCandidates.add(absPath);
      }
    }

    for (const candidate of deletionCandidates) {
      const normalizedCandidate = path.normalize(candidate);
      if (!isPathInside(imagesRoot, normalizedCandidate)) continue;
      if (await fs.pathExists(normalizedCandidate)) {
        await fs.remove(normalizedCandidate);
      }
    }
    return { success: true };
  } catch (err) {
    console.error("Error deleting image:", err);
    return { success: false, error: err.message };
  }
});

// 5. Open File Dialog (For picking images)
async function showOpenDialogSafe(target, options, contextLabel = 'open file dialog') {
  try {
    if (target && !target.isDestroyed()) {
      return await dialog.showOpenDialog(target, options);
    }
    return await dialog.showOpenDialog(options);
  } catch (error) {
    const message = `Failed to open system file picker for ${contextLabel}: ${error.message}`;
    console.error('Open Dialog Error:', error);
    return {
      canceled: false,
      filePaths: [],
      __error: message
    };
  }
}

ipcMain.handle('dialog:openFile', async () => {
  const target = BrowserWindow.getFocusedWindow() || mainWindow;
  const { canceled, filePaths, __error } = await showOpenDialogSafe(target, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'heic', 'heif'] }]
  }, 'image selection');
  if (__error) throw new Error(__error);
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('dispose-replaced-image', async (event, relativePath) => {
  if (!relativePath || (typeof relativePath === 'string' && relativePath.includes('default_'))) {
    return { success: true, action: 'noop' };
  }
  try {
    const backupSettings = getBackupSettings({ preferences: currentPreferences });
    return await disposeManagedImage({
      fs,
      imagesRoot: getImagesPath(),
      archiveRoot: getReplacedImagesArchivePath(),
      imagePath: relativePath,
      keepArchived: !!backupSettings.keep_replaced_images
    });
  } catch (err) {
    console.error('Dispose Replaced Image Error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('detect-pen-colors', async (event, sourcePath) => {
  if (!sourcePath) return { success: false, message: 'Missing source path.' };
  try {
    const colors = await detectPenColorsWithML(sourcePath);
    if (!colors) return { success: false, message: 'No reliable pen colors detected.' };
    return { success: true, colors };
  } catch (error) {
    console.error("Detect Pen Colors Error:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('image:preview-url', async (event, sourcePath) => {
  return await getLocalImagePreviewUrl(sourcePath);
});

// 5a. Backup status
ipcMain.handle('backup:status', async () => {
  try {
    return await getAutoBackupStatus();
  } catch (error) {
    console.error("Backup Status Error:", error);
    return { success: false, message: error.message, latest: null, count: 0 };
  }
});

ipcMain.handle('images:base-url', async () => {
  try {
    await ensureAppStorage();
    return pathToFileURL(getImagesPath()).href.replace(/\/$/, '');
  } catch (error) {
    console.error("Images Base URL Error:", error);
    return null;
  }
});

ipcMain.handle('release:status', async () => {
  const currentVersion = app.getVersion();
  const currentTag = `v${currentVersion}`;
  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `${packageInfo.name || 'inkubator'}/${currentVersion}`
      }
    });
    if (!response.ok) {
      return {
        success: false,
        currentVersion,
        currentTag,
        releasesUrl: GITHUB_RELEASES_URL,
        message: `GitHub API responded with ${response.status}.`
      };
    }
    const release = await response.json();
    const latestTag = String(release?.tag_name || '').trim() || null;
    const latestVersion = resolveReleaseVersion(release) || null;
    const publishedAt = release?.published_at || release?.created_at || null;
    const releaseUrl = release?.html_url || GITHUB_RELEASES_URL;
    const versionState = getReleaseVersionState(currentVersion, latestVersion, latestTag, currentTag);
    const hasUpdate = versionState === 'update_available';
    return {
      success: true,
      currentVersion,
      currentTag,
      latestVersion,
      latestTag,
      versionState,
      hasUpdate,
      releaseUrl,
      releasesUrl: GITHUB_RELEASES_URL,
      publishedAt
    };
  } catch (error) {
    console.error('Release Status Error:', error);
    return {
      success: false,
      currentVersion,
      currentTag,
      releasesUrl: GITHUB_RELEASES_URL,
      message: error.message
    };
  }
});

// 5b. Manual backup export (full data + images)
ipcMain.handle('backup:export', async () => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths, __error } = await showOpenDialogSafe(target, {
      title: 'Choose backup destination folder',
      properties: ['openDirectory', 'createDirectory']
    }, 'backup export');
    if (__error) return { success: false, message: __error };
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const backupFolder = await createManualBackup(filePaths[0]);
    return { success: true, path: backupFolder };
  } catch (error) {
    console.error("Backup Export Error:", error);
    return { success: false, message: error.message };
  }
});

// 5c. Manual backup import (restore data and optional images)
ipcMain.handle('backup:import', async (event, importOptions = {}) => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths, __error } = await showOpenDialogSafe(target, {
      title: 'Select backup folder to import',
      properties: ['openDirectory']
    }, 'backup import');
    if (__error) return { success: false, message: __error };
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    return await importManualBackup(filePaths[0], importOptions || {});
  } catch (error) {
    console.error("Backup Import Error:", error);
    return { success: false, message: error.message };
  }
});

// 5d. Showcase export (static website package)
ipcMain.handle('showcase:export', async () => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths, __error } = await showOpenDialogSafe(target, {
      title: 'Choose destination for showcase folder',
      properties: ['openDirectory', 'createDirectory']
    }, 'showcase export');
    if (__error) return { success: false, message: __error };
    if (target && !target.isDestroyed()) {
      target.show();
      target.focus();
      if (target.webContents && !target.webContents.isDestroyed()) {
        target.webContents.focus();
      }
    }
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const showcasePath = await exportShowcaseBundle(filePaths[0]);
    return { success: true, path: showcasePath };
  } catch (error) {
    console.error("Showcase Export Error:", error);
    return { success: false, message: error.message };
  }
});

// 5a. Confirm dialog (non-blocking, avoids renderer window.confirm side effects)
ipcMain.handle('dialog:confirm', async (event, options = {}) => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const result = await dialog.showMessageBox(target, {
      type: options.type || 'question',
      buttons: options.buttons || ['Cancel', 'Confirm'],
      defaultId: typeof options.defaultId === 'number' ? options.defaultId : 1,
      cancelId: typeof options.cancelId === 'number' ? options.cancelId : 0,
      title: options.title || 'Confirm',
      message: options.message || 'Are you sure?',
      detail: options.detail || '',
      noLink: true
    });
    return { success: true, confirmed: result.response === (options.confirmedIndex ?? 1) };
  } catch (error) {
    console.error("Confirm Dialog Error:", error);
    return { success: false, confirmed: false, message: error.message };
  }
});

// 5b. Re-focus window (useful after native dialogs like confirm/open-file)
ipcMain.handle('focus-window', async () => {
  try {
    const focused = BrowserWindow.getFocusedWindow();
    const target = focused || mainWindow;
    if (target && !target.isDestroyed()) {
      if (target.isMinimized()) target.restore();
      target.show();
      target.focus();
      if (target.webContents && !target.webContents.isDestroyed()) {
        target.webContents.focus();
      }
      return { success: true };
    }
    return { success: false, message: 'No active window to focus.' };
  } catch (error) {
    console.error("Focus Window Error:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('open-external-url', async (event, rawUrl) => {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, message: 'Only http/https URLs are allowed.' };
    }
    await shell.openExternal(parsed.toString());
    return { success: true };
  } catch (error) {
    console.error('Open External URL Error:', error);
    return { success: false, message: error.message };
  }
});

// 5. Fetch from InkSwatch
ipcMain.handle('fetch-inkswatch', async (event, query) => {
  try {
    const searchUrl = `https://inkswatch.com/getSearchResults.php?query=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(searchUrl);
    if (!response.ok) {
      throw new Error(`InkSwatch search request failed (${response.status} ${response.statusText || 'HTTP error'})`);
    }
    const html = await response.text();

    // Extract all results: <p class="searchModalLinks"><a href="ink.html?inkId=...">Name</a></p>
    // We want to find the best match or at least the first one.
    const linkRegex = /<a href="ink\.html\?inkId=(\d+)">([^<]+)<\/a>/g;
    let match;
    let bestMatch = null;

    // Simple heuristic: If multiple results, prefer one that starts with the query brand/name?
    // For now, let's just grab the first valid one, but we could iterate.
    // Actually, let's just grab the first one as before, but ensure we decode entities if needed.

    const matches = [];
    while ((match = linkRegex.exec(html)) !== null) {
      matches.push({ id: match[1], name: match[2] });
    }

    if (matches.length === 0) {
      return { success: false, message: "No results found." };
    }

    // Default to first
    let selected = matches[0];

    // Optional: basic fuzzy check (if we wanted to be smarter)
    // const queryLower = query.toLowerCase();
    // const exact = matches.find(m => m.name.toLowerCase() === queryLower);
    // if (exact) selected = exact;

    const inkId = selected.id;
    const inkName = selected.name;

    // Fetch Detail
    const detailUrl = `https://inkswatch.com/getInkChoiceSwatches.php?inkId=${inkId}`;
    const detailResponse = await fetchWithTimeout(detailUrl);
    if (!detailResponse.ok) {
      throw new Error(`InkSwatch detail request failed (${detailResponse.status} ${detailResponse.statusText || 'HTTP error'})`);
    }
    const detailHtml = await detailResponse.text();

    // Extract Image URL
    const imgRegex = new RegExp(`<img id="ink${inkId}Swatch" src="([^"]+)"`);
    const imgMatch = detailHtml.match(imgRegex);

    if (!imgMatch) {
      return { success: false, message: "Swatch image not found in detail page." };
    }

    const relativeImgUrl = imgMatch[1];
    const fullImgUrl = `https://inkswatch.com/${relativeImgUrl}`;

    return { success: true, imageUrl: fullImgUrl, inkName: inkName };

  } catch (error) {
    console.error("Fetch Error:", error);
    return { success: false, message: error.message };
  }
});

// 6. Save Image from URL (Processes and saves as WebP)
ipcMain.handle('save-image-url', async (event, url, type, metadata) => {
  try {
    const sharp = getSharpOrThrow();
    const parsed = new URL(String(url || ''));
    if (type === 'swatch' && parsed.protocol !== 'https:') {
      return { success: false, message: 'Only https URLs are allowed for swatch images.' };
    }
    const response = await fetchWithTimeout(parsed.toString());
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const sourceBuffer = Buffer.from(buffer);

    const typeFolder = (type === 'pen') ? 'pens' : (type === 'ink' ? 'inks' : 'swatches');
    const imagesDir = path.join(getImagesPath(), typeFolder);
    await fs.ensureDir(imagesDir);

    let filename = '';
    if (type === 'pen') {
      filename = await buildNextPenFilename(imagesDir, metadata);
    } else if (type === 'swatch') {
      filename = buildUniqueSwatchFilename(metadata);
    } else {
      filename = await buildNextInkFilename(imagesDir, metadata);
    }

    const destPath = path.join(imagesDir, filename);
    const sharpInput = await prepareImageInputForSharp({
      input: sourceBuffer,
      sourceUrl: parsed.toString(),
      mimeType: response.headers.get('content-type') || '',
      convertHeicBuffer: convertHeicBufferForSharp
    });

    // Process Buffer with Sharp
    await sharp(sharpInput)
      .resize({ width: 1200, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80 })
      .toFile(destPath);

    return { success: true, filename: `${typeFolder}/${filename}` };
  } catch (error) {
    console.error("Save Image URL Error:", error);
    return { success: false, message: error.message };
  }
});
