#!/usr/bin/env node
const fs = require('node:fs/promises');
const dns = require('node:dns/promises');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const zlib = require('node:zlib');
const yazl = require('yazl');

const { normalizeAppData } = require('../lib/data-schema');
const {
  atomicWriteJson,
  createSerializedExecutor,
  disposeManagedImage,
  normalizeManagedRelativeImagePath
} = require('../lib/critical-persistence');
const {
  backupError,
  clearMissingLegacyInkSwatchAliases,
  collectManagedRasterReferencePaths,
  commitStagedImport,
  extractBackupZip,
  imageReferenceValues,
  normalizeSafeManagedRasterPath,
  readDirectoryIfExists,
  receiveRequestToFile,
  recoverInterruptedTransaction,
  regenerateThumbnails,
  requireManagedRasterFiles,
  resolveManagedDirectory,
  resolveManagedRasterFile,
  syncDirectory,
  syncFile,
  syncTree,
  validateManagedRasterReferences,
  validateRasterImageBuffer,
  validateRasterImageFile
} = require('../lib/backup-archive');
const {
  backupPolicy,
  completeBackupDirectories,
  pruneBackupDirectories,
  shouldCreateBackup
} = require('../lib/backup-schedule');
const {
  getReleaseVersionState,
  resolveReleaseVersion
} = require('../lib/release-version');
const { projectPublicData } = require('../lib/public-data');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const DATA_DIR = path.resolve(process.env.INKUBATOR_DATA_DIR || process.env.DATA_DIR || '/data');
const PORT = Number(process.env.PORT || process.env.INKUBATOR_PORT || 8080);
const ADMIN_USER = process.env.INKUBATOR_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.INKUBATOR_ADMIN_PASSWORD || '';
const MAX_BODY_BYTES = Number(process.env.INKUBATOR_MAX_BODY_BYTES || 120 * 1024 * 1024);
const MAX_BACKUP_BYTES = Number(process.env.INKUBATOR_MAX_BACKUP_BYTES || 1024 * 1024 * 1024);
const MAX_BACKUP_EXPANDED_BYTES = Number(process.env.INKUBATOR_MAX_BACKUP_EXPANDED_BYTES || 2 * 1024 * 1024 * 1024);
const MAX_BACKUP_ENTRIES = Number(process.env.INKUBATOR_MAX_BACKUP_ENTRIES || 20000);
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_REMOTE_IMAGE_REDIRECTS = 5;
const REMOTE_IMAGE_TIMEOUT_MS = 15000;
const VERSION = require('../package.json').version;
const RELEASE_TAG = process.env.INKUBATOR_RELEASE_TAG || `v${VERSION}`;
const GITHUB_RELEASES_URL = 'https://github.com/aloglu/inkubator/releases';
const GITHUB_CONTAINER_URL = 'https://github.com/aloglu/inkubator/pkgs/container/inkubator';
const DOCKER_IMAGE = process.env.INKUBATOR_IMAGE || `ghcr.io/aloglu/inkubator:${VERSION}`;
const SESSION_COOKIE = 'inkubator_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_REVISION_KEY = '_inkubator_storage_revision';
const sessions = new Map();
const assetFingerprintCache = new Map();
const serializeLiveStateOperation = createSerializedExecutor();
let storageTransactionsRecovered = false;

async function ensureStorageTransactionsRecovered() {
  if (storageTransactionsRecovered) return;
  try {
    await recoverInterruptedStorageTransactions();
    storageTransactionsRecovered = true;
  } catch (cause) {
    const error = requestError(
      `Storage recovery must complete before collection data can be used: ${cause.message}`,
      503
    );
    error.cause = cause;
    throw error;
  }
}

function runLiveStateOperation(operation) {
  return serializeLiveStateOperation(async () => {
    await ensureStorageTransactionsRecovered();
    return operation();
  });
}

async function commitLiveStorageTransaction(options) {
  try {
    const result = await commitStagedImport(options);
    if (result && result.recoveryRequired) storageTransactionsRecovered = false;
    return result;
  } catch (error) {
    if (error && error.rollbackRoot) storageTransactionsRecovered = false;
    throw error;
  }
}

const REMOTE_IMAGE_MIME_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif']
]);
const REMOTE_ADDRESS_BLOCKLIST = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
]) {
  REMOTE_ADDRESS_BLOCKLIST.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8]
]) {
  REMOTE_ADDRESS_BLOCKLIST.addSubnet(network, prefix, 'ipv6');
}

function isRejectedAdminPassword(password) {
  const normalized = String(password || '').trim().toLowerCase();
  return !normalized || normalized === 'change-this-password';
}

if (require.main === module) {
  const insecureLocalMode = process.env.INKUBATOR_ALLOW_INSECURE === '1' && !ADMIN_PASSWORD;
  if (!insecureLocalMode && isRejectedAdminPassword(ADMIN_PASSWORD)) {
    console.error('INKUBATOR_ADMIN_PASSWORD is required and must not use the published placeholder.');
    console.error('Set INKUBATOR_ALLOW_INSECURE=1 only for local throwaway testing without a password.');
    process.exit(1);
  }
}

