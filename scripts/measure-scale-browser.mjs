#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const baseUrl = String(process.argv[2] || 'http://127.0.0.1:18081').replace(/\/$/, '');
const outputPath = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'inkubator-scale-browser.json'));
const debugPort = Number(process.env.INKUBATOR_CDP_PORT || 9227);
const profilePath = path.join(os.tmpdir(), `inkubator-scale-chromium-${process.pid}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (_) {
      // Browser startup is still in progress.
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
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
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

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
    return () => this.listeners.set(method, listeners.filter((candidate) => candidate !== listener));
  }

  waitFor(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const off = this.on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  close() {
    this.socket.close();
  }
}

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
  '--window-size=1440,1000',
  'about:blank'
], { stdio: ['ignore', 'ignore', 'ignore'] });
const chromiumExited = new Promise((resolve) => chromium.once('exit', resolve));

let client;
try {
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
  const target = await targetResponse.json();
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await Promise.all([
    client.send('Page.enable'),
    client.send('Runtime.enable'),
    client.send('Network.enable'),
    client.send('Performance.enable')
  ]);

  const requests = new Map();
  const consoleErrors = [];
  let runRequestIds = new Set();

  client.on('Network.requestWillBeSent', ({ requestId, request, type }) => {
    runRequestIds.add(requestId);
    requests.set(requestId, { requestId, url: request.url, type, status: 0, bytes: 0, fromCache: false });
  });
  client.on('Network.responseReceived', ({ requestId, response, type }) => {
    const entry = requests.get(requestId) || { requestId, url: response.url, bytes: 0 };
    Object.assign(entry, {
      type: type || entry.type,
      status: response.status,
      mimeType: response.mimeType,
      fromCache: !!(response.fromDiskCache || response.fromPrefetchCache || response.fromServiceWorker)
    });
    requests.set(requestId, entry);
  });
  client.on('Network.requestServedFromCache', ({ requestId }) => {
    const entry = requests.get(requestId);
    if (entry) entry.fromCache = true;
  });
  client.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const entry = requests.get(requestId);
    if (entry) entry.bytes = encodedDataLength;
  });
  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails?.text || exceptionDetails?.exception?.description || 'Runtime exception');
  });

  async function evaluate(expression, awaitPromise = true) {
    const result = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    return result.result?.value;
  }

  async function waitForCondition(expression, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for condition: ${expression}`);
  }

  async function pageMetrics(cardSelector) {
    const runtime = await evaluate(`(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const images = [...document.images];
      const managedImages = images.filter((image) => {
        const source = image.currentSrc || image.src;
        return source.includes('/thumbs/') || source.includes('/images/');
      });
      const scrollRoot = document.querySelector('.main-content') || document.documentElement;
      return {
        navigationMs: nav ? Math.round(nav.duration * 10) / 10 : null,
        domElements: document.querySelectorAll('*').length,
        cards: document.querySelectorAll(${JSON.stringify(cardSelector)}).length,
        imageElements: images.length,
        managedImageElements: managedImages.length,
        loadedImages: managedImages.filter((image) => image.complete && image.naturalWidth > 0).length,
        failedImages: managedImages.filter((image) => image.complete && image.src && image.naturalWidth === 0).length,
        resourceEntries: resources.length,
        resourceTransferBytes: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
        resourceDecodedBytes: resources.reduce((sum, item) => sum + (item.decodedBodySize || 0), 0),
        scrollHeight: scrollRoot.scrollHeight,
        scrollClientHeight: scrollRoot.clientHeight
      };
    })()`);
    const performanceMetrics = await client.send('Performance.getMetrics');
    const byName = Object.fromEntries(performanceMetrics.metrics.map((metric) => [metric.name, metric.value]));
    return {
      ...runtime,
      jsHeapUsedBytes: Math.round(byName.JSHeapUsedSize || 0),
      jsHeapTotalBytes: Math.round(byName.JSHeapTotalSize || 0),
      layoutCount: Math.round(byName.LayoutCount || 0),
      recalcStyleCount: Math.round(byName.RecalcStyleCount || 0)
    };
  }

  function networkMetrics(ids) {
    const entries = [...ids].map((id) => requests.get(id)).filter(Boolean);
    const imageEntries = entries.filter((entry) => /\/(?:api\/)?(?:thumbs|images)\//.test(entry.url));
    return {
      requests: entries.length,
      transferredBytes: entries.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
      cachedRequests: entries.filter((entry) => entry.fromCache || entry.status === 304).length,
      imageRequests: imageEntries.length,
      imageTransferredBytes: imageEntries.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
      image304s: imageEntries.filter((entry) => entry.status === 304).length,
      failedRequests: entries.filter((entry) => entry.status >= 400 || entry.status === 0).length
    };
  }

  async function scrollPage() {
    await evaluate(`new Promise((resolve) => {
      const root = document.querySelector('.main-content') || document.documentElement;
      let previous = -1;
      const step = () => {
        const maximum = Math.max(0, root.scrollHeight - root.clientHeight);
        const next = Math.min(maximum, root.scrollTop + 800);
        root.scrollTop = next;
        if (next >= maximum || next === previous) return setTimeout(resolve, 300);
        previous = next;
        setTimeout(step, 20);
      };
      step();
    })`);
    await sleep(1000);
  }

  async function navigateAndMeasure(name, url, cardSelector, expectedCards, options = {}) {
    runRequestIds = new Set();
    const runErrorsStart = consoleErrors.length;
    const loaded = client.waitFor('Page.loadEventFired');
    await client.send('Page.navigate', { url });
    await loaded;
    await waitForCondition(`document.querySelectorAll(${JSON.stringify(cardSelector)}).length === ${expectedCards}`, 20000);
    await sleep(500);
    const initial = await pageMetrics(cardSelector);
    if (options.scroll !== false) await scrollPage();
    const afterScroll = await pageMetrics(cardSelector);
    const ids = new Set(runRequestIds);
    return {
      name,
      initial,
      afterScroll,
      network: networkMetrics(ids),
      runtimeErrors: consoleErrors.slice(runErrorsStart)
    };
  }

  await client.send('Network.clearBrowserCache');
  await client.send('Network.setCacheDisabled', { cacheDisabled: false });

  const publicPensCold = await navigateAndMeasure('public-pens-cold', `${baseUrl}/pens`, '#pens-grid .pen-card-horizontal', 240);

  runRequestIds = new Set();
  const galleryErrorsStart = consoleErrors.length;
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('#pens-grid .pen-card-horizontal')]
      .find((candidate) => candidate.querySelector('.pen-card-model')?.textContent.trim() === 'Pen 0240');
    if (!card) throw new Error('Six-image scale fixture pen was not rendered.');
    card.click();
  })()`);
  await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen-detail')).display !== 'none' && document.querySelector('#pen-detail-img').complete && document.querySelector('#pen-detail-img').naturalWidth > 0`);
  await evaluate(`(async () => {
    const clickAndWait = (button) => new Promise((resolve) => {
      const image = document.querySelector('#pen-detail-img');
      const previousSource = image.src;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.removeEventListener('load', finish);
        image.removeEventListener('error', finish);
        resolve();
      };
      image.addEventListener('load', finish);
      image.addEventListener('error', finish);
      button.click();
      const currentSource = image.src;
      if (currentSource !== previousSource && image.complete) finish();
      setTimeout(finish, 5000);
    });
    for (let count = 0; count < 6; count += 1) {
      const previous = document.querySelector('#pen-detail-visual-container .detail-photo-nav.prev');
      if (!previous || previous.hidden || previous.disabled) break;
      await clickAndWait(previous);
    }
    for (let count = 0; count < 6; count += 1) {
      const next = document.querySelector('#pen-detail-visual-container .detail-photo-nav.next');
      if (!next || next.hidden || next.disabled) break;
      await clickAndWait(next);
    }
  })()`);
  await sleep(500);
  const publicGallery = {
    network: networkMetrics(new Set(runRequestIds)),
    runtimeErrors: consoleErrors.slice(galleryErrorsStart),
    state: await evaluate(`({
      imageVisible: getComputedStyle(document.querySelector('#pen-detail-img')).display !== 'none',
      imageLoaded: document.querySelector('#pen-detail-img').naturalWidth > 0,
      currentIndex: typeof currentPenDetailImageIndex === 'number' ? currentPenDetailImageIndex : null,
      imageCount: appData.pens.find((pen) => pen.id === currentPenDetailPenId)?.images.length || 0,
      currentSource: document.querySelector('#pen-detail-img').src,
      previousVisible: !document.querySelector('#pen-detail-visual-container .detail-photo-nav.prev')?.hidden,
      nextVisible: !document.querySelector('#pen-detail-visual-container .detail-photo-nav.next')?.hidden
    })`)
  };

  const publicPensWarm = await navigateAndMeasure('public-pens-warm', `${baseUrl}/pens`, '#pens-grid .pen-card-horizontal', 240);
  const publicSwatches = await navigateAndMeasure('public-swatches', `${baseUrl}/swatches`, '#swatches-grid > *', 100);
  const publicInks = await navigateAndMeasure('public-inks', `${baseUrl}/inks`, '#inks-grid > *', 100);

  const login = await evaluate(`fetch(${JSON.stringify(`${baseUrl}/auth/login`)}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'test' })
  }).then(async (response) => ({ status: response.status, body: await response.json() }))`);
  if (login.status !== 200 || !login.body?.success) throw new Error('Scale benchmark admin login failed.');

  const adminPensCold = await navigateAndMeasure('admin-pens-cold', `${baseUrl}/admin/pens`, '#pens-grid .pen-card-horizontal', 240);
  const adminPensWarm = await navigateAndMeasure('admin-pens-warm', `${baseUrl}/admin/pens`, '#pens-grid .pen-card-horizontal', 240);

  const result = {
    measuredAt: new Date().toISOString(),
    baseUrl,
    publicPensCold,
    publicGallery,
    publicPensWarm,
    publicSwatches,
    publicInks,
    adminPensCold,
    adminPensWarm
  };
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  if (client) client.close();
  chromium.kill('SIGTERM');
  await Promise.race([chromiumExited, sleep(2000)]);
  await fs.rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
