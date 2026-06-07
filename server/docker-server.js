#!/usr/bin/env node
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const AdmZip = require('adm-zip');

const { normalizeAppData } = require('../lib/data-schema');
const {
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  disposeManagedImage,
  normalizeManagedRelativeImagePath
} = require('../lib/critical-persistence');
const {
  getReleaseVersionState,
  resolveReleaseVersion
} = require('../lib/release-version');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const DATA_DIR = path.resolve(process.env.INKUBATOR_DATA_DIR || process.env.DATA_DIR || '/data');
const EXPORT_DIR = path.resolve(process.env.INKUBATOR_EXPORT_DIR || path.join(DATA_DIR, 'exports'));
const PORT = Number(process.env.PORT || process.env.INKUBATOR_PORT || 8080);
const ADMIN_USER = process.env.INKUBATOR_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.INKUBATOR_ADMIN_PASSWORD || '';
const MAX_BODY_BYTES = Number(process.env.INKUBATOR_MAX_BODY_BYTES || 120 * 1024 * 1024);
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
const VERSION = require('../package.json').version;
const GITHUB_RELEASES_URL = 'https://github.com/aloglu/inkubator/releases';
const GITHUB_CONTAINER_URL = 'https://github.com/aloglu/inkubator/pkgs/container/inkubator';
const DOCKER_IMAGE = process.env.INKUBATOR_IMAGE || `ghcr.io/aloglu/inkubator:${VERSION}`;
const SESSION_COOKIE = 'inkubator_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

if (!ADMIN_PASSWORD && process.env.INKUBATOR_ALLOW_INSECURE !== '1') {
  console.error('INKUBATOR_ADMIN_PASSWORD is required for Docker admin mode.');
  console.error('Set INKUBATOR_ALLOW_INSECURE=1 only for local throwaway testing.');
  process.exit(1);
}

const paths = {
  data: path.join(DATA_DIR, 'data.json'),
  preferences: path.join(DATA_DIR, 'preferences.json'),
  images: path.join(DATA_DIR, 'images'),
  replacedImages: path.join(DATA_DIR, 'replaced-images'),
  backups: path.join(DATA_DIR, 'backups'),
  exports: EXPORT_DIR
};

function defaultPreferences() {
  return normalizeAppData({}).preferences;
}

function defaultCollectionData() {
  return {
    pens: [],
    inks: [],
    swatches: [],
    currently_inked: [],
    activity_log: []
  };
}

function stripPreferences(data) {
  const clone = { ...(data && typeof data === 'object' ? data : {}) };
  delete clone.preferences;
  return clone;
}