const paths = {
  data: path.join(DATA_DIR, 'data.json'),
  preferences: path.join(DATA_DIR, 'preferences.json'),
  images: path.join(DATA_DIR, 'images'),
  thumbnails: path.join(DATA_DIR, 'images', '.thumbs'),
  replacedImages: path.join(DATA_DIR, 'replaced-images'),
  backups: path.join(DATA_DIR, 'backups')
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

function stripStorageMetadata(preferences) {
  const clone = {
    ...(preferences && typeof preferences === 'object' ? preferences : defaultPreferences())
  };
  delete clone[STORAGE_REVISION_KEY];
  return clone;
}

function preferencesWithNewStorageRevision(preferences) {
  return {
    ...stripStorageMetadata(preferences),
    [STORAGE_REVISION_KEY]: randomUUID()
  };
}

function combine(collection, preferences) {
  return {
    ...(collection || defaultCollectionData()),
    preferences: stripStorageMetadata(preferences)
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function lstatPathExists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await atomicWriteJson(file, value);
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

function boundedImageStem(parts, maxLength = 160) {
  const stem = parts.map(sanitizeSlug).join('-');
  if (stem.length <= maxLength) return stem;
  const digest = createHash('sha256').update(stem).digest('hex').slice(0, 10);
  const prefix = stem
    .slice(0, Math.max(1, maxLength - digest.length - 1))
    .replace(/[-_]+$/g, '');
  return `${prefix}-${digest}`;
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
    const stem = boundedImageStem([
      metadataString(metadata, 'brand', 'unknown'),
      metadataString(metadata, 'model', 'pen'),
      metadataString(metadata, 'nib', 'standard'),
      metadataString(metadata, 'color', 'standard')
    ]);
    return nextNumberedFilename(dir, stem);
  }
  if (imageType === 'swatch') {
    const stem = boundedImageStem([
      metadataString(metadata, 'brand', 'unknown'),
      metadataString(metadata, 'model', 'swatch')
    ]);
    return `${stem}-${Date.now()}-${randomUUID().replace(/-/g, '')}.webp`;
  }
  const stem = boundedImageStem([
    metadataString(metadata, 'brand', 'unknown'),
    metadataString(metadata, 'model', 'ink')
  ]);
  if (!(await pathExists(path.join(dir, `${stem}.webp`)))) return `${stem}.webp`;
  let next = 2;
  while (true) {
    const filename = `${stem}-${next}.webp`;
    if (!(await pathExists(path.join(dir, filename)))) return filename;
    next += 1;
  }
}

async function uniqueAvailableFilename(dir, proposedName) {
  if (!(await pathExists(path.join(dir, proposedName)))) return proposedName;
  const parsed = path.parse(proposedName);
  let next = 2;
  while (true) {
    const candidate = `${parsed.name}-${next}${parsed.ext}`;
    if (!(await pathExists(path.join(dir, candidate)))) return candidate;
    next += 1;
  }
}

async function uniqueAvailableFilenameAcross(directories, proposedName) {
  const isAvailable = async (filename) => {
    for (const directory of directories) {
      if (await lstatPathExists(path.join(directory, filename))) return false;
    }
    return true;
  };
  if (await isAvailable(proposedName)) return proposedName;

  const parsed = path.parse(proposedName);
  let next = 2;
  while (true) {
    const candidate = `${parsed.name}-${next}${parsed.ext}`;
    if (await isAvailable(candidate)) return candidate;
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
  const normalized = normalizeSafeManagedRasterPath(relativePath);
  const target = path.normalize(path.join(paths.images, normalized));
  if (!normalized || !isInside(paths.images, target)) {
    throw requestError('Invalid or unsupported image path.', 400);
  }
  return { normalized, target };
}

async function resolveExistingManagedImage(root, relativePath, statusCode = 400) {
  return resolveManagedRasterFile({
    imagesRoot: root,
    relativePath,
    missingStatusCode: statusCode
  });
}

async function ensureManagedArchiveDirectory(directory) {
  const relative = path.relative(paths.replacedImages, directory);
  if (!isInside(paths.replacedImages, directory)) {
    throw requestError('Invalid replaced-image archive path.', 400);
  }
  return resolveManagedDirectory({
    root: paths.replacedImages,
    relativePath: relative.split(path.sep).join('/'),
    create: true,
    statusCode: 400
  });
}

async function removeResolvedManagedFile(resolved) {
  if (!resolved) return false;
  await fs.rm(resolved.target, { force: true });
  await syncDirectory(fs, path.dirname(resolved.target));
  return true;
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
  if (ext === '.heic') return 'image/heic';
  if (ext === '.heif') return 'image/heif';
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

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function firstForwardedValue(value) {
  return String(Array.isArray(value) ? value[0] : value || '')
    .split(',')[0]
    .trim();
}

function requestUsesHttps(req) {
  const forwardedProtocol = firstForwardedValue(req.headers['x-forwarded-proto']).toLowerCase();
  return forwardedProtocol
    ? forwardedProtocol === 'https'
    : !!(req.socket && req.socket.encrypted);
}

function expectedRequestOrigin(req) {
  const host = firstForwardedValue(req.headers['x-forwarded-host'])
    || firstForwardedValue(req.headers.host);
  if (!host) return '';
  const protocol = firstForwardedValue(req.headers['x-forwarded-proto']).toLowerCase()
    || (requestUsesHttps(req) ? 'https' : 'http');
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch (_) {
    return '';
  }
}

function enforceBrowserMutationRequest(req) {
  const fetchSite = firstForwardedValue(req.headers['sec-fetch-site']).toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin') {
    throw requestError('Cross-origin browser requests are not allowed.', 403);
  }

  const origin = firstForwardedValue(req.headers.origin);
  if (!origin) return;
  let normalizedOrigin = '';
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch (_) {
    throw requestError('Invalid request origin.', 403);
  }
  const expectedOrigin = expectedRequestOrigin(req);
  if (!expectedOrigin || normalizedOrigin !== expectedOrigin) {
    throw requestError('Cross-origin browser requests are not allowed.', 403);
  }
}

function applySecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.secure) parts.push('Secure');
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

function createSession(req, res) {
  cleanupSessions();
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, { createdAt: Date.now() });
  res.setHeader('Set-Cookie', cookieHeader(SESSION_COOKIE, encodeURIComponent(token), {
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: requestUsesHttps(req)
  }));
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', cookieHeader(SESSION_COOKIE, '', {
    maxAge: 0,
    secure: requestUsesHttps(req)
  }));
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

function requestContentType(req) {
  return String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
}

