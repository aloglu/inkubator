const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  encodeBody,
  fileFingerprint,
  isCompressibleType,
  requestHasFreshValidator,
  sendFile,
  versionAssetReference,
  versionHtmlAssetReferences
} = require('../server/docker-server');

function req(headers = {}, url = '/') {
  return { headers, url };
}

function res() {
  return {
    statusCode: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || {};
    },
    end(body = Buffer.alloc(0)) {
      this.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    }
  };
}

test('encodeBody prefers brotli for compressible responses', () => {
  const body = Buffer.from('body { color: #123456; }\n'.repeat(200));
  const encoded = encodeBody(req({ 'accept-encoding': 'gzip, br' }), body, 'text/css; charset=utf-8');

  assert.equal(encoded.encoding, 'br');
  assert.equal(zlib.brotliDecompressSync(encoded.body).toString('utf8'), body.toString('utf8'));
});

test('encodeBody uses gzip fallback for compressible responses', () => {
  const body = Buffer.from('const value = "inkubator";\n'.repeat(200));
  const encoded = encodeBody(req({ 'accept-encoding': 'gzip' }), body, 'text/javascript; charset=utf-8');

  assert.equal(encoded.encoding, 'gzip');
  assert.equal(zlib.gunzipSync(encoded.body).toString('utf8'), body.toString('utf8'));
});

test('encodeBody skips already-compressed image types', () => {
  const body = Buffer.alloc(4096, 1);
  const encoded = encodeBody(req({ 'accept-encoding': 'gzip, br' }), body, 'image/webp');

  assert.equal(encoded.encoding, undefined);
  assert.equal(encoded.body, body);
});

test('requestHasFreshValidator accepts matching etag and modified date', () => {
  const headers = {
    ETag: 'W/"abc"',
    'Last-Modified': 'Fri, 12 Jun 2026 12:00:00 GMT'
  };

  assert.equal(requestHasFreshValidator(req({ 'if-none-match': 'W/"abc"' }), headers), true);
  assert.equal(requestHasFreshValidator(req({ 'if-modified-since': 'Fri, 12 Jun 2026 12:00:00 GMT' }), headers), true);
  assert.equal(requestHasFreshValidator(req({ 'if-none-match': 'W/"other"' }), headers), false);
});

test('sendFile returns validators and honors conditional requests', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-cache-test-'));
  const file = path.join(dir, 'asset.js');
  await fs.writeFile(file, 'console.log("inkubator");\n'.repeat(100));

  const first = res();
  await sendFile(req({ 'accept-encoding': 'gzip' }), first, file);
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['Cache-Control'], 'public, no-cache');
  assert.equal(first.headers['Content-Encoding'], 'gzip');
  assert.ok(first.headers.ETag);
  assert.ok(first.headers['Last-Modified']);
  assert.equal(isCompressibleType(first.headers['Content-Type']), true);

  const second = res();
  await sendFile(req({ 'if-none-match': first.headers.ETag }), second, file);
  assert.equal(second.statusCode, 304);
  assert.equal(second.headers.Vary, 'Accept-Encoding');
  assert.equal(second.body.length, 0);

  await fs.rm(dir, { recursive: true, force: true });
});

test('versionAssetReference fingerprints app assets and skips generated data', async () => {
  const stylePath = path.join(__dirname, '..', 'app', 'style.css');
  const styleHash = await fileFingerprint(stylePath);

  assert.equal(await versionAssetReference('style.css'), `style.css?v=${styleHash}`);
  assert.equal(await versionAssetReference('data.js'), 'data.js');
  assert.equal(await versionAssetReference('https://example.com/style.css'), 'https://example.com/style.css');
});

test('versionHtmlAssetReferences fingerprints local src and href references', async () => {
  const html = '<link rel="stylesheet" href="style.css"><script src="renderer.js"></script><script src="data.js"></script>';
  const out = await versionHtmlAssetReferences(html);

  assert.match(out, /href="style\.css\?v=[^"]+"/);
  assert.match(out, /src="renderer\.js\?v=[^"]+"/);
  assert.match(out, /src="data\.js"/);
});

test('sendFile marks matching fingerprinted asset requests immutable', async () => {
  const file = path.join(__dirname, '..', 'app', 'style.css');
  const hash = await fileFingerprint(file);
  const response = res();

  await sendFile(req({ host: 'localhost' }, `/style.css?v=${hash}`), response, file);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Cache-Control'], 'public, max-age=31536000, immutable');
});