function combine(collection, preferences) {
  return { ...(collection || defaultCollectionData()), preferences: preferences || defaultPreferences() };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (_) {
    return false;
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sanitizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function metadataString(metadata, key, fallback) {
  const value = metadata && typeof metadata[key] === 'string' ? metadata[key].trim() : '';
  return value || fallback;
}

async function nextNumberedFilename(dir, stem) {
  let next = 1;
  while (true) {
    const filename = `${stem}-${next}.webp`;
    if (!(await pathExists(path.join(dir, filename)))) return filename;
    next += 1;
  }
}

async function imageFilename(imageType, metadata, dir) {
  if (imageType === 'pen') {
    const stem = [
      metadataString(metadata, 'brand', 'unknown'),
      metadataString(metadata, 'model', 'pen'),
      metadataString(metadata, 'nib', 'standard'),
      metadataString(metadata, 'color', 'standard')
    ].map(sanitizeSlug).join('-');
    return nextNumberedFilename(dir, stem);
  }
  if (imageType === 'swatch') {
    const brand = sanitizeSlug(metadataString(metadata, 'brand', 'unknown'));
    const model = sanitizeSlug(metadataString(metadata, 'model', 'swatch'));
    return `${brand}-${model}-${Date.now()}-${randomUUID().replace(/-/g, '')}.webp`;
  }
  const brand = sanitizeSlug(metadataString(metadata, 'brand', 'unknown'));
  const model = sanitizeSlug(metadataString(metadata, 'model', 'ink'));
  const stem = `${brand}-${model}`;
  if (!(await pathExists(path.join(dir, `${stem}.webp`)))) return `${stem}.webp`;
  let next = 2;
  while (true) {
    const filename = `${stem}-${next}.webp`;
    if (!(await pathExists(path.join(dir, filename)))) return filename;
    next += 1;
  }
}

function imageFolder(imageType) {
  if (imageType === 'pen') return 'pens';
  if (imageType === 'swatch') return 'swatches';
  return 'inks';
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeImagePath(relativePath) {
  const normalized = normalizeManagedRelativeImagePath(relativePath);
  const target = path.normalize(path.join(paths.images, normalized));
  if (!normalized || !isInside(paths.images, target)) throw new Error('Invalid image path.');
  return { normalized, target };
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function sendDownload(res, filePath, filename, contentType) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${String(filename).replace(/"/g, '')}"`,
    'Cache-Control': 'no-store'
  });
  await new Promise((resolve, reject) => {
    const stream = fssync.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

function parseCookies(req) {
  const out = {};
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (!session || now - session.createdAt > SESSION_TTL_MS) sessions.delete(token);
  }
}

function createSession(res) {
  cleanupSessions();
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, { createdAt: Date.now() });
  res.setHeader('Set-Cookie', cookieHeader(SESSION_COOKIE, encodeURIComponent(token), { maxAge: Math.floor(SESSION_TTL_MS / 1000) }));
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', cookieHeader(SESSION_COOKIE, '', { maxAge: 0 }));
}

function unauthorized(res) {
  sendJson(res, 401, { success: false, message: 'Authentication required.' });
}

function isAuthorized(req) {
  if (process.env.INKUBATOR_ALLOW_INSECURE === '1' && !ADMIN_PASSWORD) return true;
  if (isSessionAuthorized(req)) return true;

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const split = decoded.indexOf(':');
  const user = split >= 0 ? decoded.slice(0, split) : decoded;
  const password = split >= 0 ? decoded.slice(split + 1) : '';
  return user === ADMIN_USER && password === ADMIN_PASSWORD;
}

function isSessionAuthorized(req) {
  if (process.env.INKUBATOR_ALLOW_INSECURE === '1' && !ADMIN_PASSWORD) return true;
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  return !!(session && Date.now() - session.createdAt <= SESSION_TTL_MS);
}

function isValidLogin(username, password) {
  if (process.env.INKUBATOR_ALLOW_INSECURE === '1' && !ADMIN_PASSWORD) return true;
  return username === ADMIN_USER && password === ADMIN_PASSWORD;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString('utf8'));
}

async function copyDir(source, destination) {
  if (!(await pathExists(source))) return;
  await fs.cp(source, destination, { recursive: true, force: true });
}

async function removeIfExists(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function createAutoBackup(reason) {
  const collection = await readJson(paths.data, defaultCollectionData());
  const preferences = await readJson(paths.preferences, defaultPreferences());
  const dir = path.join(paths.backups, 'auto');
  await ensureDir(dir);
  const folder = path.join(dir, `auto-${Date.now()}-${reason}`);
  await createBackupFolder(folder, collection, preferences, {
    type: 'inkubator-auto-backup',
    reason
  });
}

async function loadCombinedData() {
  return combine(
    await readJson(paths.data, defaultCollectionData()),
    await readJson(paths.preferences, defaultPreferences())
  );
}

async function saveCombinedData(data) {
  const normalized = normalizeAppData(data);
  await writeJson(paths.data, stripPreferences(normalized));
  await writeJson(paths.preferences, normalized.preferences);
  await createAutoBackup('save-data');
  return { success: true };
}

async function saveImageBytes(payload) {
  const imageType = payload.imageType || 'ink';
  const folder = imageFolder(imageType);
  const dir = path.join(paths.images, folder);
  await ensureDir(dir);
  const filename = await imageFilename(imageType, payload.metadata || {}, dir);
  await fs.writeFile(path.join(dir, filename), Buffer.from(String(payload.bytesBase64 || ''), 'base64'));
  return `${folder}/${filename}`;
}

async function saveRemoteImage(payload) {
  const url = new URL(payload.url);
  if (url.protocol !== 'https:') throw new Error('Only https URLs are allowed for remote images.');
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_REMOTE_IMAGE_BYTES) throw new Error('Remote image is too large.');
  const imageType = payload.imageType || 'swatch';
  const folder = imageFolder(imageType);
  const dir = path.join(paths.images, folder);
  await ensureDir(dir);
  const ext = path.extname(url.pathname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
  const name = (await imageFilename(imageType, payload.metadata || {}, dir)).replace(/\.webp$/, ext);
  await fs.writeFile(path.join(dir, name), bytes);
  return `${folder}/${name}`;
}

async function readRemoteImageBytes(payload) {
  const url = new URL(payload.url);
  if (url.protocol !== 'https:') throw new Error('Only https URLs are allowed for remote images.');
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_REMOTE_IMAGE_BYTES) throw new Error('Remote image is too large.');
  return {
    success: true,
    base64: bytes.toString('base64'),
    sourceUrl: url.href,
    sourceHint: url.pathname,
    mimeType: response.headers.get('content-type') || ''
  };
}

async function createBackupFolder(folder, collection, preferences, manifestOptions = {}) {
  await ensureDir(folder);
  await writeJson(path.join(folder, 'data.json'), collection);
  await writeJson(path.join(folder, 'preferences.json'), preferences);
  await copyReferencedImages({
    fs: {
      ensureDir,
      pathExists,
      copy: fs.cp
    },
    sourceRoot: paths.images,
    destinationRoot: path.join(folder, 'images'),
    relativePaths: collectReferencedImageRelativePaths(collection)
  });
  if (await pathExists(paths.replacedImages)) {
    await copyDir(paths.replacedImages, path.join(folder, 'replaced-images'));
  }
  await writeJson(path.join(folder, 'manifest.json'), {
    type: manifestOptions.type || 'inkubator-backup',
    version: 3,
    created_at: new Date().toISOString(),
    reason: manifestOptions.reason || undefined,
    includes_images: true,
    includes_replaced_images: await pathExists(paths.replacedImages),
    includes_preferences: true
  });
}

async function exportBackupZip() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(paths.exports, `.inkubator-backup-${stamp}-${randomUUID()}`);
  const zipPath = path.join(paths.exports, `inkubator-backup-${stamp}.zip`);
  const collection = await readJson(paths.data, defaultCollectionData());
  const preferences = await readJson(paths.preferences, defaultPreferences());
  await removeIfExists(folder);
  await createBackupFolder(folder, collection, preferences, { type: 'inkubator-backup' });
  const zip = new AdmZip();
  zip.addLocalFolder(folder);
  await ensureDir(paths.exports);
  zip.writeZip(zipPath);
  await removeIfExists(folder);
  return { zipPath, filename: path.basename(zipPath) };
}

async function latestValidLocalBackup() {
  const autoDir = path.join(paths.backups, 'auto');
  if (!(await pathExists(autoDir))) return null;
  const entries = await fs.readdir(autoDir, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(autoDir, entry.name);
    if (!(await pathExists(path.join(folder, 'data.json'))) || !(await pathExists(path.join(folder, 'preferences.json')))) continue;
    const stat = await fs.stat(folder);
    candidates.push({ folder, name: entry.name, updated_at: stat.mtime.toISOString(), modified: stat.mtimeMs });
  }
  candidates.sort((a, b) => b.modified - a.modified);
  return candidates[0] || null;
}

function backupRelativePath(rawPath) {
  const normalized = String(rawPath || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const dataIndex = parts.lastIndexOf('data.json');
  if (dataIndex >= 0) return 'data.json';
  const prefsIndex = parts.lastIndexOf('preferences.json');
  if (prefsIndex >= 0) return 'preferences.json';
  const imagesIndex = parts.indexOf('images');
  if (imagesIndex >= 0) return parts.slice(imagesIndex).join('/');
  const replacedIndex = parts.indexOf('replaced-images');
  if (replacedIndex >= 0) return parts.slice(replacedIndex).join('/');
  return parts.slice(1).join('/') || normalized;
}

function mergeById(existingItems = [], incomingItems = [], behavior = 'overwrite') {
  if (behavior === 'overwrite') return incomingItems;
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  const byId = new Map(existing.map((item) => [item && item.id, item]).filter(([id]) => id));
  for (const item of incoming) {
    if (!item || !item.id) continue;
    if (!byId.has(item.id)) byId.set(item.id, item);
    else if (behavior === 'merge') byId.set(item.id, { ...byId.get(item.id), ...item });
  }
  return [...byId.values()];
}

function mergeCollection(existing, incoming, behavior) {
  if (behavior === 'overwrite') return incoming;
  return {
    ...existing,
    ...incoming,
    pens: mergeById(existing.pens, incoming.pens, behavior),
    inks: mergeById(existing.inks, incoming.inks, behavior),
    swatches: mergeById(existing.swatches, incoming.swatches, behavior),
    currently_inked: mergeById(existing.currently_inked, incoming.currently_inked, behavior),
    activity_log: mergeById(existing.activity_log, incoming.activity_log, behavior)
  };
}

async function importBackup(decoded, options = {}) {
  if (!decoded.has('data.json') || !decoded.has('preferences.json')) {
    return { success: false, message: 'Selected backup is not valid.' };
  }
  const incomingCollection = JSON.parse(decoded.get('data.json').toString('utf8'));
  const incomingPreferences = JSON.parse(decoded.get('preferences.json').toString('utf8'));
  if (options?.auto_validate_import !== false) {
    const valid = Array.isArray(incomingCollection.pens)
      && Array.isArray(incomingCollection.inks)
      && Array.isArray(incomingCollection.currently_inked);
    if (!valid) return { success: false, message: 'Import validation failed: invalid data shape.' };
  }
  const behavior = String(options?.conflict_behavior || 'overwrite').toLowerCase();
  const currentCollection = await readJson(paths.data, defaultCollectionData());
  await createAutoBackup('pre-import-restore');
  const merged = mergeCollection(currentCollection, incomingCollection, ['skip', 'merge'].includes(behavior) ? behavior : 'overwrite');
  await writeJson(paths.data, stripPreferences(normalizeAppData({ ...merged, preferences: incomingPreferences })));
  await writeJson(paths.preferences, normalizeAppData({ preferences: incomingPreferences }).preferences);

  if (behavior === 'overwrite') await removeIfExists(paths.images);
  await ensureDir(paths.images);
  for (const [relative, bytes] of decoded.entries()) {
    if (!relative.startsWith('images/')) continue;
    const normalized = normalizeManagedRelativeImagePath(relative);
    const target = path.join(paths.images, normalized);
    if (!isInside(paths.images, target)) continue;
    if (behavior === 'skip' && await pathExists(target)) continue;
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, bytes);
  }
  if (behavior === 'overwrite') await removeIfExists(paths.replacedImages);
  for (const [relative, bytes] of decoded.entries()) {
    if (!relative.startsWith('replaced-images/')) continue;
    const target = path.normalize(path.join(DATA_DIR, relative));
    if (!isInside(paths.replacedImages, target)) continue;
    if (behavior === 'skip' && await pathExists(target)) continue;
    await ensureDir(path.dirname(target));
    await fs.writeFile(target, bytes);
  }
  await createAutoBackup('post-import-restore');
  return { success: true, data: await loadCombinedData() };
}

async function readBackupFolder(folder) {
  const decoded = new Map();
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        decoded.set(backupRelativePath(path.relative(folder, fullPath)), await fs.readFile(fullPath));
      }
    }
  }
  await walk(folder);
  return decoded;
}

async function readBackupZip(zipBase64) {
  const zip = new AdmZip(Buffer.from(String(zipBase64 || ''), 'base64'));
  const decoded = new Map();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const relative = backupRelativePath(entry.entryName);
    if (!relative || relative.includes('..')) continue;
    decoded.set(relative, entry.getData());
  }
  return decoded;
}

async function importLocalBackup(payload) {
  const latest = await latestValidLocalBackup();
  if (!latest) {
    return { success: false, noLocalBackup: true, message: 'No backup file was found locally.' };
  }
  const decoded = await readBackupFolder(latest.folder);
  return importBackup(decoded, payload.options);
}

async function exportShowcase() {
  const showcase = path.join(paths.exports, 'showcase');
  const stage = path.join(paths.exports, `.showcase-${Date.now()}`);
  await removeIfExists(stage);
  await ensureDir(stage);
  await copyDir(APP_DIR, stage);
  await removeIfExists(path.join(stage, 'docker-api.js'));
  await removeIfExists(path.join(stage, 'docker-shell.js'));
  await removeIfExists(path.join(stage, 'tauri-api.js'));
  let html = await fs.readFile(path.join(stage, 'index.html'), 'utf8');
  html = html.replace(/\s*<script src="tauri-api\.js"><\/script>\n?/g, '\n');
  if (!html.includes('src="data.js"')) {
    html = html.replace('<script src="renderer.js"></script>', '<script src="data.js"></script>\n    <script src="renderer.js"></script>');
  }
  await fs.writeFile(path.join(stage, 'index.html'), html);
  const data = await loadCombinedData();
  await writeJson(path.join(stage, 'data.json'), data);
  await fs.writeFile(path.join(stage, 'data.js'), `window.__INKUBATOR_DATA__ = ${JSON.stringify(data)};\n`);
  await copyReferencedImages({
    fs: {
      ensureDir,
      pathExists,
      copy: fs.cp
    },
    sourceRoot: paths.images,
    destinationRoot: path.join(stage, 'images'),
    relativePaths: collectReferencedImageRelativePaths(stripPreferences(data))
  });
  for (const route of ['dashboard', 'pens', 'inks', 'swatches', 'stats', 'activity', 'settings']) {
    const routeDir = path.join(stage, route);
    await ensureDir(routeDir);
    await fs.writeFile(path.join(routeDir, 'index.html'), html.replace('<head>', '<head>\n    <base href="../">'));
  }
  await removeIfExists(showcase);
  await fs.rename(stage, showcase);
  return { success: true, path: showcase };
}

async function fetchInkSwatch(query) {
  const search = await fetch(`https://inkswatch.com/getSearchResults.php?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(15000) });
  const html = await search.text();
  const marker = 'ink.html?inkId=';
  const start = html.indexOf(marker);
  if (start < 0) return { success: false, message: 'No results found.' };
  const id = html.slice(start + marker.length).match(/^\d+/)?.[0] || '';
  if (!id) return { success: false, message: 'No results found.' };
  const name = html.slice(start + marker.length).split('>')[1]?.split('</a>')[0] || query;
  const detail = await (await fetch(`https://inkswatch.com/getInkChoiceSwatches.php?inkId=${id}`, { signal: AbortSignal.timeout(15000) })).text();
  const imgMarker = `id="ink${id}Swatch" src="`;
  const imgStart = detail.indexOf(imgMarker);
  if (imgStart < 0) return { success: false, message: 'Swatch image not found in detail page.' };
  const relative = detail.slice(imgStart + imgMarker.length).split('"')[0];
  return { success: true, imageUrl: `https://inkswatch.com/${relative}`, inkName: name };
}

async function releaseStatus() {
  const currentTag = `v${VERSION}`;
  const response = await fetch('https://api.github.com/repos/aloglu/inkubator/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `inkubator/${VERSION}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    return {
      success: false,
      currentVersion: VERSION,
      currentTag,
      distribution: 'docker',
      dockerImage: DOCKER_IMAGE,
      containerUrl: GITHUB_CONTAINER_URL,
      releasesUrl: GITHUB_RELEASES_URL,
      message: `GitHub API responded with ${response.status}.`
    };
  }
  const release = await response.json();
  const latestVersion = resolveReleaseVersion(release);
  const versionState = getReleaseVersionState(VERSION, latestVersion, release.tag_name, currentTag);
  return {
    success: true,
    currentVersion: VERSION,
    currentTag,
    distribution: 'docker',
    dockerImage: DOCKER_IMAGE,
    containerUrl: GITHUB_CONTAINER_URL,
    latestVersion,
    latestTag: release.tag_name || '',
    versionState,
    hasUpdate: versionState === 'update_available',
    releaseUrl: release.html_url || GITHUB_RELEASES_URL,
    releasesUrl: GITHUB_RELEASES_URL,
    publishedAt: release.published_at || release.created_at || null
  };
}

function appInfo() {
  return {
    success: true,
    currentVersion: VERSION,
    currentTag: `v${VERSION}`,
    distribution: 'docker',
    dockerImage: DOCKER_IMAGE,
    containerUrl: GITHUB_CONTAINER_URL,
    releasesUrl: GITHUB_RELEASES_URL
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { success: true });
  if (req.method === 'GET' && pathname === '/api/app-info') return sendJson(res, 200, appInfo());
  if (req.method === 'GET' && pathname === '/api/data') return sendJson(res, 200, await loadCombinedData());
  if (req.method === 'POST' && pathname === '/api/data') return sendJson(res, 200, await saveCombinedData((await readJsonBody(req)).data));
  if (req.method === 'POST' && pathname === '/api/image-data-urls') {
    const { paths: requested = [] } = await readJsonBody(req);
    const out = {};
    for (const raw of requested) {
      try {
        const { normalized, target } = safeImagePath(raw);
        if (await pathExists(target)) out[normalized] = `data:${mimeFor(target)};base64,${(await fs.readFile(target)).toString('base64')}`;
      } catch (_) {}
    }
    return sendJson(res, 200, out);
  }
  if (req.method === 'POST' && pathname === '/api/save-image-bytes') return sendJson(res, 200, await saveImageBytes(await readJsonBody(req)));
  if (req.method === 'POST' && pathname === '/api/read-remote-image-bytes') return sendJson(res, 200, await readRemoteImageBytes(await readJsonBody(req)));
  if (req.method === 'POST' && pathname === '/api/save-image-url') return sendJson(res, 200, { success: true, filename: await saveRemoteImage(await readJsonBody(req)) });
  if (req.method === 'POST' && pathname === '/api/delete-image') {
    const { relativePath } = await readJsonBody(req);
    const { target } = safeImagePath(relativePath);
    await fs.rm(target, { force: true });
    return sendJson(res, 200, { success: true });
  }
  if (req.method === 'POST' && pathname === '/api/dispose-replaced-image') {
    const { relativePath } = await readJsonBody(req);
    return sendJson(res, 200, await disposeManagedImage({
      fs: { pathExists, remove: fs.rm, move: fs.rename, ensureDir },
      imagesRoot: paths.images,
      archiveRoot: paths.replacedImages,
      imagePath: relativePath,
      keepArchived: true
    }));
  }
  if (req.method === 'GET' && pathname === '/api/backup-status') {
    const autoDir = path.join(paths.backups, 'auto');
    const entries = (await pathExists(autoDir)) ? await fs.readdir(autoDir, { withFileTypes: true }) : [];
    const latest = await latestValidLocalBackup();
    return sendJson(res, 200, {
      success: true,
      count: entries.filter((entry) => entry.isDirectory()).length,
      latest: latest ? { name: latest.name, path: latest.folder, updated_at: latest.updated_at } : null
    });
  }
  if (req.method === 'GET' && pathname === '/api/local-backup-status') {
    const latest = await latestValidLocalBackup();
    return sendJson(res, 200, {
      success: true,
      found: !!latest,
      latest: latest ? { name: latest.name, updated_at: latest.updated_at } : null
    });
  }
  if (req.method === 'POST' && pathname === '/api/export-backup') {
    const exported = await exportBackupZip();
    await sendDownload(res, exported.zipPath, exported.filename, 'application/zip');
    await fs.rm(exported.zipPath, { force: true });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/import-local-backup') {
    return sendJson(res, 200, await importLocalBackup(await readJsonBody(req)));
  }
  if (req.method === 'POST' && pathname === '/api/import-backup') {
    const payload = await readJsonBody(req);
    const decoded = await readBackupZip(payload.zipBase64);
    return sendJson(res, 200, await importBackup(decoded, payload.options));
  }
  if (req.method === 'POST' && pathname === '/api/export-showcase') {
    return sendJson(res, 410, { success: false, message: 'Showcase export is unavailable in Docker mode because the public website is served directly.' });
  }
  if (req.method === 'GET' && pathname === '/api/release-status') return sendJson(res, 200, await releaseStatus());
  if (req.method === 'POST' && pathname === '/api/fetch-inkswatch') return sendJson(res, 200, await fetchInkSwatch((await readJsonBody(req)).query || ''));
  return false;
}

async function serveManagedImage(res, relativePath) {
  const { target } = safeImagePath(relativePath);
  if (!(await pathExists(target))) return false;
  res.writeHead(200, { 'Content-Type': mimeFor(target), 'Cache-Control': 'no-store' });
  fssync.createReadStream(target).pipe(res);
  return true;
}

function addHeadBase(html, href) {
  if (html.includes('<base ')) return html;
  return html.replace('<head>', `<head>\n    <base href="${href}">`);
}

function injectDockerShell(html) {
  const marker = '<script src="renderer.js"></script>';
  const script = '<script src="docker-shell.js"></script>';
  if (html.includes('docker-shell.js')) return html;
  if (html.includes(marker)) {
    return html.replace(marker, `${script}\n    ${marker}`);
  }
  return html.replace('</body>', `    ${script}\n</body>`);
}

async function publicDataScript() {
  const data = await loadCombinedData();
  return `window.__INKUBATOR_DATA__ = ${JSON.stringify(data)};\n`;
}

function loginPageHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self';">
    <title>Inkubator Admin</title>
    <link rel="icon" type="image/png" sizes="64x64" href="/assets/brand/inkubator-logo-transparent.png">
    <link rel="stylesheet" href="/style.css">
    <script src="/docker-shell.js" defer></script>
</head>
<body class="docker-login-page theme-dark">
    <div id="docker-login-root"></div>
</body>
</html>`;
}

async function serveAdminStatic(req, res, pathname) {
  if (pathname.startsWith('/api/images/')) {
    const relative = decodeURIComponent(pathname.slice('/api/images/'.length));
    return serveManagedImage(res, relative);
  }

  let adminPath = pathname.startsWith('/admin') ? pathname.slice('/admin'.length) : pathname;
  let relative = decodeURIComponent(adminPath.replace(/^\/+/, '')) || 'index.html';
  if (relative.endsWith('/')) relative += 'index.html';
  let target = path.normalize(path.join(APP_DIR, relative));
  if (!isInside(APP_DIR, target) || !(await pathExists(target))) {
    target = path.join(APP_DIR, 'index.html');
  }
  if (path.basename(target) === 'index.html') {
    let html = await fs.readFile(target, 'utf8');
    html = addHeadBase(html, '/admin/');
    if (!html.includes('docker-api.js')) {
      html = html.replace('<script src="tauri-api.js"></script>', '<script src="docker-api.js"></script>\n    <script src="tauri-api.js"></script>');
    }
    html = injectDockerShell(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return true;
  }
  res.writeHead(200, { 'Content-Type': mimeFor(target) });
  fssync.createReadStream(target).pipe(res);
  return true;
}

async function servePublicStatic(req, res, pathname) {
  if (pathname === '/data.js') {
    const script = await publicDataScript();
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(script);
    return true;
  }

  if (pathname.startsWith('/images/')) {
    const relative = decodeURIComponent(pathname.slice('/images/'.length));
    return serveManagedImage(res, relative);
  }

  let relative = decodeURIComponent(pathname.replace(/^\/+/, '')) || 'index.html';
  if (relative.endsWith('/')) relative += 'index.html';
  let target = path.normalize(path.join(APP_DIR, relative));
  if (!isInside(APP_DIR, target) || !(await pathExists(target))) {
    target = path.join(APP_DIR, 'index.html');
  }

  if (['docker-api.js', 'tauri-api.js'].includes(path.basename(target))) {
    return false;
  }

  if (path.basename(target) === 'index.html') {
    let html = await fs.readFile(target, 'utf8');
    html = html.replace(/\s*<script src="tauri-api\.js"><\/script>\n?/g, '\n');
    if (!html.includes('src="data.js"')) {
      html = html.replace('<script src="renderer.js"></script>', '<script src="data.js"></script>\n    <script src="renderer.js"></script>');
    }
    html = injectDockerShell(html);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return true;
  }

  res.writeHead(200, { 'Content-Type': mimeFor(target) });
  fssync.createReadStream(target).pipe(res);
  return true;
}

async function initStorage() {
  await ensureDir(DATA_DIR);
  await ensureDir(paths.images);
  for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(paths.images, dir));
  await ensureDir(paths.exports);
  if (!(await pathExists(paths.data))) await writeJson(paths.data, defaultCollectionData());
  if (!(await pathExists(paths.preferences))) await writeJson(paths.preferences, defaultPreferences());
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      if (!isValidLogin(String(payload.username || ''), String(payload.password || ''))) {
        return sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
      }
      createSession(res);
      return sendJson(res, 200, { success: true });
    }
    if (url.pathname === '/auth/logout' && req.method === 'POST') {
      clearSession(req, res);
      return sendJson(res, 200, { success: true });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!isAuthorized(req)) return unauthorized(res);
      if (url.pathname.startsWith('/api/images/')) {
        const relative = decodeURIComponent(url.pathname.slice('/api/images/'.length));
        if (!(await serveManagedImage(res, relative))) {
          return sendJson(res, 404, { success: false, message: 'Image not found.' });
        }
        return;
      }
      const handled = await handleApi(req, res, url.pathname);
      if (handled === false) return sendJson(res, 404, { success: false, message: 'Not found.' });
      return;
    }

    if (url.pathname === '/admin') {
      res.writeHead(302, { Location: '/admin/' });
      res.end();
      return;
    }

    if (url.pathname.startsWith('/admin/')) {
      if (!isSessionAuthorized(req) && (url.pathname === '/admin/' || url.pathname === '/admin/index.html')) {
        res.writeHead(302, { Location: '/?login=1' });
        res.end();
        return;
      }
      if (!isSessionAuthorized(req)) return unauthorized(res);
      if (!(await serveAdminStatic(req, res, url.pathname))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found.');
      }
      return;
    }

    if (!(await servePublicStatic(req, res, url.pathname))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found.');
    }
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { success: false, message: error.message || 'Server error.' });
  }
});

initStorage().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Inkubator Docker admin listening on http://0.0.0.0:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