async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  const declaredSize = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw requestError('Request body is too large.', 413);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw requestError('Request body is too large.', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(req) {
  if (requestContentType(req) !== 'application/json') {
    throw requestError('Request body must use application/json.', 415);
  }
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch (_) {
    throw requestError('Request body must contain valid JSON.', 400);
  }
}

async function removeIfExists(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function removeIfExistsBestEffort(target, context) {
  try {
    await removeIfExists(target);
    return null;
  } catch (error) {
    console.warn(`${context}: ${target}`, error);
    return error;
  }
}

async function writeThumbnailFor(normalized, thumbnailBase64) {
  if (!thumbnailBase64) return;
  const directory = await resolveManagedDirectory({
    root: paths.thumbnails,
    relativePath: path.posix.dirname(normalized),
    statusCode: 400
  });
  const target = path.join(directory, path.posix.basename(normalized));
  await fs.writeFile(
    target,
    Buffer.from(String(thumbnailBase64 || ''), 'base64'),
    { flag: 'wx' }
  );
  await syncFile(fs, target);
  await syncDirectory(fs, directory);
}

async function removeFailedImageArtifacts(imageTarget, thumbnailTarget) {
  const failures = [];
  for (const target of [imageTarget, thumbnailTarget]) {
    try {
      await fs.rm(target, { force: true });
      await syncDirectory(fs, path.dirname(target));
    } catch (error) {
      failures.push(`${target}: ${error.message}`);
    }
  }
  if (failures.length) {
    throw new Error(`Could not clean up failed image save: ${failures.join('; ')}`);
  }
}

async function writeImageWithThumbnail(
  imageTarget,
  relativePath,
  imageBytes,
  thumbnailBase64,
  writeThumbnail = writeThumbnailFor,
  fileSystem = fs
) {
  const thumbnailTarget = thumbnailPathFor(relativePath);
  let imageCreated = false;
  try {
    await fileSystem.writeFile(imageTarget, imageBytes, { flag: 'wx' });
    imageCreated = true;
    await syncFile(fileSystem, imageTarget);
    await syncDirectory(fileSystem, path.dirname(imageTarget));
    await writeThumbnail(relativePath, thumbnailBase64);
  } catch (error) {
    if (!imageCreated && error && error.code === 'EEXIST') throw error;
    try {
      await removeFailedImageArtifacts(imageTarget, thumbnailTarget);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Thumbnail save failed and image cleanup was incomplete: ${error.message}`
      );
    }
    throw error;
  }
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

  const token = `${Date.now()}-${reason}-${randomUUID()}`;
  const folder = path.join(dir, `auto-${token}`);
  const staging = path.join(dir, `.auto-stage-${token}`);
  let promoted = false;
  try {
    await createBackupFolder(staging, collection, preferences, {
      type: 'inkubator-auto-backup',
      reason,
      includeReplacedImages: policy.keepReplacedImages
    });
    await syncTree(fs, staging);
    await fs.rename(staging, folder);
    await syncDirectory(fs, dir);
    promoted = true;
    await pruneBackupDirectories({ fs, root: dir, retention: policy.retention });
    return { created: true, path: folder };
  } catch (error) {
    if (!promoted) await removeIfExists(staging);
    throw error;
  }
}

async function loadCombinedData() {
  return combine(
    await readJson(paths.data, defaultCollectionData()),
    await readJson(paths.preferences, defaultPreferences())
  );
}

async function loadPublicData() {
  return projectPublicData(await loadCombinedData());
}

async function loadRevisionedData() {
  const collection = await readJson(paths.data, defaultCollectionData());
  const storedPreferences = await readJson(paths.preferences, defaultPreferences());
  const data = combine(collection, storedPreferences);
  return {
    data,
    revision: contentFingerprint(Buffer.from(JSON.stringify({
      collection,
      preferences: storedPreferences
    })))
  };
}

function dataConflict(revision) {
  return {
    success: false,
    code: 'DATA_CONFLICT',
    conflict: true,
    revision,
    message: 'Collection data changed since it was loaded. Reload before saving again.'
  };
}

async function saveCombinedData(data) {
  const normalized = normalizeAppData(data);
  const collection = stripPreferences(normalized);
  validateManagedRasterReferences(imageReferenceValues(collection), { strict: true });
  await requireManagedRasterFiles({
    imagesRoot: paths.images,
    relativePaths: collectManagedRasterReferencePaths(collection, { strict: true })
  });
  const storedPreferences = preferencesWithNewStorageRevision(normalized.preferences);
  const suffix = `${Date.now()}-${randomUUID()}`;
  const stage = path.join(DATA_DIR, `.collection-save-stage-${suffix}`);
  const rollback = path.join(DATA_DIR, `.collection-save-rollback-${suffix}`);
  const stagedData = path.join(stage, 'data.json');
  const stagedPreferences = path.join(stage, 'preferences.json');
  const warnings = [];
  await ensureDir(stage);
  try {
    await writeJson(stagedData, collection);
    await writeJson(stagedPreferences, storedPreferences);
    const commitResult = await commitLiveStorageTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [
        { kind: 'file', name: 'data.json', staged: stagedData, target: paths.data },
        {
          kind: 'file',
          name: 'preferences.json',
          staged: stagedPreferences,
          target: paths.preferences
        }
      ]
    });
    if (commitResult.cleanupErrors.length > 0) {
      warnings.push('transaction staging cleanup was incomplete');
    }
  } finally {
    await removeIfExistsBestEffort(stage, 'Collection-save staging cleanup failed');
  }

  try {
    await createAutoBackup('save-data');
  } catch (backupError) {
    warnings.push(`a backup step failed: ${backupError.message}`);
  }
  if (warnings.length > 0) {
    return {
      success: true,
      warning: true,
      message: `Data and preferences saved, but ${warnings.join('; ')}.`
    };
  }
  return { success: true };
}

async function saveCombinedDataIfCurrent(data, expectedRevision) {
  const current = await loadRevisionedData();
  if (String(expectedRevision || '') !== current.revision) {
    return dataConflict(current.revision);
  }

  const result = await saveCombinedData(data);
  const saved = await loadRevisionedData();
  return { ...result, revision: saved.revision };
}

async function saveImageBytes(payload) {
  const imageBytes = Buffer.from(String(payload.bytesBase64 || ''), 'base64');
  try {
    await validateRasterImageBuffer(imageBytes, 'upload.webp');
  } catch (cause) {
    throw requestError(`Image upload is not a valid WebP image: ${cause.message}`, 415);
  }
  if (payload.thumbnailBase64) {
    try {
      await validateRasterImageBuffer(
        Buffer.from(String(payload.thumbnailBase64), 'base64'),
        'thumbnail.webp'
      );
    } catch (cause) {
      throw requestError(`Image thumbnail is not a valid WebP image: ${cause.message}`, 415);
    }
  }
  const imageType = payload.imageType || 'ink';
  const folder = imageFolder(imageType);
  const dir = await resolveManagedDirectory({
    root: paths.images,
    relativePath: folder,
    statusCode: 400
  });
  const thumbnailDir = await resolveManagedDirectory({
    root: paths.thumbnails,
    relativePath: folder,
    statusCode: 400
  });
  const proposedName = await imageFilename(imageType, payload.metadata || {}, dir);
  const filename = await uniqueAvailableFilenameAcross([dir, thumbnailDir], proposedName);
  const relative = `${folder}/${filename}`;
  await writeImageWithThumbnail(
    path.join(dir, filename),
    relative,
    imageBytes,
    payload.thumbnailBase64
  );
  return relative;
}

function normalizedRemoteHostname(url) {
  const hostname = String(url.hostname || '');
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function validateRemoteImageUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    throw requestError('Remote image URL is invalid.', 400);
  }
  if (url.protocol !== 'https:') {
    throw requestError('Only https URLs are allowed for remote images.', 400);
  }
  if (url.username || url.password) {
    throw requestError('Remote image URLs cannot contain credentials.', 400);
  }
  return url;
}

function isBlockedRemoteAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return REMOTE_ADDRESS_BLOCKLIST.check(address, 'ipv4');
  if (family === 6) {
    if (String(address).toLowerCase().startsWith('::ffff:')) return true;
    return REMOTE_ADDRESS_BLOCKLIST.check(address, 'ipv6');
  }
  return true;
}

async function lookupRemoteAddresses(hostname, lookup = dns.lookup) {
  const family = net.isIP(hostname);
  if (family) return [{ address: hostname, family }];
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch (_) {
    throw requestError('Remote image host could not be resolved.', 400);
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw requestError('Remote image host could not be resolved.', 400);
  }
  return addresses;
}

async function resolveAllowedRemoteAddress(url, lookup) {
  const hostname = normalizedRemoteHostname(url);
  const addresses = await lookupRemoteAddresses(hostname, lookup);
  for (const item of addresses) {
    const address = String(item && item.address || '');
    if (!net.isIP(address) || isBlockedRemoteAddress(address)) {
      throw requestError('Remote image URLs cannot use private or local network addresses.', 400);
    }
  }
  return {
    address: String(addresses[0].address),
    family: Number(addresses[0].family) || net.isIP(addresses[0].address)
  };
}

function requestRemoteImageResponse(url, resolvedAddress, signal) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      family: resolvedAddress.family,
      headers: {
        Accept: [...REMOTE_IMAGE_MIME_EXTENSIONS.keys()].join(', '),
        'User-Agent': `inkubator/${VERSION}`
      },
      lookup(_hostname, _options, callback) {
        callback(null, resolvedAddress.address, resolvedAddress.family);
      },
      method: 'GET',
      signal
    }, resolve);
    request.once('error', reject);
    request.end();
  });
}

function remoteImageMimeType(response) {
  return String(response.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

async function readRemoteResponseBytes(response, maxBytes) {
  const contentLength = String(response.headers['content-length'] || '').trim();
  if (/^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    response.destroy();
    throw requestError('Remote image is too large.', 413);
  }

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response) {
      size += chunk.length;
      if (size > maxBytes) {
        throw requestError('Remote image is too large.', 413);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    response.destroy();
    throw error;
  }
  return Buffer.concat(chunks);
}

async function downloadRemoteImage(value, options = {}) {
  const maxBytes = Number(options.maxBytes || MAX_REMOTE_IMAGE_BYTES);
  const maxRedirects = Number(options.maxRedirects ?? MAX_REMOTE_IMAGE_REDIRECTS);
  const lookup = options.lookup || dns.lookup;
  const requestResponse = options.requestResponse || requestRemoteImageResponse;
  const signal = options.signal || AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS);
  let url = validateRemoteImageUrl(value);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const resolvedAddress = await resolveAllowedRemoteAddress(url, lookup);
    let response;
    try {
      response = await requestResponse(url, resolvedAddress, signal);
    } catch (error) {
      if (signal.aborted || error?.name === 'AbortError') {
        throw requestError('Remote image request timed out.', 504);
      }
      throw requestError('Remote image request failed.', 502);
    }

    const status = Number(response.statusCode || 0);
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = String(response.headers.location || '');
      response.destroy();
      if (!location) throw requestError('Remote image redirect is missing its destination.', 502);
      if (redirectCount >= maxRedirects) {
        throw requestError('Remote image has too many redirects.', 400);
      }
      try {
        url = validateRemoteImageUrl(new URL(location, url).href);
      } catch (error) {
        if (error && error.statusCode) throw error;
        throw requestError('Remote image redirect is invalid.', 502);
      }
      continue;
    }
    if (status < 200 || status >= 300) {
      response.destroy();
      throw requestError(`Failed to fetch image: ${status || 'unknown response'}`, 502);
    }

    const mimeType = remoteImageMimeType(response);
    if (!REMOTE_IMAGE_MIME_EXTENSIONS.has(mimeType)) {
      response.destroy();
      throw requestError('Remote URL did not return a supported raster image.', 415);
    }
    let bytes;
    try {
      bytes = await readRemoteResponseBytes(response, maxBytes);
    } catch (error) {
      if (signal.aborted || error?.name === 'AbortError') {
        throw requestError('Remote image request timed out.', 504);
      }
      if (error && error.statusCode) throw error;
      throw requestError('Remote image request failed while reading its response.', 502);
    }
    if (bytes.length === 0) {
      throw requestError('Remote image response was empty.', 502);
    }
    return {
      bytes,
      mimeType,
      sourceUrl: url.href,
      sourceHint: url.pathname
    };
  }
  throw requestError('Remote image has too many redirects.', 400);
}

async function saveRemoteImage(payload, download = downloadRemoteImage) {
  const remote = await download(payload.url);
  const imageType = payload.imageType || 'swatch';
  const folder = imageFolder(imageType);
  const ext = REMOTE_IMAGE_MIME_EXTENSIONS.get(remote.mimeType);
  if (!ext) throw requestError('Remote image type is unsupported.', 415);
  try {
    await validateRasterImageBuffer(remote.bytes, `remote${ext}`);
  } catch (cause) {
    throw requestError(`Remote image contents do not match ${remote.mimeType}: ${cause.message}`, 415);
  }
  if (payload.thumbnailBase64) {
    try {
      await validateRasterImageBuffer(
        Buffer.from(String(payload.thumbnailBase64), 'base64'),
        'thumbnail.webp'
      );
    } catch (cause) {
      throw requestError(`Image thumbnail is not a valid WebP image: ${cause.message}`, 415);
    }
  }
  const dir = await resolveManagedDirectory({
    root: paths.images,
    relativePath: folder,
    statusCode: 400
  });
  const thumbnailDir = await resolveManagedDirectory({
    root: paths.thumbnails,
    relativePath: folder,
    statusCode: 400
  });
  const proposedName = (await imageFilename(imageType, payload.metadata || {}, dir))
    .replace(/\.webp$/, ext);
  const name = await uniqueAvailableFilenameAcross([dir, thumbnailDir], proposedName);
  const relative = `${folder}/${name}`;
  await writeImageWithThumbnail(path.join(dir, name), relative, remote.bytes, payload.thumbnailBase64);
  return relative;
}

async function readRemoteImageBytes(payload) {
  const remote = await downloadRemoteImage(payload.url);
  return {
    success: true,
    base64: remote.bytes.toString('base64'),
    sourceUrl: remote.sourceUrl,
    sourceHint: remote.sourceHint,
    mimeType: remote.mimeType
  };
}

async function liveCollectionReferencesImage(normalizedPath) {
  const collection = await readJson(paths.data, defaultCollectionData());
  return imageReferenceValues(collection).some(
    (value) => normalizeManagedRelativeImagePath(value) === normalizedPath
  );
}

async function copyValidatedReferencedImages(collection, destinationRoot) {
  const relativePaths = collectManagedRasterReferencePaths(collection, { strict: true });
  validateManagedRasterReferences(imageReferenceValues(collection), { strict: true });
  const validatedPaths = await requireManagedRasterFiles({
    imagesRoot: paths.images,
    relativePaths,
    validateContents: true,
    missingStatusCode: 409
  });
  await ensureDir(destinationRoot);
  for (const relativePath of validatedPaths) {
    const resolved = await resolveExistingManagedImage(paths.images, relativePath, 409);
    if (!resolved) {
      throw backupError(`Referenced image disappeared during backup: images/${relativePath}`, 409);
    }
    const destination = path.join(destinationRoot, relativePath);
    await ensureDir(path.dirname(destination));
    await fs.copyFile(resolved.target, destination);
  }
}

async function copyManagedFiles(relativePaths, sourceRoot, destinationRoot, options = {}) {
  await ensureDir(destinationRoot);
  for (const relativePath of relativePaths) {
    const resolved = await resolveExistingManagedImage(sourceRoot, relativePath, 409);
    if (!resolved) {
      if (options.requireAll) {
        throw backupError(`Referenced image is missing: ${relativePath}`, 409);
      }
      continue;
    }
    const destination = path.join(
      destinationRoot,
      `${relativePath}${options.destinationSuffix || ''}`
    );
    await ensureDir(path.dirname(destination));
    await fs.copyFile(resolved.target, destination);
  }
}

async function copyValidatedManagedMediaTree(sourceRoot, destinationRoot, relativeRoot = '') {
  if (!(await lstatPathExists(sourceRoot))) return;
  const currentRoot = await resolveManagedDirectory({
    root: sourceRoot,
    relativePath: relativeRoot,
    statusCode: 409
  });
  const entries = await fs.readdir(currentRoot, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await copyValidatedManagedMediaTree(sourceRoot, destinationRoot, relativePath);
      continue;
    }
    if (entry.isSymbolicLink()) {
      throw backupError(`Replaced-image storage contains a symbolic link: ${relativePath}`, 409);
    }
    if (!entry.isFile()) continue;
    const normalized = normalizeSafeManagedRasterPath(relativePath);
    if (!normalized) continue;
    const resolved = await resolveExistingManagedImage(sourceRoot, normalized, 409);
    if (!resolved) {
      throw backupError(`Replaced image disappeared during backup: ${normalized}`, 409);
    }
    await validateRasterImageFile(resolved.target, `replaced-images/${normalized}`);
    const destination = path.join(destinationRoot, normalized);
    await ensureDir(path.dirname(destination));
    await fs.copyFile(resolved.target, destination);
  }
}

async function createBackupFolder(folder, collection, preferences, manifestOptions = {}) {
  await ensureDir(folder);
  await writeJson(path.join(folder, 'data.json'), collection);
  await writeJson(path.join(folder, 'preferences.json'), stripStorageMetadata(preferences));
  const includeReplacedImages = typeof manifestOptions.includeReplacedImages === 'boolean'
    ? manifestOptions.includeReplacedImages
    : !!(preferences && preferences.backup && preferences.backup.keep_replaced_images);
  await copyValidatedReferencedImages(collection, path.join(folder, 'images'));
  const hasReplacedImages = includeReplacedImages && await pathExists(paths.replacedImages);
  if (hasReplacedImages) {
    await copyValidatedManagedMediaTree(
      paths.replacedImages,
      path.join(folder, 'replaced-images')
    );
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
  const relativePaths = collectManagedRasterReferencePaths(collection, { strict: true });
  validateManagedRasterReferences(imageReferenceValues(collection), { strict: true });
  const validatedPaths = await requireManagedRasterFiles({
    imagesRoot: paths.images,
    relativePaths,
    validateContents: true,
    missingStatusCode: 409
  });
  for (const relativePath of validatedPaths) {
    const resolved = await resolveExistingManagedImage(paths.images, relativePath, 409);
    if (!resolved) {
      throw backupError(`Referenced image disappeared during backup: images/${relativePath}`, 409);
    }
    zip.addFile(resolved.target, `images/${relativePath}`, { compress: false });
  }
}

async function addDirectoryToZip(zip, sourceRoot, archiveRoot, relativeRoot = '') {
  if (!(await lstatPathExists(sourceRoot))) return;
  const currentRoot = await resolveManagedDirectory({
    root: sourceRoot,
    relativePath: relativeRoot,
    statusCode: 409
  });
  const entries = await fs.readdir(currentRoot, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relativePath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, sourceRoot, archiveRoot, relativePath);
    } else if (entry.isSymbolicLink()) {
      throw backupError(`Replaced-image storage contains a symbolic link: ${relativePath}`, 409);
    } else if (entry.isFile()) {
      const normalized = normalizeSafeManagedRasterPath(relativePath);
      if (!normalized) continue;
      const resolved = await resolveExistingManagedImage(sourceRoot, normalized, 409);
      if (!resolved) {
        throw backupError(`Replaced image disappeared during backup: ${normalized}`, 409);
      }
      await validateRasterImageFile(resolved.target, `replaced-images/${normalized}`);
      zip.addFile(resolved.target, `replaced-images/${normalized}`, { compress: false });
    }
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
  zipJson(zip, 'preferences.json', stripStorageMetadata(preferences));
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
  const candidates = await completeBackupDirectories({ fs, root: autoDir });
  const latest = candidates[0];
  if (!latest) return null;
  return {
    folder: latest.target,
    name: path.basename(latest.target),
    updated_at: new Date(latest.modified).toISOString(),
    modified: latest.modified
  };
}

async function readBackupJson(file, label) {
  const contents = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(contents);
  } catch (_) {
    throw backupError(`Backup ${label} must contain valid JSON.`);
  }
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

    const incomingCollection = await readBackupJson(incomingDataPath, 'data.json');
    const incomingPreferences = await readBackupJson(
      incomingPreferencesPath,
      'preferences.json'
    );
    if (
      !incomingCollection
      || typeof incomingCollection !== 'object'
      || Array.isArray(incomingCollection)
      || !incomingPreferences
      || typeof incomingPreferences !== 'object'
      || Array.isArray(incomingPreferences)
    ) {
      return {
        success: false,
        message: 'Import validation failed: data and preferences must be JSON objects.'
      };
    }
    validateManagedRasterReferences(imageReferenceValues(incomingCollection), { strict: true });
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
    const preferences = stripStorageMetadata(normalized.preferences);
    const storedPreferences = preferencesWithNewStorageRevision(preferences);
    const stagedImages = path.join(stage, 'images');
    const stagedThumbnails = path.join(stagedImages, '.thumbs');
    const stagedReplacedImages = path.join(stage, 'replaced-images');
    await ensureDir(stagedImages);
    await ensureDir(stagedReplacedImages);
    for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(stagedImages, dir));
    await clearMissingLegacyInkSwatchAliases({
      collection,
      imagesRoot: stagedImages
    });
    validateManagedRasterReferences(imageReferenceValues(collection), { strict: true });
    await writeJson(incomingDataPath, collection);
    await writeJson(incomingPreferencesPath, storedPreferences);

    const referencedImages = collectManagedRasterReferencePaths(collection, { strict: true });
    await requireManagedRasterFiles({
      imagesRoot: stagedImages,
      relativePaths: referencedImages
    });
    const thumbnailResult = await regenerateThumbnails({
      imagesRoot: stagedImages,
      thumbnailsRoot: stagedThumbnails,
      relativePaths: referencedImages,
      concurrency: 4
    });
    for (const dir of ['pens', 'inks', 'swatches']) await ensureDir(path.join(stagedThumbnails, dir));

    const warnings = [];
    try {
      await createAutoBackup('pre-import-restore', { force: true });
    } catch (error) {
      warnings.push(`the pre-import restore snapshot failed: ${error.message}`);
    }
    const commitResult = await commitLiveStorageTransaction({
      stagedRoot: stage,
      rollbackRoot: rollback,
      targets: [
        { kind: 'file', name: 'data.json', staged: incomingDataPath, target: paths.data },
        {
          kind: 'file',
          name: 'preferences.json',
          staged: incomingPreferencesPath,
          target: paths.preferences
        },
        { kind: 'directory', name: 'images', staged: stagedImages, target: paths.images },
        {
          kind: 'directory',
          name: 'replaced-images',
          staged: stagedReplacedImages,
          target: paths.replacedImages
        }
      ]
    });
    if (commitResult.cleanupErrors.length > 0) {
      warnings.push('transaction staging cleanup was incomplete');
    }

    const result = {
      success: true,
      data: combine(collection, preferences),
      thumbnails: thumbnailResult
    };
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
    await removeIfExistsBestEffort(stage, 'Backup-import staging cleanup failed');
  }
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
  if (req.method === 'GET' && pathname === '/api/data') {
    const current = await runLiveStateOperation(loadRevisionedData);
    return sendJson(req, res, 200, { success: true, ...current });
  }
  if (req.method === 'POST' && pathname === '/api/data') {
    const { data, expectedRevision } = await readJsonBody(req);
    const result = await runLiveStateOperation(() => saveCombinedDataIfCurrent(data, expectedRevision));
    return sendJson(req, res, result.conflict ? 409 : 200, result);
  }
  if (req.method === 'POST' && pathname === '/api/save-image-bytes') {
    const payload = await readJsonBody(req);
    return sendJson(req, res, 200, await runLiveStateOperation(() => saveImageBytes(payload)));
  }
  if (req.method === 'POST' && pathname === '/api/read-remote-image-bytes') return sendJson(req, res, 200, await readRemoteImageBytes(await readJsonBody(req)));
  if (req.method === 'POST' && pathname === '/api/save-image-url') {
    const payload = await readJsonBody(req);
    const filename = await runLiveStateOperation(() => saveRemoteImage(payload));
    return sendJson(req, res, 200, { success: true, filename });
  }
  if (req.method === 'POST' && pathname === '/api/delete-image') {
    const { relativePath } = await readJsonBody(req);
    const result = await runLiveStateOperation(async () => {
      const { normalized } = safeImagePath(relativePath);
      if (await liveCollectionReferencesImage(normalized)) {
        return {
          success: true,
          action: 'referenced',
          relativePath: normalized
        };
      }
      const image = await resolveExistingManagedImage(paths.images, normalized);
      const thumbnail = await resolveExistingManagedImage(paths.thumbnails, normalized);
      const imageDeleted = await removeResolvedManagedFile(image);
      await removeResolvedManagedFile(thumbnail);
      return {
        success: true,
        action: imageDeleted ? 'deleted' : 'missing',
        relativePath: normalized
      };
    });
    return sendJson(req, res, 200, result);
  }
  if (req.method === 'POST' && pathname === '/api/dispose-replaced-image') {
    const { relativePath } = await readJsonBody(req);
    const result = await runLiveStateOperation(async () => {
      const { normalized } = safeImagePath(relativePath);
      if (await liveCollectionReferencesImage(normalized)) {
        return {
          success: true,
          action: 'referenced',
          relativePath: normalized
        };
      }
      const preferences = await readJson(paths.preferences, defaultPreferences());
      const keepArchived = !!(preferences && preferences.backup && preferences.backup.keep_replaced_images);
      const image = await resolveExistingManagedImage(paths.images, normalized);
      const thumbnail = await resolveExistingManagedImage(paths.thumbnails, normalized);
      const disposed = await disposeManagedImage({
        fs: {
          lstat: fs.lstat,
          pathExists: lstatPathExists,
          remove: fs.rm,
          move: fs.rename
        },
        imagesRoot: paths.images,
        archiveRoot: paths.replacedImages,
        imagePath: normalized,
        keepArchived,
        ensureArchiveDirectory: ensureManagedArchiveDirectory,
        syncDirectory: (directory) => syncDirectory(fs, directory)
      });
      if (image && disposed.action === 'missing') {
        throw requestError('Managed image changed while it was being archived.', 409);
      }
      await removeResolvedManagedFile(thumbnail);
      return disposed;
    });
    return sendJson(req, res, 200, result);
  }
  if (req.method === 'GET' && pathname === '/api/backup-status') {
    const status = await runLiveStateOperation(async () => {
      const autoDir = path.join(paths.backups, 'auto');
      const backups = (await pathExists(autoDir))
        ? await completeBackupDirectories({ fs, root: autoDir })
        : [];
      const latest = await latestValidLocalBackup();
      return {
        success: true,
        count: backups.length,
        latest: latest
          ? { name: latest.name, path: latest.folder, updated_at: latest.updated_at }
          : null
      };
    });
    return sendJson(req, res, 200, status);
  }
  if (req.method === 'POST' && pathname === '/api/export-backup') {
    await runLiveStateOperation(() => streamBackupZip(res));
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/import-backup') {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!['application/zip', 'application/octet-stream'].includes(contentType)) {
      throw backupError('Backup import requires a ZIP file body.', 415);
    }
    const manualRoot = path.join(paths.backups, 'manual');
    const uploadPath = path.join(manualRoot, `.upload-${Date.now()}-${randomUUID()}.zip`);
    const expectedRevision = String(req.headers['x-inkubator-expected-revision'] || '');
    await ensureDir(manualRoot);
    try {
      await receiveRequestToFile(req, uploadPath, MAX_BACKUP_BYTES);
      const result = await runLiveStateOperation(async () => {
        const current = await loadRevisionedData();
        if (expectedRevision !== current.revision) {
          return dataConflict(current.revision);
        }
        const imported = await importBackupFromZip(uploadPath, {
          auto_validate_import: String(req.headers['x-inkubator-auto-validate'] || '1') !== '0',
          conflict_behavior: 'overwrite'
        });
        if (!imported.success) return imported;
        const saved = await loadRevisionedData();
        return { ...imported, revision: saved.revision };
      });
      return sendJson(req, res, result.conflict ? 409 : result.success ? 200 : 400, result);
    } finally {
      await removeIfExistsBestEffort(uploadPath, 'Backup-upload cleanup failed');
    }
  }
  if (req.method === 'POST' && pathname === '/api/export-showcase') {
    return sendJson(req, res, 410, { success: false, message: 'Showcase export is unavailable in Docker mode because the public website is served directly.' });
  }
  if (req.method === 'GET' && pathname === '/api/release-status') return sendJson(req, res, 200, await releaseStatus());
  if (req.method === 'POST' && pathname === '/api/fetch-inkswatch') return sendJson(req, res, 200, await fetchInkSwatch((await readJsonBody(req)).query || ''));
  return false;
}

async function serveManagedImage(req, res, relativePath, options = {}) {
  const { normalized } = safeImagePath(relativePath);
  const resolved = await resolveExistingManagedImage(
    paths.images,
    normalized,
    options.unsafeStatusCode || 400
  );
  if (!resolved) return false;
  await sendFile(req, res, resolved.target, {
    cacheControl: options.cacheControl || 'public, no-cache'
  });
  return true;
}

async function serveManagedThumbnail(req, res, relativePath, options = {}) {
  const { normalized } = safeImagePath(relativePath);
  const unsafeStatusCode = options.unsafeStatusCode || 400;
  const image = await resolveExistingManagedImage(paths.images, normalized, unsafeStatusCode);
  if (!image) return false;
  const thumbnail = await resolveExistingManagedImage(
    paths.thumbnails,
    normalized,
    unsafeStatusCode
  );
  await sendFile(req, res, thumbnail ? thumbnail.target : image.target, {
    cacheControl: options.cacheControl || 'public, no-cache',
    contentType: thumbnail ? 'image/webp' : undefined
  });
  return true;
}

async function isPublicManagedMedia(relativePath, publicData) {
  const normalized = normalizeSafeManagedRasterPath(relativePath);
  if (!normalized) return false;
  const referenced = new Set(collectManagedRasterReferencePaths(publicData));
  return referenced.has(normalized);
}

async function servePublicManagedMedia(req, res, relativePath, thumbnail = false) {
  return runLiveStateOperation(async () => {
    const publicData = await loadPublicData();
    if (!(await isPublicManagedMedia(relativePath, publicData))) return false;
    return thumbnail
      ? serveManagedThumbnail(req, res, relativePath, { unsafeStatusCode: 404 })
      : serveManagedImage(req, res, relativePath, { unsafeStatusCode: 404 });
  });
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
  const data = await runLiveStateOperation(loadPublicData);
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
    return runLiveStateOperation(
      () => serveManagedImage(req, res, relative, { cacheControl: 'private, no-cache' })
    );
  }
  if (pathname.startsWith('/api/thumbs/')) {
    const relative = decodeURIComponent(pathname.slice('/api/thumbs/'.length));
    return runLiveStateOperation(
      () => serveManagedThumbnail(req, res, relative, { cacheControl: 'private, no-cache' })
    );
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

  if (pathname === '/data.json') {
    const data = await runLiveStateOperation(loadPublicData);
    sendJson(req, res, 200, data);
    return true;
  }

  if (pathname.startsWith('/images/')) {
    const relative = decodeURIComponent(pathname.slice('/images/'.length));
    return servePublicManagedMedia(req, res, relative);
  }

  if (pathname.startsWith('/thumbs/')) {
    const relative = decodeURIComponent(pathname.slice('/thumbs/'.length));
    return servePublicManagedMedia(req, res, relative, true);
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
    const data = await runLiveStateOperation(loadPublicData);
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

async function validateStoredJsonObject(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${file} must be a regular file and cannot be a symbolic link.`);
  }
  let value;
  try {
    value = await readJson(file, null);
  } catch (error) {
    throw new Error(`Could not load ${file}: ${error.message}`, { cause: error });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file} must contain a JSON object.`);
  }
}

function collectionSaveTargets(stage) {
  return [
    {
      kind: 'file',
      name: 'data.json',
      staged: path.join(stage, 'data.json'),
      target: paths.data
    },
    {
      kind: 'file',
      name: 'preferences.json',
      staged: path.join(stage, 'preferences.json'),
      target: paths.preferences
    }
  ];
}

function backupImportTargets(stage) {
  return [
    {
      kind: 'file',
      name: 'data.json',
      staged: path.join(stage, 'data.json'),
      target: paths.data
    },
    {
      kind: 'file',
      name: 'preferences.json',
      staged: path.join(stage, 'preferences.json'),
      target: paths.preferences
    },
    {
      kind: 'directory',
      name: 'images',
      staged: path.join(stage, 'images'),
      target: paths.images
    },
    {
      kind: 'directory',
      name: 'replaced-images',
      staged: path.join(stage, 'replaced-images'),
      target: paths.replacedImages
    }
  ];
}

function storageTransactionSuffix(name) {
  return String(name || '')
    .replace(/^\.collection-save-(?:rollback|stage)-/, '')
    .replace(/^\.import-(?:rollback|stage)-/, '');
}

function sortStorageTransactionEntries(entries) {
  return [...entries].sort((left, right) => {
    const bySuffix = storageTransactionSuffix(left.name)
      .localeCompare(storageTransactionSuffix(right.name));
    return bySuffix || left.name.localeCompare(right.name);
  });
}

async function recoverInterruptedStorageTransactions() {
  const rootEntries = sortStorageTransactionEntries(
    await readDirectoryIfExists(fs, DATA_DIR, { withFileTypes: true })
  );
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.collection-save-rollback-')) {
      const suffix = entry.name.slice('.collection-save-rollback-'.length);
      const stage = path.join(DATA_DIR, `.collection-save-stage-${suffix}`);
      await recoverInterruptedTransaction({
        stagedRoot: stage,
        rollbackRoot: path.join(DATA_DIR, entry.name),
        targets: collectionSaveTargets(stage)
      });
    } else if (entry.name.startsWith('.import-rollback-')) {
      const suffix = entry.name.slice('.import-rollback-'.length);
      const stage = path.join(paths.backups, 'manual', `.import-stage-${suffix}`);
      await recoverInterruptedTransaction({
        stagedRoot: stage,
        rollbackRoot: path.join(DATA_DIR, entry.name),
        targets: backupImportTargets(stage)
      });
    }
  }

  const remainingRootEntries = sortStorageTransactionEntries(
    await readDirectoryIfExists(fs, DATA_DIR, { withFileTypes: true })
  );
  for (const entry of remainingRootEntries) {
    if (!entry.isDirectory() || !entry.name.startsWith('.collection-save-stage-')) continue;
    const suffix = entry.name.slice('.collection-save-stage-'.length);
    const stage = path.join(DATA_DIR, entry.name);
    await recoverInterruptedTransaction({
      stagedRoot: stage,
      rollbackRoot: path.join(DATA_DIR, `.collection-save-rollback-${suffix}`),
      targets: collectionSaveTargets(stage)
    });
  }

  const manualRoot = path.join(paths.backups, 'manual');
  const manualEntries = sortStorageTransactionEntries(
    await readDirectoryIfExists(fs, manualRoot, { withFileTypes: true })
  );
  for (const entry of manualEntries) {
    if (entry.isDirectory() && entry.name.startsWith('.import-stage-')) {
      const suffix = entry.name.slice('.import-stage-'.length);
      const stage = path.join(manualRoot, entry.name);
      await recoverInterruptedTransaction({
        stagedRoot: stage,
        rollbackRoot: path.join(DATA_DIR, `.import-rollback-${suffix}`),
        targets: backupImportTargets(stage)
      });
    } else if (entry.isFile() && /^\.upload-.*\.zip$/.test(entry.name)) {
      await removeIfExistsBestEffort(
        path.join(manualRoot, entry.name),
        'Abandoned backup upload cleanup failed'
      );
    }
  }

  const autoRoot = path.join(paths.backups, 'auto');
  const autoEntries = await readDirectoryIfExists(fs, autoRoot, { withFileTypes: true });
  for (const entry of autoEntries) {
    if (entry.isDirectory() && entry.name.startsWith('.auto-stage-')) {
      await removeIfExists(path.join(autoRoot, entry.name));
    }
  }

  const retiredEntries = await readDirectoryIfExists(fs, DATA_DIR, { withFileTypes: true });
  for (const entry of retiredEntries) {
    if (entry.isDirectory() && entry.name.startsWith('.transaction-cleanup-')) {
      await removeIfExistsBestEffort(
        path.join(DATA_DIR, entry.name),
        'Retired transaction cleanup failed'
      );
    }
  }
}

async function initStorage() {
  await ensureDir(DATA_DIR);
  await serializeLiveStateOperation(async () => {
    storageTransactionsRecovered = false;
    await ensureStorageTransactionsRecovered();
    await ensureDir(paths.images);
    await resolveManagedDirectory({ root: paths.images, statusCode: 500 });
    await ensureDir(paths.thumbnails);
    await resolveManagedDirectory({ root: paths.thumbnails, statusCode: 500 });
    await ensureDir(paths.replacedImages);
    await resolveManagedDirectory({ root: paths.replacedImages, statusCode: 500 });
    for (const dir of ['pens', 'inks', 'swatches']) {
      await resolveManagedDirectory({
        root: paths.images,
        relativePath: dir,
        create: true,
        statusCode: 500
      });
      await resolveManagedDirectory({
        root: paths.thumbnails,
        relativePath: dir,
        create: true,
        statusCode: 500
      });
      await resolveManagedDirectory({
        root: paths.replacedImages,
        relativePath: dir,
        create: true,
        statusCode: 500
      });
    }
    if (!(await lstatPathExists(paths.data))) {
      await writeJson(paths.data, defaultCollectionData());
    } else {
      await validateStoredJsonObject(paths.data);
    }
    if (!(await lstatPathExists(paths.preferences))) {
      await writeJson(paths.preferences, defaultPreferences());
    } else {
      await validateStoredJsonObject(paths.preferences);
    }
  });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (
      req.method === 'POST'
      && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))
    ) {
      enforceBrowserMutationRequest(req);
    }
    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      if (!isValidLogin(String(payload.username || ''), String(payload.password || ''))) {
        return sendJson(req, res, 401, { success: false, message: 'Invalid username or password.' });
      }
      createSession(req, res);
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
        const served = await runLiveStateOperation(
          () => serveManagedImage(req, res, relative, { cacheControl: 'private, no-cache' })
        );
        if (!served) {
          return sendJson(req, res, 404, { success: false, message: 'Image not found.' });
        }
        return;
      }
      if (url.pathname.startsWith('/api/thumbs/')) {
        const relative = decodeURIComponent(url.pathname.slice('/api/thumbs/'.length));
        const served = await runLiveStateOperation(
          () => serveManagedThumbnail(req, res, relative, { cacheControl: 'private, no-cache' })
        );
        if (!served) {
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
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error(error);
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    sendJson(req, res, status, { success: false, message: error.message || 'Server error.' });
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
  commitLiveStorageTransaction,
  downloadRemoteImage,
  encodeBody,
  fileEtag,
  fileFingerprint,
  initStorage,
  isBlockedRemoteAddress,
  isCompressibleType,
  isRejectedAdminPassword,
  requestHasFreshValidator,
  saveRemoteImage,
  sendBuffer,
  sendFile,
  server,
  sortStorageTransactionEntries,
  validateRemoteImageUrl,
  versionAssetReference,
  versionHtmlAssetReferences,
  uniqueAvailableFilename,
  writeImageWithThumbnail
};
