#!/usr/bin/env node
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const zlib = require('node:zlib');
const yazl = require('yazl');

const { normalizeAppData } = require('../lib/data-schema');
const {
  collectReferencedImageRelativePaths,
  copyReferencedImages,
  disposeManagedImage,
  normalizeManagedRelativeImagePath
} = require('../lib/critical-persistence');
const {
  backupError,
  commitStagedImport,
  extractBackupZip,
  receiveRequestToFile,
  regenerateThumbnails
} = require('../lib/backup-archive');
const {
  backupPolicy,
  pruneBackupDirectories,
  shouldCreateBackup
} = require('../lib/backup-schedule');
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
const MAX_BACKUP_BYTES = Number(process.env.INKUBATOR_MAX_BACKUP_BYTES || 1024 * 1024 * 1024);
const MAX_BACKUP_EXPANDED_BYTES = Number(process.env.INKUBATOR_MAX_BACKUP_EXPANDED_BYTES || 2 * 1024 * 1024 * 1024);
const MAX_BACKUP_ENTRIES = Number(process.env.INKUBATOR_MAX_BACKUP_ENTRIES || 20000);
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
const VERSION = require('../package.json').version;
const RELEASE_TAG = process.env.INKUBATOR_RELEASE_TAG || `v${VERSION}`;
const GITHUB_RELEASES_URL = 'https://github.com/aloglu/inkubator/releases';
const GITHUB_CONTAINER_URL = 'https://github.com/aloglu/inkubator/pkgs/container/inkubator';
const DOCKER_IMAGE = process.env.INKUBATOR_IMAGE || `ghcr.io/aloglu/inkubator:${VERSION}`;
const SESSION_COOKIE = 'inkubator_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const assetFingerprintCache = new Map();

if (require.main === module && !ADMIN_PASSWORD && process.env.INKUBATOR_ALLOW_INSECURE !== '1') {
  console.error('INKUBATOR_ADMIN_PASSWORD is required for Docker admin mode.');
  console.error('Set INKUBATOR_ALLOW_INSECURE=1 only for local throwaway testing.');
  process.exit(1);
}

const paths = {
  data: path.join(DATA_DIR, 'data.json'),
  preferences: path.join(DATA_DIR, 'preferences.json'),
  images: path.join(DATA_DIR, 'images'),
  thumbnails: path.join(DATA_DIR, 'images', '.thumbs'),
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

function thumbnailPathFor(normalized) {
  const target = path.normalize(path.join(paths.thumbnails, normalized));
  if (!normalized || !isInside(paths.thumbnails, target)) throw new Error('Invalid thumbnail path.');
  return target;
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

function isCompressibleType(contentType) {
  return /^(text\/|application\/json|application\/javascript|application\/xml|image\/svg\+xml|font\/)/i.test(String(contentType || ''));
}

function negotiateEncoding(req) {
  const accepted = String(req.headers['accept-encoding'] || '').toLowerCase();
  if (/\bbr\b/.test(accepted)) return 'br';
  if (/\bgzip\b/.test(accepted)) return 'gzip';
  return '';
}

function encodeBody(req, body, contentType) {
  if (!isCompressibleType(contentType) || body.length < 1024) {
    return { body };
  }
  const encoding = negotiateEncoding(req);
  if (encoding === 'br') {
    return {
      body: zlib.brotliCompressSync(body, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5
        }
      }),
      encoding
    };
  }
  if (encoding === 'gzip') {
    return { body: zlib.gzipSync(body, { level: 6 }), encoding };
  }
  return { body };
}

function fileEtag(stat) {
  return `W/"${Math.round(stat.mtimeMs).toString(16)}-${Number(stat.size).toString(16)}"`;
}

function bodyEtag(body) {
  return `W/"${createHash('sha256').update(body).digest('base64url').slice(0, 24)}"`;
}

function contentFingerprint(body) {
  return createHash('sha256').update(body).digest('base64url').slice(0, 16);
}

async function fileFingerprint(filePath, stat = null) {
  const currentStat = stat || await fs.stat(filePath);
  const key = `${filePath}:${currentStat.size}:${Math.round(currentStat.mtimeMs)}`;
  const cached = assetFingerprintCache.get(filePath);
  if (cached && cached.key === key) return cached.value;
  const value = contentFingerprint(await fs.readFile(filePath));
  assetFingerprintCache.set(filePath, { key, value });
  return value;
}

