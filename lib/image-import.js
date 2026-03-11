const path = require('path');

const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);
const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heic-sequence',
  'image/heif',
  'image/heif-sequence'
]);
const HEIC_BRANDS = new Set(['mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx']);

function normalizeMimeType(mimeType) {
  return String(mimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function getSourceExtension(sourceHint) {
  const raw = String(sourceHint || '').trim();
  if (!raw) return '';

  let pathname = raw;
  try {
    if (/^[a-z]+:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    }
  } catch (_error) {
    pathname = raw;
  }

  return path.extname(pathname).toLowerCase();
}

function isHeicBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false;

  const brandMajor = buffer.toString('ascii', 8, 12).replace(/\0/g, ' ').trim();
  return HEIC_BRANDS.has(brandMajor);
}

function isHeicSource({ sourcePath = '', sourceUrl = '', mimeType = '', buffer = null } = {}) {
  if (HEIC_EXTENSIONS.has(getSourceExtension(sourcePath))) return true;
  if (HEIC_EXTENSIONS.has(getSourceExtension(sourceUrl))) return true;
  if (HEIC_MIME_TYPES.has(normalizeMimeType(mimeType))) return true;
  return isHeicBuffer(buffer);
}

async function prepareImageInputForSharp({
  input,
  fs,
  sourcePath = '',
  sourceUrl = '',
  mimeType = '',
  convertHeicBuffer
}) {
  const bufferInput = Buffer.isBuffer(input) ? input : null;
  const heicLike = isHeicSource({
    sourcePath,
    sourceUrl,
    mimeType,
    buffer: bufferInput
  });

  if (!heicLike) return input;
  if (typeof convertHeicBuffer !== 'function') {
    throw new Error('HEIC conversion requires a convertHeicBuffer function.');
  }

  if (bufferInput) {
    return await convertHeicBuffer(bufferInput);
  }

  if (!fs || typeof fs.readFile !== 'function') {
    throw new Error('HEIC conversion requires fs.readFile for path inputs.');
  }

  const sourceBuffer = await fs.readFile(String(input || ''));
  return await convertHeicBuffer(sourceBuffer);
}

module.exports = {
  getSourceExtension,
  isHeicBuffer,
  isHeicSource,
  normalizeMimeType,
  prepareImageInputForSharp
};
