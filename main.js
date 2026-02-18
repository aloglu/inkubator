const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs-extra');
const { normalizeAppData } = require('./lib/data-schema');

let mainWindow;
const AUTO_BACKUP_MAX_FILES = 200;
const APP_NAME = 'Inkubator';
const WINDOWS_APP_USER_MODEL_ID = 'com.inkubator.app';

if (typeof app.setName === 'function') {
  app.setName(APP_NAME);
}
if (process.platform === 'win32' && typeof app.setAppUserModelId === 'function') {
  app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
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

function getImagesPath() {
  return path.join(app.getPath('userData'), 'images');
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

async function ensureBackupDirs() {
  const paths = getBackupPaths();
  await fs.ensureDir(paths.auto);
  await fs.ensureDir(paths.manual);
  return paths;
}

async function pruneAutoBackups() {
  const paths = await ensureBackupDirs();
  const entries = await fs.readdir(paths.auto);
  const files = [];
  for (const entry of entries) {
    const full = path.join(paths.auto, entry);
    const stat = await fs.stat(full);
    if (stat.isFile()) {
      files.push({ full, mtimeMs: stat.mtimeMs });
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const toDelete = files.slice(AUTO_BACKUP_MAX_FILES);
  await Promise.all(toDelete.map(f => fs.remove(f.full)));
}

async function createAutoBackupSnapshot(data, reason = 'save') {
  const paths = await ensureBackupDirs();
  const payload = {
    meta: {
      created_at: new Date().toISOString(),
      reason
    },
    data: normalizeAppData(data)
  };
  const backupPath = path.join(paths.auto, `auto-${makeTimestamp()}.json`);
  await fs.writeJson(backupPath, payload, { spaces: 2 });
  await pruneAutoBackups();
  return backupPath;
}

async function getAutoBackupStatus() {
  const paths = await ensureBackupDirs();
  const entries = await fs.readdir(paths.auto);
  const files = [];
  for (const entry of entries) {
    const full = path.join(paths.auto, entry);
    const stat = await fs.stat(full);
    if (stat.isFile()) {
      files.push({ name: entry, full, mtimeMs: stat.mtimeMs });
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = files[0] || null;
  return {
    success: true,
    count: files.length,
    latest: latest ? {
      name: latest.name,
      path: latest.full,
      updated_at: new Date(latest.mtimeMs).toISOString()
    } : null
  };
}

async function createManualBackup(targetFolder) {
  const folder = path.join(targetFolder, `inkubator-backup-${makeTimestamp()}`);
  await fs.ensureDir(folder);
  const dataPath = getDataPath();
  const imagesPath = getImagesPath();
  const backupDataPath = path.join(folder, 'data.json');
  const backupImagesPath = path.join(folder, 'images');
  const rawData = await fs.readJson(dataPath);
  await fs.writeJson(backupDataPath, normalizeAppData(rawData), { spaces: 2 });
  if (await fs.pathExists(imagesPath)) {
    await fs.copy(imagesPath, backupImagesPath, { overwrite: true });
  }
  await fs.writeJson(path.join(folder, 'manifest.json'), {
    type: 'inkubator-backup',
    version: 1,
    created_at: new Date().toISOString(),
    includes_images: await fs.pathExists(backupImagesPath)
  }, { spaces: 2 });
  return folder;
}

async function importManualBackup(backupFolder) {
  const backupDataPath = path.join(backupFolder, 'data.json');
  if (!(await fs.pathExists(backupDataPath))) {
    return { success: false, message: 'Selected folder is not a valid backup (missing data.json).' };
  }

  const raw = await fs.readJson(backupDataPath);
  const normalized = normalizeAppData(raw);

  // Safety snapshot before restore.
  if (await fs.pathExists(getDataPath())) {
    const existing = await fs.readJson(getDataPath());
    await createAutoBackupSnapshot(existing, 'pre-import-restore');
  }

  await fs.writeJson(getDataPath(), normalized, { spaces: 2 });

  const backupImagesPath = path.join(backupFolder, 'images');
  if (await fs.pathExists(backupImagesPath)) {
    await fs.remove(getImagesPath());
    await fs.copy(backupImagesPath, getImagesPath(), { overwrite: true });
  }

  await createAutoBackupSnapshot(normalized, 'post-import-restore');
  return { success: true, data: normalized };
}

async function exportShowcaseBundle(targetFolder) {
  await ensureAppStorage();

  const showcaseRoot = path.join(targetFolder, 'showcase');
  const bundledRoot = __dirname;
  const dataPath = getDataPath();
  const imagesPath = getImagesPath();
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

  if (await fs.pathExists(dataPath)) {
    const raw = await fs.readJson(dataPath);
    const normalized = normalizeAppData(raw);
    await fs.writeJson(path.join(showcaseRoot, 'data.json'), normalized, { spaces: 2 });
    await fs.writeFile(
      path.join(showcaseRoot, 'data.js'),
      `window.__INKUBATOR_DATA__ = ${JSON.stringify(normalized)};\n`,
      'utf8'
    );
  } else {
    const empty = normalizeAppData({ pens: [], inks: [], currently_inked: [] });
    await fs.writeJson(path.join(showcaseRoot, 'data.json'), empty, { spaces: 2 });
    await fs.writeFile(
      path.join(showcaseRoot, 'data.js'),
      `window.__INKUBATOR_DATA__ = ${JSON.stringify(empty)};\n`,
      'utf8'
    );
  }

  if (await fs.pathExists(imagesPath)) {
    await fs.copy(imagesPath, path.join(showcaseRoot, 'images'), {
      overwrite: true,
      errorOnExist: false
    });
  } else {
    await fs.ensureDir(path.join(showcaseRoot, 'images'));
  }

  const showcaseIndexPath = path.join(showcaseRoot, 'index.html');
  if (await fs.pathExists(showcaseIndexPath)) {
    let html = await fs.readFile(showcaseIndexPath, 'utf8');
    if (!html.includes('src="data.js"')) {
      html = html.replace(
        '<script src="renderer.js"></script>',
        '    <script src="data.js"></script>\n    <script src="renderer.js"></script>'
      );
      await fs.writeFile(showcaseIndexPath, html, 'utf8');
    }
  }

  return showcaseRoot;
}

async function migratePenImageNames(data) {
  const normalized = normalizeAppData(data);
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
  const currentlyInked = Array.isArray(data.currently_inked) ? data.currently_inked.length : 0;
  return pens + inks + currentlyInked;
}

async function readNormalizedDataIfExists(filePath) {
  if (!(await fs.pathExists(filePath))) return null;
  try {
    const raw = await fs.readJson(filePath);
    return normalizeAppData(raw);
  } catch (error) {
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getBundledWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

async function ensureAppStorage() {
  const dataPath = getDataPath();
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
      const initialData = normalizeAppData({ pens: [], inks: [], currently_inked: [] });
      await fs.writeJson(dataPath, initialData, { spaces: 2 });
    }
  } else if (!app.isPackaged && bundledData && bundledCount > 0) {
    const currentData = await readNormalizedDataIfExists(dataPath);
    const currentCount = getCollectionEntityCount(currentData || {});
    if (currentCount === 0) {
      await fs.writeJson(dataPath, bundledData, { spaces: 2 });
    }
  }

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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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

// ----------------------------------------------------------------
//  File System Handlers (The "Manager" Logic)
// ----------------------------------------------------------------

const sharp = require('sharp');
let ort = null;
let penModelSessionPromise = null;

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
  const modelSize = 320;
  const { data: rgbBuffer } = await sharp(sourcePath)
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
    if (!fs.existsSync(dataPath)) {
      // Create empty if missing
      const initialData = normalizeAppData({ pens: [], inks: [], currently_inked: [] });
      await fs.writeJson(dataPath, initialData);
      return initialData;
    }
    const raw = await fs.readJson(dataPath);
    const migrated = await migratePenImageNames(raw);
    if (migrated.changed) {
      await fs.writeJson(dataPath, migrated.data, { spaces: 2 });
    }
    return migrated.data;
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
    const normalized = normalizeAppData(newData);
    await fs.writeJson(dataPath, normalized, { spaces: 2 });
    await createAutoBackupSnapshot(normalized, 'save-data');
    return { success: true };
  } catch (err) {
    console.error("Error saving data:", err);
    return { success: false, error: err.message };
  }
});

// 3. Save Image (Copies, resizes, and converts to WebP)
ipcMain.handle('save-image', async (event, sourcePath, type, metadata) => {
  if (!sourcePath) return null;
  try {
    const typeFolder = (type === 'pen') ? 'pens' : (type === 'ink' ? 'inks' : 'swatches');
    const imagesDir = path.join(getImagesPath(), typeFolder);
    await fs.ensureDir(imagesDir);

    let filename = '';
    if (type === 'pen') {
      filename = await buildNextPenFilename(imagesDir, metadata);
    } else {
      filename = buildInkFilename(metadata);
    }

    const destPath = path.join(imagesDir, filename);

    // Process with Sharp: Resize max-width 1200px and convert to WebP
    await sharp(sourcePath)
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
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'heic', 'heif'] }]
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
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

// 5b. Manual backup export (full data + images)
ipcMain.handle('backup:export', async () => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths } = await dialog.showOpenDialog(target, {
      title: 'Choose backup destination folder',
      properties: ['openDirectory', 'createDirectory']
    });
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
ipcMain.handle('backup:import', async () => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths } = await dialog.showOpenDialog(target, {
      title: 'Select backup folder to import',
      properties: ['openDirectory']
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    return await importManualBackup(filePaths[0]);
  } catch (error) {
    console.error("Backup Import Error:", error);
    return { success: false, message: error.message };
  }
});

// 5d. Showcase export (static website package)
ipcMain.handle('showcase:export', async () => {
  try {
    const target = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths } = await dialog.showOpenDialog(target, {
      title: 'Choose destination for showcase folder',
      properties: ['openDirectory', 'createDirectory']
    });
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
      target.focus();
      return { success: true };
    }
    return { success: false, message: 'No active window to focus.' };
  } catch (error) {
    console.error("Focus Window Error:", error);
    return { success: false, message: error.message };
  }
});

// 5. Fetch from InkSwatch
ipcMain.handle('fetch-inkswatch', async (event, query) => {
  try {
    const searchUrl = `https://inkswatch.com/getSearchResults.php?query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl);
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
    const detailResponse = await fetch(detailUrl);
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
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const buffer = await response.arrayBuffer();

    const typeFolder = (type === 'pen') ? 'pens' : (type === 'ink' ? 'inks' : 'swatches');
    const imagesDir = path.join(getImagesPath(), typeFolder);
    await fs.ensureDir(imagesDir);

    let filename = '';
    if (type === 'pen') {
      filename = await buildNextPenFilename(imagesDir, metadata);
    } else {
      filename = buildInkFilename(metadata);
    }

    const destPath = path.join(imagesDir, filename);

    // Process Buffer with Sharp
    await sharp(Buffer.from(buffer))
      .resize({ width: 1200, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80 })
      .toFile(destPath);

    return { success: true, filename: `${typeFolder}/${filename}` };
  } catch (error) {
    console.error("Save Image URL Error:", error);
    return { success: false, message: error.message };
  }
});