function parseAssetReference(rawValue) {
  const raw = String(rawValue || '');
  if (
    !raw ||
    raw.startsWith('#') ||
    raw.startsWith('?') ||
    raw.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(raw)
  ) {
    return null;
  }

  const hashIndex = raw.indexOf('#');
  const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const queryIndex = beforeHash.indexOf('?');
  const pathname = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  const normalized = pathname.replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || normalized.split(/[\\/]+/).includes('..')) return null;
  const target = path.normalize(path.join(APP_DIR, normalized));
  if (!isInside(APP_DIR, target)) return null;
  return { raw, pathname, query, hash, normalized, target };
}

function buildVersionedReference(parts, fingerprint) {
  const params = new URLSearchParams(parts.query);
  params.set('v', fingerprint);
  return `${parts.pathname}?${params.toString()}${parts.hash}`;
}

async function versionAssetReference(rawValue) {
  const parts = parseAssetReference(rawValue);
  if (!parts || !(await pathExists(parts.target))) return String(rawValue || '');
  const stat = await fs.stat(parts.target);
  if (!stat.isFile()) return String(rawValue || '');
  return buildVersionedReference(parts, await fileFingerprint(parts.target, stat));
}

async function versionHtmlAssetReferences(html) {
  const values = [...String(html || '').matchAll(/\b(src|href)="([^"]+)"/g)].map((match) => match[2]);
  const replacements = new Map();
  for (const value of new Set(values)) {
    const versioned = await versionAssetReference(value);
    if (versioned !== value) replacements.set(value, versioned);
  }
  return String(html || '').replace(/\b(src|href)="([^"]+)"/g, (match, attr, value) => {
    return `${attr}="${replacements.get(value) || value}"`;
  });
}

async function cacheControlForFileRequest(req, filePath, stat) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const requested = url.searchParams.get('v');
  if (requested && requested === await fileFingerprint(filePath, stat)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, no-cache';
}

function splitEtags(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requestHasFreshValidator(req, headers) {
  const etags = splitEtags(req.headers['if-none-match']);
  if (etags.includes('*') || etags.includes(headers.ETag)) return true;

  const modifiedSince = req.headers['if-modified-since'];
  if (modifiedSince && headers['Last-Modified']) {
    const since = Date.parse(modifiedSince);
    const modified = Date.parse(headers['Last-Modified']);
    if (!Number.isNaN(since) && !Number.isNaN(modified) && modified <= since) return true;
  }
  return false;
}

function writeNotModified(res, headers) {
  const out = { ...headers };
  delete out['Content-Length'];
  delete out['Content-Encoding'];
  res.writeHead(304, out);
  res.end();
}

function addVary(headers, value) {
  const existing = String(headers.Vary || '');
  const parts = existing.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (!parts.includes(String(value).toLowerCase())) {
    headers.Vary = existing ? `${existing}, ${value}` : value;
  }
}

function sendBuffer(req, res, status, body, headers) {
  const source = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''));
  const contentType = headers['Content-Type'] || headers['content-type'] || 'application/octet-stream';
  if (isCompressibleType(contentType)) addVary(headers, 'Accept-Encoding');
  if (status === 200 && headers.ETag && requestHasFreshValidator(req, headers)) {
    writeNotModified(res, headers);
    return;
  }
  const encoded = encodeBody(req, source, contentType);
  const out = {
    ...headers,
    'Content-Length': encoded.body.length
  };
  if (encoded.encoding) out['Content-Encoding'] = encoded.encoding;
  res.writeHead(status, out);
  res.end(encoded.body);
}

async function sendFile(req, res, filePath, options = {}) {
  const stat = await fs.stat(filePath);
  const contentType = options.contentType || mimeFor(filePath);
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': options.cacheControl || await cacheControlForFileRequest(req, filePath, stat),
    'Last-Modified': stat.mtime.toUTCString(),
    ETag: fileEtag(stat)
  };
  if (isCompressibleType(contentType)) addVary(headers, 'Accept-Encoding');
  if (requestHasFreshValidator(req, headers)) {
    writeNotModified(res, headers);
    return;
  }
  sendBuffer(req, res, 200, await fs.readFile(filePath), headers);
}

