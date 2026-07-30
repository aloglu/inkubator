const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const zlib = require('node:zlib');

const {
  downloadRemoteImage,
  encodeBody,
  fileFingerprint,
  isBlockedRemoteAddress,
  isCompressibleType,
  isRejectedAdminPassword,
  requestHasFreshValidator,
  sendFile,
  validateRemoteImageUrl,
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

function remoteResponse(statusCode, headers = {}, chunks = []) {
  const response = Readable.from(chunks);
  response.statusCode = statusCode;
  response.headers = headers;
  return response;
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

test('remote image URL validation rejects credentials and non-https URLs', () => {
  assert.throws(
    () => validateRemoteImageUrl('https://user:password@example.com/image.png'),
    /cannot contain credentials/i
  );
  assert.throws(
    () => validateRemoteImageUrl('http://example.com/image.png'),
    /only https/i
  );
  assert.equal(validateRemoteImageUrl('https://example.com/image.png').hostname, 'example.com');
});

test('remote address validation blocks local networks without blocking public addresses', () => {
  for (const address of [
    '0.0.0.0',
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1'
  ]) {
    assert.equal(isBlockedRemoteAddress(address), true, address);
  }
  assert.equal(isBlockedRemoteAddress('8.8.8.8'), false);
  assert.equal(isBlockedRemoteAddress('2606:4700:4700::1111'), false);
});

test('remote image redirects revalidate DNS and reject private destinations', async () => {
  const requested = [];
  const lookup = async (hostname) => {
    if (hostname === 'public.example') return [{ address: '93.184.216.34', family: 4 }];
    return [{ address: '127.0.0.1', family: 4 }];
  };
  const requestResponse = async (url) => {
    requested.push(url.href);
    return remoteResponse(302, {
      location: 'https://private.example/image.png'
    });
  };

  await assert.rejects(
    downloadRemoteImage('https://public.example/start.png', { lookup, requestResponse }),
    /private or local network/i
  );
  assert.deepEqual(requested, ['https://public.example/start.png']);

  await assert.rejects(
    downloadRemoteImage('https://mixed.example/image.png', {
      lookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 }
      ],
      requestResponse: async () => {
        throw new Error('request must not start');
      }
    }),
    /private or local network/i
  );
});

test('remote image downloader enforces redirects, MIME type, and streamed size limits', async () => {
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }];

  await assert.rejects(
    downloadRemoteImage('https://public.example/image.svg', {
      lookup,
      requestResponse: async () => remoteResponse(200, {
        'content-type': 'image/svg+xml'
      }, ['<svg></svg>'])
    }),
    /supported raster image/i
  );

  await assert.rejects(
    downloadRemoteImage('https://public.example/large.png', {
      lookup,
      maxBytes: 4,
      requestResponse: async () => remoteResponse(200, {
        'content-type': 'image/png'
      }, [Buffer.from('123'), Buffer.from('45')])
    }),
    /too large/i
  );

  await assert.rejects(
    downloadRemoteImage('https://public.example/declared-large.png', {
      lookup,
      maxBytes: 4,
      requestResponse: async () => remoteResponse(200, {
        'content-length': '5',
        'content-type': 'image/png'
      }, [Buffer.from('12345')])
    }),
    /too large/i
  );

  await assert.rejects(
    downloadRemoteImage('https://public.example/redirect.png', {
      lookup,
      maxRedirects: 1,
      requestResponse: async () => remoteResponse(302, {
        location: '/redirect.png'
      })
    }),
    /too many redirects/i
  );

  await assert.rejects(
    downloadRemoteImage('https://public.example/redirect.png', {
      lookup,
      requestResponse: async () => remoteResponse(302, {
        location: 'http://public.example/image.png'
      })
    }),
    /only https/i
  );
});

test('remote image downloader returns bounded supported image bytes', async () => {
  const result = await downloadRemoteImage('https://public.example/image.png', {
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    requestResponse: async () => remoteResponse(200, {
      'content-length': '4',
      'content-type': 'image/png; charset=binary'
    }, [Buffer.from('test')])
  });

  assert.equal(result.bytes.toString('utf8'), 'test');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.sourceUrl, 'https://public.example/image.png');
});

test('Docker deployment defaults require a non-placeholder password and local binding', async () => {
  const root = path.join(__dirname, '..');
  const [compose, readme, buildGuide] = await Promise.all([
    fs.readFile(path.join(root, 'docker-compose.example.yml'), 'utf8'),
    fs.readFile(path.join(root, 'README.md'), 'utf8'),
    fs.readFile(path.join(root, 'docs', 'build-from-source.md'), 'utf8')
  ]);
  assert.match(compose, /INKUBATOR_ADMIN_PASSWORD:\s*"\$\{INKUBATOR_ADMIN_PASSWORD:\?/);
  assert.match(compose, /\$\{INKUBATOR_BIND_ADDRESS:-127\.0\.0\.1\}/);
  assert.doesNotMatch(compose, /INKUBATOR_ADMIN_PASSWORD:-change-this-password/);
  for (const document of [readme, buildGuide]) {
    assert.match(document, /-p 127\.0\.0\.1:8080:8080/);
    assert.match(document, /-e INKUBATOR_ADMIN_PASSWORD(?:\s|\\)/);
    assert.doesNotMatch(document, /INKUBATOR_ADMIN_PASSWORD='change-this-password'/);
  }
  assert.equal(isRejectedAdminPassword(''), true);
  assert.equal(isRejectedAdminPassword('change-this-password'), true);
  assert.equal(isRejectedAdminPassword('a-unique-password'), false);
});
