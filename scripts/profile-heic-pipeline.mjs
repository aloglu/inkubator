#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const appRoot = path.join(repoRoot, 'app');
const outputPath = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'inkubator-heic-profile.json'));
const fixtureRoot = path.join(os.tmpdir(), 'inkubator-heic-profile-fixtures');
const debugPort = Number(process.env.INKUBATOR_CDP_PORT || 9231);
const profilePath = path.join(os.tmpdir(), `inkubator-heic-chromium-${process.pid}`);

const fixtures = [
  { name: 'phone-3mp-portrait', width: 1512, height: 2016, quality: 86 },
  { name: 'phone-12mp-portrait', width: 3024, height: 4032, quality: 86 }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`));
    });
  });
}

async function pathExists(value) {
  try {
    await fs.access(value);
    return true;
  } catch (_) {
    return false;
  }
}

async function fileSize(value) {
  const stats = await fs.stat(value);
  return stats.size;
}

async function generateFixtures() {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
  await fs.mkdir(fixtureRoot, { recursive: true });
  const generated = [];
  for (const fixture of fixtures) {
    const source = path.join(fixtureRoot, `${fixture.name}.jpg`);
    const heic = path.join(fixtureRoot, `${fixture.name}.heic`);
    const startedAt = performance.now();
    await run('magick', [
      '-size', `${fixture.width}x${fixture.height}`,
      'plasma:fractal',
      '-colorspace', 'sRGB',
      '-quality', '92',
      source
    ]);
    await run('heif-enc', ['-q', String(fixture.quality), '-o', heic, source]);
    generated.push({
      ...fixture,
      jpgPath: source,
      heicPath: heic,
      jpgBytes: await fileSize(source),
      heicBytes: await fileSize(heic),
      generationMs: Math.round((performance.now() - startedAt) * 10) / 10
    });
  }
  return generated;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.heic' || extension === '.heif') return 'image/heic';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html>
<html>
  <head><meta charset="utf-8"><script src="/heic-converter.js" defer></script></head>
  <body>HEIC profiler</body>
</html>`);
        return;
      }

      const appCandidate = path.normalize(path.join(appRoot, url.pathname));
      const fixtureCandidate = path.normalize(path.join(fixtureRoot, url.pathname.replace(/^\/fixtures\//, '')));
      let target = null;
      if (url.pathname.startsWith('/fixtures/') && fixtureCandidate.startsWith(`${fixtureRoot}${path.sep}`)) {
        target = fixtureCandidate;
      } else if (appCandidate.startsWith(`${appRoot}${path.sep}`)) {
        target = appCandidate;
      }

      if (!target || !(await pathExists(target))) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Content-Type': contentTypeFor(target),
        'Cache-Control': 'no-store'
      });
      response.end(await fs.readFile(target));
    } catch (error) {
      response.writeHead(500);
      response.end(error && error.stack ? error.stack : String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function waitForJson(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (_) {
      // Chromium is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function launchBrowser(baseUrl) {
  const chromium = spawn('chromium', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profilePath}`,
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  const exited = new Promise((resolve) => chromium.once('exit', resolve));

  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
  const target = await targetResponse.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await Promise.all([
    client.send('Page.enable'),
    client.send('Runtime.enable'),
    client.send('Performance.enable')
  ]);
  return { chromium, exited, client };
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'Browser evaluation failed');
  }
  return result.result?.value;
}

async function measureFixture(client, fixture) {
  return evaluate(client, `(${async function profileFixture(fixtureArg) {
    const round = (value) => Math.round(value * 10) / 10;
    const bytesToBase64 = (bytes) => {
      let binary = '';
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
      }
      return btoa(binary);
    };
    const canvasBlobFromBitmap = (bitmap, maxSize) => new Promise((resolve, reject) => {
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is unavailable.'));
        return;
      }
      context.drawImage(bitmap, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve({ blob, width, height });
        else reject(new Error('WebP encode failed.'));
      }, 'image/webp', 0.88);
    });
    const blobBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

    const sourceBytes = new Uint8Array(await (await fetch(fixtureArg.url)).arrayBuffer());
    const firstResourceCount = performance.getEntriesByType('resource').length;
    const pngStartedAt = performance.now();
    const pngBytes = await window.inkubatorHeic.convertBytesToPng(sourceBytes);
    const pngMs = performance.now() - pngStartedAt;

    const pngBase64StartedAt = performance.now();
    const pngBase64 = bytesToBase64(pngBytes);
    const pngBase64Ms = performance.now() - pngBase64StartedAt;

    const pngDecodeStartedAt = performance.now();
    const pngBitmap = await createImageBitmap(new Blob([pngBytes], { type: 'image/png' }));
    const pngDecodeMs = performance.now() - pngDecodeStartedAt;

    const fullWebpStartedAt = performance.now();
    const fullWebp = await canvasBlobFromBitmap(pngBitmap, 1200);
    const fullWebpBytes = await blobBytes(fullWebp.blob);
    const fullWebpMs = performance.now() - fullWebpStartedAt;

    const thumbStartedAt = performance.now();
    const thumbWebp = await canvasBlobFromBitmap(pngBitmap, 480);
    const thumbWebpBytes = await blobBytes(thumbWebp.blob);
    const thumbWebpMs = performance.now() - thumbStartedAt;
    pngBitmap.close();

    let directWebp = null;
    if (typeof window.inkubatorHeic.convertBytesToWebp === 'function') {
      const directFullStartedAt = performance.now();
      const directFullBytes = await window.inkubatorHeic.convertBytesToWebp(sourceBytes, { maxSize: 1200, quality: 0.88 });
      const directFullMs = performance.now() - directFullStartedAt;
      const directThumbStartedAt = performance.now();
      const directThumbBytes = await window.inkubatorHeic.convertBytesToWebp(sourceBytes, { maxSize: 480, quality: 0.82 });
      const directThumbMs = performance.now() - directThumbStartedAt;
      const directBase64StartedAt = performance.now();
      const directBase64 = bytesToBase64(directFullBytes);
      const directBase64Ms = performance.now() - directBase64StartedAt;
      directWebp = {
        fullBytes: directFullBytes.length,
        fullMs: round(directFullMs),
        thumbBytes: directThumbBytes.length,
        thumbMs: round(directThumbMs),
        base64Bytes: directBase64.length,
        base64Ms: round(directBase64Ms)
      };
    }

    const resources = performance.getEntriesByType('resource').slice(firstResourceCount).map((entry) => ({
      name: entry.name.split('/').slice(-2).join('/'),
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize,
      durationMs: round(entry.duration)
    }));

    return {
      sourceBytes: sourceBytes.length,
      pngBytes: pngBytes.length,
      pngBase64Bytes: pngBase64.length,
      pngConvertMs: round(pngMs),
      pngBase64Ms: round(pngBase64Ms),
      pngDecodeForCanvasMs: round(pngDecodeMs),
      fullWebpFromPngBytes: fullWebpBytes.length,
      fullWebpFromPngMs: round(fullWebpMs),
      fullWebpWidth: fullWebp.width,
      fullWebpHeight: fullWebp.height,
      thumbWebpFromPngBytes: thumbWebpBytes.length,
      thumbWebpFromPngMs: round(thumbWebpMs),
      thumbWebpWidth: thumbWebp.width,
      thumbWebpHeight: thumbWebp.height,
      directWebp,
      resources
    };
  }})(${JSON.stringify({ url: `/fixtures/${fixture.name}.heic` })})`);
}

let server;
let browser;

try {
  const generated = await generateFixtures();
  ({ server, baseUrl: globalThis.baseUrl } = await startServer());
  browser = await launchBrowser(globalThis.baseUrl);
  await evaluate(browser.client, `new Promise((resolve) => {
    if (window.inkubatorHeic) resolve(true);
    else window.addEventListener('load', () => resolve(!!window.inkubatorHeic), { once: true });
  })`);

  const measurements = [];
  for (const fixture of generated) {
    const cold = await measureFixture(browser.client, fixture);
    const warm = await measureFixture(browser.client, fixture);
    measurements.push({ fixture, cold, warm });
  }

  const performanceMetrics = await browser.client.send('Performance.getMetrics');
  const byName = Object.fromEntries(performanceMetrics.metrics.map((metric) => [metric.name, metric.value]));
  const result = {
    measuredAt: new Date().toISOString(),
    chromium: await new Promise((resolve) => {
      const child = spawn('chromium', ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let stdout = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.on('exit', () => resolve(stdout.trim()));
    }),
    fixtures: measurements,
    browserMetrics: {
      jsHeapUsedBytes: Math.round(byName.JSHeapUsedSize || 0),
      jsHeapTotalBytes: Math.round(byName.JSHeapTotalSize || 0)
    }
  };
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  if (browser?.client) browser.client.close();
  if (browser?.chromium) {
    browser.chromium.kill('SIGTERM');
    await Promise.race([browser.exited, sleep(2000)]);
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await fs.rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