function sendHtml(req, res, html, cacheControl = 'no-cache') {
  const body = Buffer.from(String(html || ''));
  sendBuffer(req, res, 200, html, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cacheControl,
    ETag: bodyEtag(body)
  });
}

function sendScript(req, res, script, cacheControl = 'no-cache') {
  const body = Buffer.from(String(script || ''));
  sendBuffer(req, res, 200, script, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': cacheControl,
    ETag: bodyEtag(body)
  });
}

function sendJson(req, res, status, payload) {
  const body = JSON.stringify(payload);
  sendBuffer(req, res, status, body, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
}

function sendPlain(res, status, body) {
  const text = String(body || '');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
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

function unauthorized(req, res) {
  sendJson(req, res, 401, { success: false, message: 'Authentication required.' });
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

async function pruneShowcaseOnlyAssets(root) {
  for (const relative of [
    'assets/brand/inkubator-logo-background-source.png',
    'assets/brand/inkubator-logo-transparent-source.png',
    'assets/icons/ink-drop-white.source.png'
  ]) {
    await removeIfExists(path.join(root, relative));
  }
}

async function writeThumbnailFor(normalized, thumbnailBase64) {
  if (!thumbnailBase64) return;
  const target = thumbnailPathFor(normalized);
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, Buffer.from(String(thumbnailBase64 || ''), 'base64'));
}

async function createAutoBackup(reason, options = {}) {
  const collection = await readJson(paths.data, defaultCollectionData());
  const preferences = await readJson(paths.preferences, defaultPreferences());
  const policy = backupPolicy(preferences);
  const dir = path.join(paths.backups, 'auto');
  await ensureDir(dir);
  const latest = await latestValidLocalBackup();
  if (!shouldCreateBackup({
    frequency: policy.frequency,
    lastBackupAt: latest ? latest.modified : null,
    force: !!options.force
  })) {
    return { created: false, reason: 'not-due' };
  }

  const folder = path.join(dir, `auto-${Date.now()}-${reason}-${randomUUID()}`);
  try {
    await createBackupFolder(folder, collection, preferences, {
      type: 'inkubator-auto-backup',
      reason,
      includeReplacedImages: policy.keepReplacedImages
    });
    await pruneBackupDirectories({ fs, root: dir, retention: policy.retention });
    return { created: true, path: folder };
  } catch (error) {
    await removeIfExists(folder);
    throw error;
  }
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
  const relative = `${folder}/${filename}`;
  await fs.writeFile(path.join(dir, filename), Buffer.from(String(payload.bytesBase64 || ''), 'base64'));
  await writeThumbnailFor(relative, payload.thumbnailBase64);
  return relative;
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
  const relative = `${folder}/${name}`;
  await fs.writeFile(path.join(dir, name), bytes);
  await writeThumbnailFor(relative, payload.thumbnailBase64);
  return relative;
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
  const includeReplacedImages = typeof manifestOptions.includeReplacedImages === 'boolean'
    ? manifestOptions.includeReplacedImages
    : !!(preferences && preferences.backup && preferences.backup.keep_replaced_images);
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
  const hasReplacedImages = includeReplacedImages && await pathExists(paths.replacedImages);
  if (hasReplacedImages) {
    await copyDir(paths.replacedImages, path.join(folder, 'replaced-images'));
  }
  await writeJson(path.join(folder, 'manifest.json'), {
    type: manifestOptions.type || 'inkubator-backup',
    version: 3,
    created_at: new Date().toISOString(),
    reason: manifestOptions.reason || undefined,
    includes_images: true,
    includes_replaced_images: hasReplacedImages,
    includes_preferences: true
  });
}

function backupManifest(preferences, options = {}) {
  const includeReplacedImages = typeof options.includeReplacedImages === 'boolean'
    ? options.includeReplacedImages
    : !!(preferences && preferences.backup && preferences.backup.keep_replaced_images);
  return {
    type: options.type || 'inkubator-backup',
    version: 3,
    created_at: new Date().toISOString(),
    reason: options.reason || undefined,
    includes_images: true,
    includes_replaced_images: includeReplacedImages,
    includes_preferences: true
  };
}

function zipJson(zip, name, value) {
  zip.addBuffer(Buffer.from(`${JSON.stringify(value, null, 2)}\n`), name, {
    compress: true,
    compressionLevel: 6
  });
}

async function addReferencedImagesToZip(zip, collection) {
  for (const relativePath of collectReferencedImageRelativePaths(collection)) {
    const normalized = normalizeManagedRelativeImagePath(relativePath);
    if (!normalized) continue;
    const source = path.normalize(path.join(paths.images, normalized));
    if (!isInside(paths.images, source) || !(await pathExists(source))) continue;
    zip.addFile(source, `images/${normalized}`, { compress: false });
  }
}

async function addDirectoryToZip(zip, sourceRoot, archiveRoot) {
  if (!(await pathExists(sourceRoot))) return;
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const source = path.join(sourceRoot, entry.name);
    const archivePath = `${archiveRoot}/${entry.name}`.replace(/\\/g, '/');
    if (entry.isDirectory()) await addDirectoryToZip(zip, source, archivePath);
    else if (entry.isFile()) zip.addFile(source, archivePath, { compress: false });
  }
}

async function streamBackupZip(res) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `inkubator-backup-${stamp}.zip`;
  const collection = await readJson(paths.data, defaultCollectionData());
  const preferences = await readJson(paths.preferences, defaultPreferences());
  const manifest = backupManifest(preferences, { type: 'inkubator-backup' });
  const zip = new yazl.ZipFile();
  zipJson(zip, 'data.json', collection);
  zipJson(zip, 'preferences.json', preferences);
  zipJson(zip, 'manifest.json', manifest);
  await addReferencedImagesToZip(zip, collection);
  if (manifest.includes_replaced_images) {
    await addDirectoryToZip(zip, paths.replacedImages, 'replaced-images');
  }

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store'
  });
  const completed = pipeline(zip.outputStream, res);
  zip.end();
  await completed;
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

async function importBackupFromZip(zipPath, options = {}) {
  const suffix = `${Date.now()}-${randomUUID()}`;
  const manualRoot = path.join(paths.backups, 'manual');
  const stage = path.join(manualRoot, `.import-stage-${suffix}`);
  const rollback = path.join(DATA_DIR, `.import-rollback-${suffix}`);
  await ensureDir(manualRoot);
  try {
    await extractBackupZip(zipPath, stage, {
      maxEntries: MAX_BACKUP_ENTRIES,
      maxExpandedBytes: MAX_BACKUP_EXPANDED_BYTES
    });
    const incomingDataPath = path.join(stage, 'data.json');
    const incomingPreferencesPath = path.join(stage, 'preferences.json');
    if (!(await pathExists(incomingDataPath)) || !(await pathExists(incomingPreferencesPath))) {
      return { success: false, message: 'Selected backup is not valid.' };
    }

    const incomingCollection = JSON.parse(await fs.readFile(incomingDataPath, 'utf8'));
    const incomingPreferences = JSON.parse(await fs.readFile(incomingPreferencesPath, 'utf8'));
    if (options?.auto_validate_import !== false) {
      const valid = Array.isArray(incomingCollection.pens)
        && Array.isArray(incomingCollection.inks)
        && Array.isArray(incomingCollection.currently_inked);
      if (!valid) {
        return { success: false, message: 'Import validation failed: invalid data shape.' };
      }
    }
    const normalized = normalizeAppData({ ...incomingCollection, preferences: incomingPreferences });
    const collection = stripPreferences(normalized);
    const preferences = normalized.preferences;
    await writeJson(incomingDataPath, collection);
    await writeJson(incomingPreferencesPath, preferences);

    const stagedImages = path.join(stage, 'images');
    const stagedThumbnails = path.join(stagedImages, '.thumbs');
    const stagedReplacedImages = path.join(stage, 'replaced-images');
    await ensureDir(stagedImages);
    await ensureDir(stagedReplacedImages);
    for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(stagedImages, dir));
    const thumbnailResult = await regenerateThumbnails({
      imagesRoot: stagedImages,
      thumbnailsRoot: stagedThumbnails,
      relativePaths: collectReferencedImageRelativePaths(collection),
      concurrency: 4
    });
    for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(stagedThumbnails, dir));

    await createAutoBackup('pre-import-restore', { force: true });
    await commitStagedImport({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [
        { name: 'data.json', staged: incomingDataPath, target: paths.data },
        { name: 'preferences.json', staged: incomingPreferencesPath, target: paths.preferences },
        { name: 'images', staged: stagedImages, target: paths.images },
        { name: 'replaced-images', staged: stagedReplacedImages, target: paths.replacedImages }
      ]
    });

    const result = {
      success: true,
      data: combine(collection, preferences),
      thumbnails: thumbnailResult
    };
    const warnings = [];
    if (thumbnailResult.failed > 0) {
      warnings.push(`${thumbnailResult.failed} thumbnail${thumbnailResult.failed === 1 ? '' : 's'} could not be generated`);
    }
    try {
      await createAutoBackup('post-import-restore', { force: true });
    } catch (error) {
      warnings.push(`the post-import restore snapshot failed: ${error.message}`);
    }
    if (warnings.length > 0) {
      result.warning = true;
      result.message = `Backup imported, but ${warnings.join('; ')}.`;
    }
    return result;
  } finally {
    await removeIfExists(stage);
    await removeIfExists(rollback);
  }
}

async function exportShowcase() {
  const showcase = path.join(paths.exports, 'showcase');
  const stage = path.join(paths.exports, `.showcase-${Date.now()}`);
  await removeIfExists(stage);
  await ensureDir(stage);
  await copyDir(APP_DIR, stage);
  await pruneShowcaseOnlyAssets(stage);
  await removeIfExists(path.join(stage, 'docker-api.js'));
  await removeIfExists(path.join(stage, 'docker-shell.js'));
  await removeIfExists(path.join(stage, 'tauri-api.js'));
  let html = await fs.readFile(path.join(stage, 'index.html'), 'utf8');
  html = html.replace(/\s*<script src="tauri-api\.js"><\/script>\n?/g, '\n');
  if (!html.includes('src="data.js"')) {
    html = html.replace('<script src="renderer.js"></script>', '<script src="data.js"></script>\n    <script src="renderer.js"></script>');
  }
  const data = await loadCombinedData();
  html = injectPublicColorMode(html, showcaseColorModeFromData(data));
  html = await versionHtmlAssetReferences(html);
  await fs.writeFile(path.join(stage, 'index.html'), html);
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
  await copyReferencedImages({
    fs: {
      ensureDir,
      pathExists,
      copy: fs.cp
    },
    sourceRoot: paths.images,
    destinationRoot: path.join(stage, 'thumbs'),
    relativePaths: collectReferencedImageRelativePaths(stripPreferences(data))
  });
  await copyReferencedImages({
    fs: {
      ensureDir,
      pathExists,
      copy: fs.cp
    },
    sourceRoot: paths.thumbnails,
    destinationRoot: path.join(stage, 'thumbs'),
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
  const response = await fetch('https://api.github.com/repos/aloglu/inkubator/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `inkubator/${VERSION}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    return {
      success: false,
      currentVersion: VERSION,
      currentTag: RELEASE_TAG,
      distribution: 'docker',
      dockerImage: DOCKER_IMAGE,
      containerUrl: GITHUB_CONTAINER_URL,
      releasesUrl: GITHUB_RELEASES_URL,
      message: `GitHub API responded with ${response.status}.`
    };
  }
  const release = await response.json();
  const latestVersion = resolveReleaseVersion(release);
  const versionState = getReleaseVersionState(VERSION, latestVersion, release.tag_name, RELEASE_TAG);
  return {
    success: true,
    currentVersion: VERSION,
    currentTag: RELEASE_TAG,
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
    currentTag: RELEASE_TAG,
    distribution: 'docker',
    dockerImage: DOCKER_IMAGE,
    containerUrl: GITHUB_CONTAINER_URL,
    releasesUrl: GITHUB_RELEASES_URL
  };
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') return sendJson(req, res, 200, { success: true });
  if (req.method === 'GET' && pathname === '/api/app-info') return sendJson(req, res, 200, appInfo());
  if (req.method === 'GET' && pathname === '/api/data') return sendJson(req, res, 200, await loadCombinedData());
  if (req.method === 'POST' && pathname === '/api/data') return sendJson(req, res, 200, await saveCombinedData((await readJsonBody(req)).data));
  if (req.method === 'POST' && pathname === '/api/save-image-bytes') return sendJson(req, res, 200, await saveImageBytes(await readJsonBody(req)));
  if (req.method === 'POST' && pathname === '/api/read-remote-image-bytes') return sendJson(req, res, 200, await readRemoteImageBytes(await readJsonBody(req)));
  if (req.method === 'POST' && pathname === '/api/save-image-url') return sendJson(req, res, 200, { success: true, filename: await saveRemoteImage(await readJsonBody(req)) });
  if (req.method === 'POST' && pathname === '/api/delete-image') {
    const { relativePath } = await readJsonBody(req);
    const { normalized, target } = safeImagePath(relativePath);
    await fs.rm(target, { force: true });
    await fs.rm(thumbnailPathFor(normalized), { force: true });
    return sendJson(req, res, 200, { success: true });
  }
  if (req.method === 'POST' && pathname === '/api/dispose-replaced-image') {
    const { relativePath } = await readJsonBody(req);
    const { normalized } = safeImagePath(relativePath);
    const result = await disposeManagedImage({
      fs: { pathExists, remove: fs.rm, move: fs.rename, ensureDir },
      imagesRoot: paths.images,
      archiveRoot: paths.replacedImages,
      imagePath: relativePath,
      keepArchived: true
    });
    await fs.rm(thumbnailPathFor(normalized), { force: true });
    return sendJson(req, res, 200, result);
  }
  if (req.method === 'GET' && pathname === '/api/backup-status') {
    const autoDir = path.join(paths.backups, 'auto');
    const entries = (await pathExists(autoDir)) ? await fs.readdir(autoDir, { withFileTypes: true }) : [];
    const latest = await latestValidLocalBackup();
    return sendJson(req, res, 200, {
      success: true,
      count: entries.filter((entry) => entry.isDirectory()).length,
      latest: latest ? { name: latest.name, path: latest.folder, updated_at: latest.updated_at } : null
    });
  }
  if (req.method === 'POST' && pathname === '/api/export-backup') {
    await streamBackupZip(res);
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/import-backup') {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!['application/zip', 'application/octet-stream'].includes(contentType)) {
      throw backupError('Backup import requires a ZIP file body.', 415);
    }
    const manualRoot = path.join(paths.backups, 'manual');
    const uploadPath = path.join(manualRoot, `.upload-${Date.now()}-${randomUUID()}.zip`);
    await ensureDir(manualRoot);
    try {
      await receiveRequestToFile(req, uploadPath, MAX_BACKUP_BYTES);
      const result = await importBackupFromZip(uploadPath, {
        auto_validate_import: String(req.headers['x-inkubator-auto-validate'] || '1') !== '0',
        conflict_behavior: 'overwrite'
      });
      return sendJson(req, res, result.success ? 200 : 400, result);
    } finally {
      await fs.rm(uploadPath, { force: true });
    }
  }
  if (req.method === 'POST' && pathname === '/api/export-showcase') {
    return sendJson(req, res, 410, { success: false, message: 'Showcase export is unavailable in Docker mode because the public website is served directly.' });
  }
  if (req.method === 'GET' && pathname === '/api/release-status') return sendJson(req, res, 200, await releaseStatus());
  if (req.method === 'POST' && pathname === '/api/fetch-inkswatch') return sendJson(req, res, 200, await fetchInkSwatch((await readJsonBody(req)).query || ''));
  return false;
}

async function serveManagedImage(req, res, relativePath) {
  const { target } = safeImagePath(relativePath);
  if (!(await pathExists(target))) return false;
  await sendFile(req, res, target, { cacheControl: 'public, no-cache' });
  return true;
}

async function serveManagedThumbnail(req, res, relativePath) {
  const { normalized, target: imageTarget } = safeImagePath(relativePath);
  if (!(await pathExists(imageTarget))) return false;
  const thumbnailTarget = thumbnailPathFor(normalized);
  await sendFile(req, res, (await pathExists(thumbnailTarget)) ? thumbnailTarget : imageTarget, {
    cacheControl: 'public, no-cache'
  });
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

function showcaseColorModeFromData(data) {
  const mode = String(data?.preferences?.showcase?.color_mode || 'auto').toLowerCase();
  return ['light', 'dark', 'auto'].includes(mode) ? mode : 'auto';
}

function injectPublicColorMode(html, mode) {
  const value = showcaseColorModeFromData({ preferences: { showcase: { color_mode: mode } } });
  if (html.includes('data-inkubator-public-color-mode=')) {
    return html.replace(/data-inkubator-public-color-mode="[^"]*"/, `data-inkubator-public-color-mode="${value}"`);
  }
  return html.replace(/<html(\s[^>]*)?>/i, (match) => match.replace('<html', `<html data-inkubator-public-color-mode="${value}"`));
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
    return serveManagedImage(req, res, relative);
  }
  if (pathname.startsWith('/api/thumbs/')) {
    const relative = decodeURIComponent(pathname.slice('/api/thumbs/'.length));
    return serveManagedThumbnail(req, res, relative);
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
    html = await versionHtmlAssetReferences(html);
    sendHtml(req, res, html);
    return true;
  }
  await sendFile(req, res, target);
  return true;
}

async function servePublicStatic(req, res, pathname) {
  if (pathname === '/data.js') {
    const script = await publicDataScript();
    sendScript(req, res, script);
    return true;
  }

  if (pathname.startsWith('/images/')) {
    const relative = decodeURIComponent(pathname.slice('/images/'.length));
    return serveManagedImage(req, res, relative);
  }

  if (pathname.startsWith('/thumbs/')) {
    const relative = decodeURIComponent(pathname.slice('/thumbs/'.length));
    return serveManagedThumbnail(req, res, relative);
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
    const data = await loadCombinedData();
    html = html.replace(/\s*<script src="tauri-api\.js"><\/script>\n?/g, '\n');
    if (!html.includes('src="data.js"')) {
      html = html.replace('<script src="renderer.js"></script>', '<script src="data.js"></script>\n    <script src="renderer.js"></script>');
    }
    html = injectPublicColorMode(html, showcaseColorModeFromData(data));
    html = injectDockerShell(html);
    html = await versionHtmlAssetReferences(html);
    sendHtml(req, res, html);
    return true;
  }

  await sendFile(req, res, target);
  return true;
}

async function initStorage() {
  await ensureDir(DATA_DIR);
  await ensureDir(paths.images);
  await ensureDir(paths.thumbnails);
  for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(paths.images, dir));
  for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(paths.thumbnails, dir));
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
        return sendJson(req, res, 401, { success: false, message: 'Invalid username or password.' });
      }
      createSession(res);
      return sendJson(req, res, 200, { success: true });
    }
    if (url.pathname === '/auth/logout' && req.method === 'POST') {
      clearSession(req, res);
      return sendJson(req, res, 200, { success: true });
    }

    if (url.pathname.startsWith('/api/')) {
      if (!isAuthorized(req)) return unauthorized(req, res);
      if (url.pathname.startsWith('/api/images/')) {
        const relative = decodeURIComponent(url.pathname.slice('/api/images/'.length));
        if (!(await serveManagedImage(req, res, relative))) {
          return sendJson(req, res, 404, { success: false, message: 'Image not found.' });
        }
        return;
      }
      if (url.pathname.startsWith('/api/thumbs/')) {
        const relative = decodeURIComponent(url.pathname.slice('/api/thumbs/'.length));
        if (!(await serveManagedThumbnail(req, res, relative))) {
          return sendJson(req, res, 404, { success: false, message: 'Thumbnail not found.' });
        }
        return;
      }
      const handled = await handleApi(req, res, url.pathname);
      if (handled === false) return sendJson(req, res, 404, { success: false, message: 'Not found.' });
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
      if (!isSessionAuthorized(req)) return unauthorized(req, res);
      if (!(await serveAdminStatic(req, res, url.pathname))) {
        sendPlain(res, 404, 'Not found.');
      }
      return;
    }

    if (!(await servePublicStatic(req, res, url.pathname))) {
      sendPlain(res, 404, 'Not found.');
    }
  } catch (error) {
    console.error(error);
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    sendJson(req, res, Number(error.statusCode) || 500, { success: false, message: error.message || 'Server error.' });
  }
});

if (require.main === module) {
  initStorage().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Inkubator Docker admin listening on http://0.0.0.0:${PORT}`);
      console.log(`Data directory: ${DATA_DIR}`);
    });
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  encodeBody,
  fileEtag,
  fileFingerprint,
  isCompressibleType,
  requestHasFreshValidator,
  sendBuffer,
  sendFile,
  server,
  versionAssetReference,
  versionHtmlAssetReferences
};
