#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { normalizeAppData } = require('../lib/data-schema');
const sharp = require('sharp');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const tempRoot = path.join(os.tmpdir(), `inkubator-renderer-smoke-${process.pid}`);
const dataDir = path.join(tempRoot, 'data');
const profileDir = path.join(tempRoot, 'chromium-profile');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch (_) {
      // The server is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForJson(url, timeoutMs = 15000, getAbortError = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const abortError = typeof getAbortError === 'function' ? getAbortError() : null;
    if (abortError) throw abortError;
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
      const off = this.on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
    });
  }

  close() {
    this.socket.close();
  }
}

async function pngImage(color, width = 12, height = 24) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color
    }
  }).png().toBuffer();
}

async function writeFixture() {
  const images = {
    'pens/delete-a.png': await pngImage('#0f5132'),
    'pens/delete-b.png': await pngImage('#5f0f40'),
    'pens/delete-c.png': await pngImage('#1d4ed8'),
    'pens/make-a.png': await pngImage('#111827'),
    'pens/make-b.png': await pngImage('#b45309'),
    'pens/make-c.png': await pngImage('#6d28d9'),
    'pens/detail-a.png': await pngImage('#0f766e'),
    'pens/detail-b.png': await pngImage('#dc2626', 24, 12),
    'pens/detail-c.png': await pngImage('#2563eb'),
    'swatches/swatch-a.png': await pngImage('#60a5fa', 24, 12),
    'swatches/swatch-b.png': await pngImage('#f472b6', 24, 12)
  };

  await fs.mkdir(path.join(dataDir, 'images', 'pens'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'images', 'swatches'), { recursive: true });
  for (const [relativePath, content] of Object.entries(images)) {
    if (typeof content === 'string') {
      await fs.writeFile(path.join(dataDir, 'images', relativePath), content, 'utf8');
    } else {
      await fs.writeFile(path.join(dataDir, 'images', relativePath), content);
    }
  }

  const now = Date.UTC(2026, 0, 16, 12, 0, 0);
  const collection = {
    pens: [
      {
        id: 'pen-delete-primary',
        brand: 'Pilot',
        model: 'Delete Primary',
        nib: 'M',
        nib_material: 'Gold',
        material: 'Resin',
        filling_system: 'Converter',
        color: 'Green',
        hex_color: '#0f5132',
        hex_colors: ['#0f5132'],
        image: 'pens/delete-a.png',
        image_rotation: 0,
        images: [
          { id: 'delete-a', path: 'pens/delete-a.png', rotation: 0, primary: true },
          { id: 'delete-b', path: 'pens/delete-b.png', rotation: 0, primary: false },
          { id: 'delete-c', path: 'pens/delete-c.png', rotation: 0, primary: false }
        ]
      },
      {
        id: 'pen-make-primary',
        brand: 'Pilot',
        model: 'Make Primary',
        nib: 'F',
        nib_material: 'Steel',
        material: 'Resin',
        filling_system: 'Cartridge',
        color: 'Black',
        hex_color: '#111827',
        hex_colors: ['#111827'],
        image: 'pens/make-a.png',
        image_rotation: 0,
        images: [
          { id: 'make-a', path: 'pens/make-a.png', rotation: 0, primary: true },
          { id: 'make-b', path: 'pens/make-b.png', rotation: 0, primary: false },
          { id: 'make-c', path: 'pens/make-c.png', rotation: 0, primary: false }
        ]
      },
      {
        id: 'pen-detail-carousel',
        brand: 'Pilot',
        model: 'Detail Carousel',
        nib: 'B',
        nib_material: 'Gold',
        material: 'Resin',
        filling_system: 'Piston',
        color: 'Teal',
        price: '150',
        hex_color: '#0f766e',
        hex_colors: ['#0f766e'],
        image: 'pens/detail-a.png',
        image_rotation: 0,
        images: [
          { id: 'detail-a', path: 'pens/detail-a.png', rotation: 0, primary: true },
          { id: 'detail-b', path: 'pens/detail-b.png', rotation: 0, primary: false },
          { id: 'detail-c', path: 'pens/detail-c.png', rotation: 0, primary: false }
        ]
      },
      {
        id: 'pen-broken-image',
        brand: 'Pilot',
        model: 'Broken Image',
        nib: 'M',
        nib_material: 'Steel',
        material: 'Resin',
        filling_system: 'Converter',
        color: 'Blue',
        hex_color: '#2563eb',
        hex_colors: ['#2563eb'],
        image: 'data:image/png;base64,Zm9v',
        image_rotation: 0,
        images: [
          { id: 'broken-pen-image', path: 'data:image/png;base64,Zm9v', rotation: 0, primary: true }
        ]
      }
    ],
    inks: [
      {
        id: 'ink-blue',
        brand: 'Pilot',
        name: 'Blue Test',
        type: 'Other',
        cl: '50',
        amount: '2',
        color_base: '#2563eb',
        color_accent: '#60a5fa',
        hex_colors: ['#2563eb', '#60a5fa'],
        flow: 'Very Dry',
        lubrication: 'High',
        dry_time: '15s'
      }
    ],
    swatches: [
      {
        id: 'swatch-make-primary',
        ink_id: 'ink-blue',
        image: 'swatches/swatch-a.png',
        images: [
          { id: 'swatch-a', path: 'swatches/swatch-a.png', rotation: 0, primary: true },
          { id: 'swatch-b', path: 'swatches/swatch-b.png', rotation: 0, primary: false }
        ],
        swatch_paper: 'Test Paper',
        swatch_nib: 'M',
        swatch_date: '2026-01-15',
        swatch_lighting: 'Natural',
        created_at: now
      },
      {
        id: 'swatch-broken-image',
        ink_id: 'ink-blue',
        image: 'data:image/png;base64,Zm9v',
        images: [
          { id: 'broken-swatch-image', path: 'data:image/png;base64,Zm9v', rotation: 0, primary: true }
        ],
        swatch_paper: 'Test Paper',
        swatch_nib: 'Broken',
        swatch_date: '2026-01-14',
        swatch_lighting: 'Natural',
        created_at: now - 1000
      }
    ],
    currently_inked: [
      { id: 'ci-detail', pen_id: 'pen-detail-carousel', ink_id: 'ink-blue', date_inked: now }
    ],
    activity_log: [
      {
        id: 'act-pen',
        timestamp: Date.UTC(2026, 0, 15, 11, 0, 0),
        action: 'created',
        category: 'pen',
        message: 'Added pen: Pilot Detail Carousel.',
        entity_id: 'pen-detail-carousel'
      },
      {
        id: 'act-ink',
        timestamp: Date.UTC(2026, 0, 16, 12, 0, 0),
        action: 'updated',
        category: 'ink',
        message: 'Updated ink: Pilot Blue Test.',
        entity_id: 'ink-blue'
      }
    ]
  };

  const normalized = normalizeAppData({
    ...collection,
    preferences: {
      color_mode: 'dark',
      confirm_destructive_actions: false,
      defaults: {
        currency: 'EUR',
        pen_nib: 'M',
        pen_nib_material: 'Steel',
        pen_status: 'clean',
        ink_type: 'Bottle'
      },
      showcase: {
        title: 'Renderer Smoke',
        color_mode: 'light',
        show_prices: false,
        show_swatches: false,
        show_activity_filters: true
      }
    }
  });

  const { preferences, ...collectionData } = normalized;
  await fs.writeFile(path.join(dataDir, 'data.json'), `${JSON.stringify(collectionData, null, 2)}\n`);
  await fs.writeFile(path.join(dataDir, 'preferences.json'), `${JSON.stringify(preferences, null, 2)}\n`);
}

async function checkTauriApiContract() {
  const calls = [];
  let revisionNumber = 0;
  let revision = 'desktop-r0';
  let storedData = { marker: 'initial' };
  let forcedSaveError = null;
  let nativeExportResult = { success: true, path: '/tmp/tauri-export.zip' };
  const nativeExportEvents = [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  class MockChannel {
    constructor(onmessage) {
      this.onmessage = onmessage;
    }

    emit(message) {
      this.onmessage(message);
    }
  }
  const conflict = () => ({
    success: false,
    code: 'DATA_CONFLICT',
    conflict: true,
    revision,
    message: 'Collection changed in another app window.'
  });

  const invoke = async (command, payload = {}) => {
    calls.push({ command, payload: clone(payload) });
    if (command === 'load_data') {
      return { success: true, data: clone(storedData), revision };
    }
    if (command === 'save_data') {
      await sleep(10);
      if (forcedSaveError) {
        const error = forcedSaveError;
        forcedSaveError = null;
        throw error;
      }
      if (payload.expectedRevision !== revision) return conflict();
      storedData = clone(payload.data);
      revisionNumber += 1;
      revision = `desktop-r${revisionNumber}`;
      return { success: true, revision };
    }
    if (command === 'import_backup') {
      if (payload.expectedRevision !== revision) return conflict();
      storedData = { marker: 'imported' };
      revisionNumber += 1;
      revision = `desktop-r${revisionNumber}`;
      return { success: true, data: clone(storedData), revision };
    }
    if (command === 'export_backup') {
      nativeExportEvents.push('command');
      if (!nativeExportResult.canceled) {
        payload.onStarted.emit();
        nativeExportEvents.push('return');
      }
      return clone(nativeExportResult);
    }
    throw new Error(`Unexpected Tauri command: ${command}`);
  };

  const context = vm.createContext({
    console,
    Error,
    JSON,
    Promise,
    setTimeout,
    clearTimeout,
    window: {
      __TAURI__: {
        core: { invoke, Channel: MockChannel }
      }
    }
  });
  const source = await fs.readFile(path.join(rootDir, 'app', 'tauri-api.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'app/tauri-api.js' });
  const api = context.window.inkubatorAPI;
  assert.ok(api, 'Tauri API wrapper should initialize with a mocked invoke function');

  const loaded = await api.loadData();
  assert.equal(loaded.marker, 'initial', 'Tauri load should unwrap the revision envelope');

  const [firstSave, secondSave] = await Promise.all([
    api.saveData({ marker: 'first queued desktop save' }),
    api.saveData({ marker: 'second queued desktop save' })
  ]);
  assert.equal(firstSave.success, true, 'the first queued Tauri save should succeed');
  assert.equal(secondSave.success, true, 'the second queued Tauri save should use the first save revision');
  assert.equal(storedData.marker, 'second queued desktop save', 'Tauri saves should preserve invocation order');
  assert.deepEqual(
    calls.filter((call) => call.command === 'save_data').map((call) => call.payload.expectedRevision),
    ['desktop-r0', 'desktop-r1'],
    'Tauri saves should pass the latest retained revision with camelCase invoke arguments'
  );

  forcedSaveError = {
    status: 409,
    code: 'MEDIA_INTEGRITY',
    message: 'A managed image path is unsafe.'
  };
  await assert.rejects(
    api.saveData({ marker: 'rejected media save' }),
    (error) => error
      && error.status === 409
      && error.code === 'MEDIA_INTEGRITY'
      && error.conflict === false,
    'a non-revision 409 should retain its error details without becoming a data conflict'
  );
  const saveAfterMediaError = await api.saveData({ marker: 'save after media error' });
  assert.equal(saveAfterMediaError.success, true, 'a non-revision 409 should not lock later saves');
  assert.equal(storedData.marker, 'save after media error', 'the save after a media-integrity error should persist');

  revision = 'desktop-external';
  storedData = { marker: 'newer desktop writer' };
  await assert.rejects(
    api.saveData({ marker: 'stale desktop writer' }),
    (error) => error && error.code === 'DATA_CONFLICT' && error.conflict === true,
    'Tauri stale saves should reject with structured conflict details'
  );
  assert.equal(storedData.marker, 'newer desktop writer', 'a stale Tauri save should not overwrite newer data');

  await api.loadData();
  const imported = await api.importBackup('/tmp/inkubator-test.zip', { auto_validate_import: true });
  assert.equal(imported.success, true, 'Tauri backup import should succeed with the retained revision');
  const importCall = calls.findLast((call) => call.command === 'import_backup');
  assert.equal(importCall.payload.zipPath, '/tmp/inkubator-test.zip', 'Tauri import should use the expected camelCase path argument');
  assert.equal(importCall.payload.expectedRevision, 'desktop-external', 'Tauri import should pass the retained revision');

  let releaseExportWait = null;
  const exportWait = new Promise((resolve) => {
    releaseExportWait = resolve;
  });
  const exportCallCountBeforeWait = calls.filter((call) => call.command === 'export_backup').length;
  const pendingExport = api.exportBackup({
    waitFor: exportWait,
    onStarted: () => nativeExportEvents.push('started')
  });
  await Promise.resolve();
  assert.equal(
    calls.filter((call) => call.command === 'export_backup').length,
    exportCallCountBeforeWait,
    'Tauri backup export should not invoke the native command while queued settings are pending'
  );
  releaseExportWait();
  const exported = await pendingExport;
  assert.deepEqual(exported, { success: true, path: '/tmp/tauri-export.zip' });
  assert.equal(
    calls.filter((call) => call.command === 'export_backup').length,
    exportCallCountBeforeWait + 1,
    'Tauri backup export should invoke the native command after queued settings finish'
  );
  assert.deepEqual(
    nativeExportEvents,
    ['command', 'started', 'return'],
    'Tauri backup progress should start from the native command before it resolves'
  );

  nativeExportResult = { success: false, canceled: true };
  nativeExportEvents.length = 0;
  let canceledExportStarted = false;
  const canceledExport = await api.exportBackup({
    onStarted: () => {
      canceledExportStarted = true;
    }
  });
  assert.deepEqual(canceledExport, { success: false, canceled: true });
  assert.equal(canceledExportStarted, false, 'canceling the native save picker should not start export progress');
  assert.deepEqual(nativeExportEvents, ['command'], 'native picker cancellation should send no progress event');
}

async function main() {
  await checkTauriApiContract();
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(dataDir, { recursive: true });
  await writeFixture();

  const appPort = await freePort();
  const debugPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const chromiumBin = process.env.INKUBATOR_CHROMIUM_BIN || 'chromium';
  const serverLog = [];
  const server = spawn(process.execPath, [path.join(rootDir, 'server/docker-server.js')], {
    cwd: rootDir,
    env: {
      ...process.env,
      INKUBATOR_ADMIN_PASSWORD: 'test',
      INKUBATOR_DATA_DIR: dataDir,
      PORT: String(appPort)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => serverLog.push(String(chunk)));
  server.stderr.on('data', (chunk) => serverLog.push(String(chunk)));

  const chromium = spawn(chromiumBin, [
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
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  let chromiumLaunchError = null;
  chromium.once('error', (error) => {
    chromiumLaunchError = error;
  });
  const serverExited = new Promise((resolve) => server.once('exit', resolve));
  const chromiumExited = new Promise((resolve) => {
    chromium.once('exit', resolve);
    chromium.once('error', resolve);
  });
  let client;
  const runtimeErrors = [];
  const consoleErrors = [];

  try {
    await waitForHttp(baseUrl);
    if (chromiumLaunchError) {
      throw new Error(`Could not start Chromium at "${chromiumBin}": ${chromiumLaunchError.message}`);
    }
    await waitForJson(
      `http://127.0.0.1:${debugPort}/json/version`,
      15000,
      () => chromiumLaunchError
        ? new Error(`Could not start Chromium at "${chromiumBin}": ${chromiumLaunchError.message}`)
        : null
    );
    const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetResponse.json();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable')
    ]);
    await client.send('Network.clearBrowserCache');
    await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      runtimeErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Runtime exception');
    });
    client.on('Runtime.consoleAPICalled', ({ type, args = [] }) => {
      if (type !== 'error') return;
      consoleErrors.push(args.map((arg) => (
        typeof arg.value !== 'undefined' ? String(arg.value) : String(arg.description || '')
      )).join(' '));
    });

    const evaluate = async (expression, awaitPromise = true, timeoutMs = 15000) => {
      const request = client.send('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true
      });
      const result = await Promise.race([
        request,
        sleep(timeoutMs).then(() => {
          const preview = String(expression).replace(/\s+/g, ' ').trim().slice(0, 180);
          throw new Error(`Timed out evaluating browser expression: ${preview}`);
        })
      ]);
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed');
      }
      return result.result?.value;
    };

    const waitForCondition = async (expression, timeoutMs = 15000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await sleep(100);
      }
      throw new Error(`Timed out waiting for condition: ${expression}`);
    };

    const pressBrowserKey = async ({
      key,
      code,
      keyCode,
      modifiers = 0,
      text = ''
    }) => {
      const keyDown = {
        type: 'keyDown',
        key,
        code,
        modifiers,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode
      };
      if (text) {
        keyDown.text = text;
        keyDown.unmodifiedText = text;
      }
      await client.send('Input.dispatchKeyEvent', keyDown);
      await client.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        modifiers,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode
      });
      await sleep(40);
    };

    const navigate = async (url) => {
      const loaded = client.waitFor('Page.loadEventFired');
      await client.send('Page.navigate', { url });
      await loaded;
    };

    const fetchData = () => evaluate(`fetch('/api/data')
      .then((response) => response.json())
      .then((payload) => payload && payload.data ? payload.data : payload)`);

    await navigate(`${baseUrl}/`);
    await waitForCondition(`document.body && document.body.dataset.theme === 'light'`);
    const publicTheme = await evaluate(`({
      theme: document.body.dataset.theme,
      title: document.title,
      hasAdminApi: !!window.inkubatorAPI,
      hasSharedSchema: !!(window.InkubatorDataSchema && typeof window.InkubatorDataSchema.normalizeAppData === 'function'),
      dockerMode: isDockerMode,
      thumbnailSource: resolveImageThumbnailSource('pens/detail-a.png')
    })`);
    assert.equal(publicTheme.theme, 'light', 'public showcase should use showcase color mode');
    assert.equal(publicTheme.hasAdminApi, false, 'public showcase should not expose admin API');
    assert.equal(publicTheme.hasSharedSchema, true, 'public showcase should load shared data schema normalization');
    assert.equal(publicTheme.dockerMode, true, 'the live public showcase should detect Docker mode');
    assert.equal(
      publicTheme.thumbnailSource,
      '/thumbs/pens/detail-a.png',
      'the live public showcase should use its public thumbnail route without the static-export suffix'
    );

    const hiddenPriceCompleteness = await evaluate(`(() => {
      const pens = appData.pens || [];
      const inks = appData.inks || [];
      const originalPenPrices = pens.map((pen) => pen.price);
      const originalInkPrices = inks.map((ink) => ink.price);
      const completenessRow = () => computeCollectionInsights().find((row) => row.label === 'Completeness Score');

      pens.forEach((pen) => { pen.price = ''; });
      inks.forEach((ink) => { ink.price = ''; });
      const withoutPrices = completenessRow();

      pens.forEach((pen) => { pen.price = '999'; });
      inks.forEach((ink) => { ink.price = '999'; });
      const withPrices = completenessRow();

      pens.forEach((pen, index) => { pen.price = originalPenPrices[index]; });
      inks.forEach((ink, index) => { ink.price = originalInkPrices[index]; });
      renderCollectionInsights();

      return {
        withoutValue: withoutPrices?.value || '',
        withValue: withPrices?.value || '',
        withoutTooltip: withoutPrices?.valueTooltip || '',
        withTooltip: withPrices?.valueTooltip || '',
        renderedText: document.querySelector('#collection-insights-list')?.textContent || ''
      };
    })()`);
    assert.equal(hiddenPriceCompleteness.withValue, hiddenPriceCompleteness.withoutValue, 'hidden prices should not affect completeness scoring');
    assert.doesNotMatch(hiddenPriceCompleteness.withoutTooltip, /Pen Price|Ink Price/i, 'hidden price fields should not appear in completeness tooltips');
    assert.doesNotMatch(hiddenPriceCompleteness.withTooltip, /Pen Price|Ink Price/i, 'filled hidden prices should not appear in completeness tooltips');
    assert.doesNotMatch(hiddenPriceCompleteness.renderedText, /Total Pen Spend|Total Ink Spend|Average Pen Price|Average Ink Price/i, 'public insights should not render derived price rows');

    const hiddenInkDerivedOutput = await evaluate(`(() => {
      const originalAppData = appData;
      appData = ensureAppDataDefaults({
        pens: [],
        inks: [{
          id: 'defense-only-hidden-ink',
          name: 'Private Hidden Ink',
          brand: 'Private Brand',
          color_base: '#123456'
        }],
        swatches: [],
        currently_inked: [],
        activity_log: [],
        preferences: {
          showcase: {
            show_inks: false,
            show_prices: false
          }
        }
      });
      const rows = computeCollectionInsights();
      renderCollectionCharts();
      const result = {
        libraryCount: getLibraryInks().length,
        insightText: JSON.stringify(rows),
        topInkChartText: document.querySelector('#chart-top-ink-brands')?.textContent || '',
        spectrumText: document.querySelector('#grouped-spectrum-list')?.textContent || ''
      };
      appData = originalAppData;
      return result;
    })()`);
    assert.equal(hiddenInkDerivedOutput.libraryCount, 0, 'public ink libraries should stay empty when inks are hidden');
    assert.doesNotMatch(hiddenInkDerivedOutput.insightText, /Private Hidden Ink|Private Brand/i, 'hidden inks should not leak through derived insights');
    assert.doesNotMatch(hiddenInkDerivedOutput.topInkChartText, /Private Hidden Ink|Private Brand/i, 'hidden inks should not leak through charts');
    assert.doesNotMatch(hiddenInkDerivedOutput.spectrumText, /Private Hidden Ink|Private Brand/i, 'hidden inks should not leak through the spectrum');

    await navigate(`${baseUrl}/swatches`);
    await waitForCondition(`typeof appData !== 'undefined' && !document.body.classList.contains('app-booting')`);
    const hiddenSwatchesRoute = await evaluate(`({
      pathname: window.location.pathname,
      isManagerApp,
      isDockerMode,
      showSwatchesPreference: getShowcasePreferences().show_swatches,
      routeView: resolveRouteViewFromLocation(),
      visibleSwatchesView: resolveVisibleViewName('swatches'),
      basePath: normalizeBasePath(window.location.pathname),
      dashboardVisible: getComputedStyle(document.querySelector('#view-dashboard')).display !== 'none',
      swatchesVisible: getComputedStyle(document.querySelector('#view-swatches')).display !== 'none',
      swatchesRendered: document.querySelectorAll('#swatches-grid .inked-card').length,
      swatchesNavHidden: getComputedStyle(document.querySelector('#nav-swatches')).display === 'none'
    })`);
    assert.equal(
      hiddenSwatchesRoute.pathname,
      '/',
      `hidden public section route should be replaced with the public dashboard route: ${JSON.stringify({ hiddenSwatchesRoute, runtimeErrors, consoleErrors })}`
    );
    assert.equal(hiddenSwatchesRoute.dashboardVisible, true, 'hidden public section route should show Dashboard');
    assert.equal(hiddenSwatchesRoute.swatchesVisible, false, 'hidden public section route should not show the hidden Swatches view');
    assert.equal(hiddenSwatchesRoute.swatchesRendered, 0, 'hidden public section route should not render the hidden Swatches grid');
    assert.equal(hiddenSwatchesRoute.swatchesNavHidden, true, 'hidden public Swatches section should hide the Swatches nav item');

    await navigate(`${baseUrl}/admin/`);
    const login = await evaluate(`fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test' })
    }).then(async (response) => ({ status: response.status, body: await response.json() }))`);
    assert.equal(login.status, 200, 'admin login should succeed');

    await navigate(`${baseUrl}/admin/pens`);
    await waitForCondition(`typeof appData !== 'undefined'
      && getDefaultCurrency() === 'EUR'
      && document.querySelectorAll('#pens-grid .pen-card-horizontal').length >= 3`);
    const startupCurrencyPresentation = await evaluate(`({
      prefix: document.querySelector('#pen-price-prefix')?.textContent || '',
      expectedPrefix: getCurrencySymbol(getDefaultCurrency())
    })`);
    assert.equal(
      startupCurrencyPresentation.prefix,
      startupCurrencyPresentation.expectedPrefix,
      'direct management routes should apply the saved currency symbol during startup'
    );

    await navigate(`${baseUrl}/admin/settings`);
    await waitForCondition(`typeof appData !== 'undefined'
      && getComputedStyle(document.querySelector('#view-settings')).display !== 'none'`);
    const dockerShowcaseExport = await evaluate(`({
      hasSharedShowcaseExportButton: !!document.querySelector('#btn-export-showcase'),
      hasDockerShowcaseExportApi: Object.prototype.hasOwnProperty.call(desktopAPI || {}, 'exportShowcase'),
      showcaseExportActionsDisplay: getComputedStyle(
        document.querySelector('#btn-export-showcase')?.closest('.settings-showcase-actions')
      ).display
    })`);
    assert.equal(dockerShowcaseExport.hasSharedShowcaseExportButton, true, 'Docker should retain the shared settings markup');
    assert.equal(dockerShowcaseExport.hasDockerShowcaseExportApi, false, 'Docker should not expose a showcase-export browser API');
    assert.equal(dockerShowcaseExport.showcaseExportActionsDisplay, 'none', 'Docker should hide the inapplicable showcase-export action');

    await navigate(`${baseUrl}/admin/pens`);
    await waitForCondition(`typeof appData !== 'undefined' && document.querySelectorAll('#pens-grid .pen-card-horizontal').length >= 3`);
    const adminTheme = await evaluate(`({
      theme: document.body.dataset.theme,
      thumbnailSource: resolveImageThumbnailSource('pens/detail-a.png')
    })`);
    assert.equal(adminTheme.theme, 'dark', 'admin should use app color mode separately from public showcase');
    assert.equal(
      adminTheme.thumbnailSource,
      '/api/thumbs/pens/detail-a.png',
      'Docker management pages should use the authenticated thumbnail route'
    );

    await evaluate(`openPenDetailModal('pen-detail-carousel')`);
    const penCurrencyPresentation = await evaluate(`(() => {
      const priceSection = Array.from(document.querySelectorAll('#pen-detail-metadata > div')).find(
        (section) => section.querySelector('h4')?.textContent.trim() === 'Price'
      );
      const pen = appData.pens.find((item) => item.id === 'pen-detail-carousel');
      return {
        currency: getDefaultCurrency(),
        price: priceSection?.querySelector('p')?.textContent.trim() || '',
        expectedPrice: formatMoney(parsePriceNumber(pen?.price))
      };
    })()`);
    assert.equal(penCurrencyPresentation.currency, 'EUR', 'the saved default currency should load in the shared renderer');
    assert.equal(penCurrencyPresentation.price, penCurrencyPresentation.expectedPrice, 'pen details should format prices with the default currency');
    await evaluate(`closeDetailModals()`);

    const appNoticeTiming = await evaluate(`(() => {
      const mediumText = 'x'.repeat(80);
      const originalSetTimeout = window.setTimeout;
      let scheduledDuration = null;
      if (appNoticeTimer) {
        clearTimeout(appNoticeTimer);
        appNoticeTimer = null;
      }
      try {
        window.setTimeout = (_callback, delay) => {
          scheduledDuration = delay;
          return 1;
        };
        showAppNotice('Importing backup', 'warning', { persistent: true });
        const persistentScheduledDuration = scheduledDuration;
        const persistentTimer = appNoticeTimer;
        const persistentText = document.querySelector('.app-notice-floating')?.textContent || '';
        showAppNotice(mediumText, 'warning');
        return {
          shortSuccess: calculateAppNoticeDuration('Saved', 'success'),
          mediumInfo: calculateAppNoticeDuration(mediumText, 'info'),
          mediumWarning: calculateAppNoticeDuration(mediumText, 'warning'),
          mediumError: calculateAppNoticeDuration(mediumText, 'error'),
          unicodeInfo: calculateAppNoticeDuration('😀'.repeat(80), 'info'),
          explicitMinimum: calculateAppNoticeDuration('Short', 'info', 6000),
          explicitMaximum: calculateAppNoticeDuration('Short', 'error', 12000),
          cappedText: calculateAppNoticeDuration('x'.repeat(1000), 'error'),
          cappedMinimum: calculateAppNoticeDuration('Short', 'error', 30000),
          persistentScheduledDuration,
          persistentTimer,
          persistentText,
          scheduledDuration,
          visible: document.querySelector('.app-notice-floating')?.classList.contains('is-visible') || false,
          warning: document.querySelector('.app-notice-floating')?.classList.contains('is-warning') || false
        };
      } finally {
        window.setTimeout = originalSetTimeout;
        appNoticeTimer = null;
        document.querySelector('.app-notice-floating')?.classList.remove('is-visible');
      }
    })()`);
    assert.equal(appNoticeTiming.shortSuccess, 3000, 'short success notices should use the three-second minimum');
    assert.equal(appNoticeTiming.mediumInfo, 6000, 'notice duration should grow with message length');
    assert.equal(appNoticeTiming.mediumWarning, 7000, 'warnings should remain visible longer than informational notices');
    assert.equal(appNoticeTiming.mediumError, 8000, 'errors should remain visible longer than warnings');
    assert.equal(appNoticeTiming.unicodeInfo, 6000, 'notice timing should count Unicode characters once');
    assert.equal(appNoticeTiming.explicitMinimum, 6000, 'existing explicit durations should act as minimums');
    assert.equal(appNoticeTiming.explicitMaximum, 12000, 'an explicit twelve-second minimum should remain supported');
    assert.equal(appNoticeTiming.cappedText, 12000, 'very long notices should stop at the twelve-second maximum');
    assert.equal(appNoticeTiming.cappedMinimum, 12000, 'explicit notice minimums should respect the overall maximum');
    assert.equal(appNoticeTiming.persistentScheduledDuration, null, 'persistent notices should not schedule a dismissal');
    assert.equal(appNoticeTiming.persistentTimer, null, 'persistent notices should not retain a timer handle');
    assert.equal(appNoticeTiming.persistentText, 'Importing backup', 'persistent notices should display their message');
    assert.equal(appNoticeTiming.scheduledDuration, 7000, 'showAppNotice should schedule its calculated duration');
    assert.equal(appNoticeTiming.visible, true, 'showAppNotice should make the notice visible');
    assert.equal(appNoticeTiming.warning, true, 'showAppNotice should apply the requested severity style');

    const backupExportLifecycle = await evaluate(`(async () => {
      const originalExportBackup = desktopAPI.exportBackup;
      const button = document.querySelector('#btn-export-backup');
      const originalLabel = button?.querySelector('span')?.textContent || '';

      const clearNotice = () => {
        if (appNoticeTimer) {
          clearTimeout(appNoticeTimer);
          appNoticeTimer = null;
        }
        document.querySelector('.app-notice-floating')?.classList.remove('is-visible');
      };

      const runExport = async (outcome) => {
        clearNotice();
        let exportCalls = 0;
        let receivedSettingsWait = false;
        let startExport = null;
        let settleExport = null;
        desktopAPI.exportBackup = async (options = {}) => {
          exportCalls += 1;
          receivedSettingsWait = !!(options.waitFor && typeof options.waitFor.then === 'function');
          startExport = typeof options.onStarted === 'function'
            ? options.onStarted
            : () => {};
          return await new Promise((resolve, reject) => {
            settleExport = { resolve, reject };
          });
        };

        button.click();
        button.click();
        while (!settleExport) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        const beforeStartNotice = document.querySelector('.app-notice-floating');
        const beforeStart = {
          noticeText: beforeStartNotice?.textContent || '',
          noticeVisible: beforeStartNotice?.classList.contains('is-visible') || false,
          noticeTimerless: appNoticeTimer === null
        };

        if (outcome !== 'cancellation') {
          startExport();
          startExport();
        }
        await Promise.resolve();
        const pendingNotice = document.querySelector('.app-notice-floating');
        const pending = {
          exportCalls,
          receivedSettingsWait,
          noticeText: pendingNotice?.textContent || '',
          noticeVisible: pendingNotice?.classList.contains('is-visible') || false,
          noticeWarning: pendingNotice?.classList.contains('is-warning') || false,
          noticeTimerless: appNoticeTimer === null,
          buttonDisabled: !!button?.disabled,
          buttonBusy: button?.getAttribute('aria-busy') === 'true',
          buttonLabel: button?.querySelector('span')?.textContent || '',
          settingsInert: !!viewSettings?.inert,
          settingsBusy: viewSettings?.getAttribute('aria-busy') === 'true'
        };

        if (outcome === 'success') {
          settleExport.resolve({ success: true, path: '/tmp/exported-backup.zip' });
        } else if (outcome === 'failure') {
          settleExport.reject(new Error('simulated export failure'));
        } else {
          settleExport.resolve({ success: false, canceled: true });
        }

        while (backupExportInFlight) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        await new Promise((resolve) => setTimeout(resolve, 5));

        const terminalNotice = document.querySelector('.app-notice-floating');
        const completed = {
          noticeText: terminalNotice?.textContent || '',
          noticeVisible: terminalNotice?.classList.contains('is-visible') || false,
          noticeError: terminalNotice?.classList.contains('is-error') || false,
          noticeWarning: terminalNotice?.classList.contains('is-warning') || false,
          noticeTimerScheduled: appNoticeTimer !== null,
          buttonDisabled: !!button?.disabled,
          buttonBusy: button?.hasAttribute('aria-busy') || false,
          buttonLabel: button?.querySelector('span')?.textContent || '',
          settingsInert: !!viewSettings?.inert,
          settingsBusy: viewSettings?.hasAttribute('aria-busy') || false
        };
        startExport();
        await Promise.resolve();
        const noticeAfterLateStart = document.querySelector('.app-notice-floating');
        const afterLateStart = {
          noticeText: noticeAfterLateStart?.textContent || '',
          noticeWarning: noticeAfterLateStart?.classList.contains('is-warning') || false
        };
        clearNotice();
        return { beforeStart, pending, completed, afterLateStart };
      };

      try {
        return {
          originalLabel,
          success: await runExport('success'),
          failure: await runExport('failure'),
          cancellation: await runExport('cancellation')
        };
      } finally {
        desktopAPI.exportBackup = originalExportBackup;
        backupExportInFlight = false;
        if (button) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
          const label = button.querySelector('span');
          if (label) label.textContent = originalLabel;
        }
        setSettingsOperationBusy(false);
        clearNotice();
      }
    })()`);
    assert.equal(backupExportLifecycle.success.pending.exportCalls, 1, 'repeated backup-export clicks should start only one export');
    assert.equal(backupExportLifecycle.success.pending.receivedSettingsWait, true, 'backup export should pass the queued-settings promise to its platform API');
    assert.equal(backupExportLifecycle.success.beforeStart.noticeVisible, false, 'backup export progress should stay hidden while the save picker is open');
    assert.equal(backupExportLifecycle.success.beforeStart.noticeTimerless, true, 'the picker phase should not schedule a notice');
    assert.match(backupExportLifecycle.success.pending.noticeText, /Exporting full backup/i);
    assert.doesNotMatch(backupExportLifecycle.success.pending.noticeText, /choose a name|location|prompted/i);
    assert.equal(backupExportLifecycle.success.pending.noticeVisible, true, 'backup export progress should be visible while pending');
    assert.equal(backupExportLifecycle.success.pending.noticeWarning, true, 'backup export progress should use the warning style');
    assert.equal(backupExportLifecycle.success.pending.noticeTimerless, true, 'backup export progress should remain until completion');
    assert.equal(backupExportLifecycle.success.pending.buttonDisabled, true, 'backup export should disable its button while pending');
    assert.equal(backupExportLifecycle.success.pending.buttonBusy, true, 'backup export should expose button busy state');
    assert.equal(backupExportLifecycle.success.pending.buttonLabel, 'Exporting...', 'backup export should show a progress label');
    assert.equal(backupExportLifecycle.success.pending.settingsInert, true, 'settings should lock while backup export is pending');
    assert.equal(backupExportLifecycle.success.pending.settingsBusy, true, 'settings should expose busy state while exporting');
    assert.match(backupExportLifecycle.success.completed.noticeText, /Backup exported: \/tmp\/exported-backup\.zip/i);
    assert.equal(backupExportLifecycle.success.completed.noticeVisible, true, 'backup export success should replace progress');
    assert.equal(backupExportLifecycle.success.completed.noticeError, false, 'backup export success should not use the error style');
    assert.equal(backupExportLifecycle.success.completed.noticeWarning, false, 'backup export success should clear the warning style');
    assert.equal(backupExportLifecycle.success.completed.noticeTimerScheduled, true, 'backup export success should dismiss normally');
    assert.equal(backupExportLifecycle.success.completed.buttonDisabled, false, 'backup export should restore its button after success');
    assert.equal(backupExportLifecycle.success.completed.buttonBusy, false, 'backup export should clear button busy state after success');
    assert.equal(backupExportLifecycle.success.completed.buttonLabel, backupExportLifecycle.originalLabel, 'backup export should restore its label after success');
    assert.equal(backupExportLifecycle.success.completed.settingsInert, false, 'settings should unlock after backup export success');
    assert.equal(backupExportLifecycle.success.completed.settingsBusy, false, 'settings should clear busy state after backup export success');
    assert.match(backupExportLifecycle.failure.completed.noticeText, /Backup export failed: simulated export failure/i);
    assert.equal(backupExportLifecycle.failure.completed.noticeError, true, 'backup export failure should replace progress with an error');
    assert.equal(backupExportLifecycle.failure.completed.noticeTimerScheduled, true, 'backup export errors should dismiss normally');
    assert.equal(backupExportLifecycle.failure.completed.buttonDisabled, false, 'backup export should restore its button after failure');
    assert.equal(backupExportLifecycle.failure.completed.buttonBusy, false, 'backup export should clear button busy state after failure');
    assert.equal(backupExportLifecycle.failure.completed.buttonLabel, backupExportLifecycle.originalLabel, 'backup export should restore its label after failure');
    assert.equal(backupExportLifecycle.failure.completed.settingsInert, false, 'settings should unlock after backup export failure');
    assert.equal(backupExportLifecycle.failure.completed.settingsBusy, false, 'settings should clear busy state after backup export failure');
    assert.equal(backupExportLifecycle.cancellation.beforeStart.noticeVisible, false, 'a canceled save picker should not show export progress');
    assert.equal(backupExportLifecycle.cancellation.pending.noticeVisible, false, 'backup cancellation should occur without a yellow progress notice');
    assert.equal(backupExportLifecycle.cancellation.completed.noticeText, 'Backup export canceled', 'backup export cancellation should replace progress');
    assert.equal(backupExportLifecycle.cancellation.completed.noticeVisible, true, 'backup export cancellation should show a terminal notice');
    assert.equal(backupExportLifecycle.cancellation.completed.noticeError, false, 'backup export cancellation should not use the error style');
    assert.equal(backupExportLifecycle.cancellation.completed.noticeWarning, false, 'backup export cancellation should clear the warning style');
    assert.equal(backupExportLifecycle.cancellation.completed.noticeTimerScheduled, true, 'backup export cancellation should dismiss normally');
    assert.equal(backupExportLifecycle.cancellation.completed.buttonDisabled, false, 'backup export should restore its button after cancellation');
    assert.equal(backupExportLifecycle.cancellation.completed.buttonBusy, false, 'backup export should clear button busy state after cancellation');
    assert.equal(backupExportLifecycle.cancellation.completed.buttonLabel, backupExportLifecycle.originalLabel, 'backup export should restore its label after cancellation');
    assert.equal(backupExportLifecycle.cancellation.completed.settingsInert, false, 'settings should unlock after backup export cancellation');
    assert.equal(backupExportLifecycle.cancellation.completed.settingsBusy, false, 'settings should clear busy state after backup export cancellation');
    assert.equal(backupExportLifecycle.success.afterLateStart.noticeText, backupExportLifecycle.success.completed.noticeText, 'late progress callbacks should not replace backup success');
    assert.equal(backupExportLifecycle.success.afterLateStart.noticeWarning, false, 'late progress callbacks should not restore warning styling after success');
    assert.equal(backupExportLifecycle.failure.afterLateStart.noticeText, backupExportLifecycle.failure.completed.noticeText, 'late progress callbacks should not replace backup errors');
    assert.equal(backupExportLifecycle.cancellation.afterLateStart.noticeText, backupExportLifecycle.cancellation.completed.noticeText, 'late progress callbacks should not replace backup cancellation');

    const dockerBackupSaveBehavior = await evaluate(`(async () => {
      const exportBackup = desktopAPI.exportBackup;
      const pickerDescriptor = Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker');
      const originalFetch = window.fetch;
      const originalCreateObjectUrl = URL.createObjectURL;
      const originalRevokeObjectUrl = URL.revokeObjectURL;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      const setSavePicker = (value) => {
        Object.defineProperty(window, 'showSaveFilePicker', {
          configurable: true,
          writable: true,
          value
        });
      };

      try {
        let pickerOptions = null;
        let pickerCalls = 0;
        let writableCreated = false;
        let writableClosed = false;
        let releaseSavePicker = null;
        let pickerProgressCalls = 0;
        const pickerOrder = [];
        const streamedBytes = [];
        setSavePicker(async (options) => {
          pickerCalls += 1;
          pickerOptions = options;
          pickerOrder.push('picker-open');
          await new Promise((resolve) => {
            releaseSavePicker = resolve;
          });
          pickerOrder.push('picker-selected');
          return {
            name: 'chosen-docker-backup.zip',
            createWritable: async () => {
              writableCreated = true;
              return new WritableStream({
                write(chunk) {
                  streamedBytes.push(...Array.from(new Uint8Array(chunk)));
                },
                close() {
                  writableClosed = true;
                }
              });
            }
          };
        });
        let releasePickerWait = null;
        const pickerWait = new Promise((resolve) => {
          releasePickerWait = resolve;
        });
        let pickerExportFetches = 0;
        window.fetch = (...args) => {
          if (String(args[0] || '').includes('/api/export-backup')) {
            pickerExportFetches += 1;
            pickerOrder.push('fetch');
          }
          return originalFetch(...args);
        };
        const pendingPickerExport = exportBackup({
          waitFor: pickerWait,
          onStarted: () => {
            pickerProgressCalls += 1;
            pickerOrder.push('started');
          }
        });
        const pickerOpenedSynchronously = pickerCalls === 1;
        while (!releaseSavePicker) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const progressWhilePickerOpen = pickerProgressCalls;
        releaseSavePicker();
        while (!pickerOrder.includes('picker-selected')) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const fetchesWhileSettingsPending = pickerExportFetches;
        const progressWhileSettingsPending = pickerProgressCalls;
        releasePickerWait();
        const pickerResult = await pendingPickerExport;
        const fetchesAfterSettingsReady = pickerExportFetches;
        const progressAfterSettingsReady = pickerProgressCalls;
        window.fetch = originalFetch;

        let cancellationFetches = 0;
        let cancellationProgressCalls = 0;
        window.fetch = (...args) => {
          if (String(args[0] || '').includes('/api/export-backup')) cancellationFetches += 1;
          return originalFetch(...args);
        };
        setSavePicker(async () => {
          throw new DOMException('The user aborted a request.', 'AbortError');
        });
        const canceledResult = await exportBackup({
          onStarted: () => {
            cancellationProgressCalls += 1;
          }
        });
        window.fetch = originalFetch;

        let failedStreamFetches = 0;
        let failedStreamProgressCalls = 0;
        let failedStreamWritableAborts = 0;
        let failedStreamBodyCancels = 0;
        let failedStreamMessage = '';
        setSavePicker(async () => ({
          name: 'failed-docker-backup.zip',
          createWritable: async () => ({
            abort: async () => {
              failedStreamWritableAborts += 1;
            }
          })
        }));
        window.fetch = async (...args) => {
          if (!String(args[0] || '').includes('/api/export-backup')) {
            return originalFetch(...args);
          }
          failedStreamFetches += 1;
          return {
            ok: true,
            headers: new Headers({
              'Content-Disposition': 'attachment; filename="failed-docker-backup.zip"'
            }),
            body: {
              locked: false,
              pipeTo: async () => {
                throw new Error('simulated backup stream failure');
              },
              cancel: async () => {
                failedStreamBodyCancels += 1;
              }
            }
          };
        };
        try {
          await exportBackup({
            onStarted: () => {
              failedStreamProgressCalls += 1;
            }
          });
        } catch (error) {
          failedStreamMessage = error?.message || String(error);
        }
        window.fetch = originalFetch;

        let fallbackClick = null;
        let fallbackBlobSize = 0;
        let revokedUrl = '';
        const fallbackOrder = [];
        setSavePicker(undefined);
        URL.createObjectURL = (blob) => {
          fallbackBlobSize = blob.size;
          return 'blob:inkubator-backup-test';
        };
        URL.revokeObjectURL = (url) => {
          revokedUrl = url;
        };
        HTMLAnchorElement.prototype.click = function clickBackupDownload() {
          fallbackClick = {
            download: this.download,
            href: this.href,
            connected: this.isConnected
          };
        };
        window.fetch = (...args) => {
          if (String(args[0] || '').includes('/api/export-backup')) {
            fallbackOrder.push('fetch');
          }
          return originalFetch(...args);
        };
        const fallbackResult = await exportBackup({
          onStarted: () => {
            fallbackOrder.push('started');
          }
        });
        window.fetch = originalFetch;

        return {
          secureContext: window.isSecureContext,
          picker: {
            calls: pickerCalls,
            suggestedName: pickerOptions?.suggestedName || '',
            description: pickerOptions?.types?.[0]?.description || '',
            extension: pickerOptions?.types?.[0]?.accept?.['application/zip']?.[0] || '',
            excludeAcceptAllOption: pickerOptions?.excludeAcceptAllOption,
            result: pickerResult,
            writableCreated,
            writableClosed,
            byteLength: streamedBytes.length,
            signature: streamedBytes.slice(0, 2),
            openedSynchronously: pickerOpenedSynchronously,
            progressWhilePickerOpen,
            fetchesWhileSettingsPending,
            progressWhileSettingsPending,
            fetchesAfterSettingsReady,
            progressAfterSettingsReady,
            order: pickerOrder
          },
          cancellation: {
            result: canceledResult,
            exportFetches: cancellationFetches,
            progressCalls: cancellationProgressCalls
          },
          streamFailure: {
            exportFetches: failedStreamFetches,
            progressCalls: failedStreamProgressCalls,
            message: failedStreamMessage,
            writableAborts: failedStreamWritableAborts,
            bodyCancels: failedStreamBodyCancels
          },
          fallback: {
            result: fallbackResult,
            click: fallbackClick,
            blobSize: fallbackBlobSize,
            revokedUrl,
            order: fallbackOrder
          }
        };
      } finally {
        window.fetch = originalFetch;
        URL.createObjectURL = originalCreateObjectUrl;
        URL.revokeObjectURL = originalRevokeObjectUrl;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
        if (pickerDescriptor) {
          Object.defineProperty(window, 'showSaveFilePicker', pickerDescriptor);
        } else {
          delete window.showSaveFilePicker;
        }
      }
    })()`);
    assert.equal(dockerBackupSaveBehavior.secureContext, true, 'Docker renderer smoke should run in a save-picker-capable secure context');
    assert.equal(dockerBackupSaveBehavior.picker.calls, 1, 'Docker backup export should open the save picker once');
    assert.equal(dockerBackupSaveBehavior.picker.openedSynchronously, true, 'Docker backup picker should open before the export call yields');
    assert.equal(dockerBackupSaveBehavior.picker.progressWhilePickerOpen, 0, 'Docker backup progress should stay hidden while the save picker is open');
    assert.equal(dockerBackupSaveBehavior.picker.fetchesWhileSettingsPending, 0, 'Docker backup generation should wait for queued settings');
    assert.equal(dockerBackupSaveBehavior.picker.progressWhileSettingsPending, 0, 'Docker backup progress should wait until queued settings are ready');
    assert.equal(dockerBackupSaveBehavior.picker.fetchesAfterSettingsReady, 1, 'Docker backup generation should start after queued settings finish');
    assert.equal(dockerBackupSaveBehavior.picker.progressAfterSettingsReady, 1, 'Docker backup progress should start once after picker acceptance');
    assert.deepEqual(dockerBackupSaveBehavior.picker.order, ['picker-open', 'picker-selected', 'started', 'fetch'], 'Docker progress should start after picker acceptance and before backup generation');
    assert.match(dockerBackupSaveBehavior.picker.suggestedName, /^inkubator-backup-.+\.zip$/);
    assert.equal(dockerBackupSaveBehavior.picker.description, 'ZIP archive', 'Docker backup picker should describe the ZIP file type');
    assert.equal(dockerBackupSaveBehavior.picker.extension, '.zip', 'Docker backup picker should restrict the suggested file type to ZIP');
    assert.equal(dockerBackupSaveBehavior.picker.excludeAcceptAllOption, true, 'Docker backup picker should keep the ZIP-only choice');
    assert.deepEqual(dockerBackupSaveBehavior.picker.result, { success: true, path: 'chosen-docker-backup.zip' });
    assert.equal(dockerBackupSaveBehavior.picker.writableCreated, true, 'Docker backup export should open the chosen file for writing');
    assert.equal(dockerBackupSaveBehavior.picker.writableClosed, true, 'Docker backup export should close the chosen file after streaming');
    assert.ok(dockerBackupSaveBehavior.picker.byteLength > 0, 'Docker backup export should stream non-empty ZIP data');
    assert.deepEqual(dockerBackupSaveBehavior.picker.signature, [80, 75], 'Docker backup export should stream a ZIP archive');
    assert.deepEqual(dockerBackupSaveBehavior.cancellation.result, { success: false, canceled: true });
    assert.equal(dockerBackupSaveBehavior.cancellation.exportFetches, 0, 'canceling the Docker save picker should not create a backup');
    assert.equal(dockerBackupSaveBehavior.cancellation.progressCalls, 0, 'canceling the Docker save picker should not show export progress');
    assert.equal(dockerBackupSaveBehavior.streamFailure.exportFetches, 1, 'failed Docker backup writes should follow one export response');
    assert.equal(dockerBackupSaveBehavior.streamFailure.progressCalls, 1, 'failed Docker backup writes should still start progress once');
    assert.match(dockerBackupSaveBehavior.streamFailure.message, /simulated backup stream failure/i);
    assert.equal(dockerBackupSaveBehavior.streamFailure.writableAborts, 1, 'failed Docker backup writes should abort the destination');
    assert.equal(dockerBackupSaveBehavior.streamFailure.bodyCancels, 1, 'failed Docker backup writes should cancel the response body');
    assert.equal(dockerBackupSaveBehavior.fallback.result.success, true, 'Docker backup export should retain an anchor-download fallback');
    assert.match(dockerBackupSaveBehavior.fallback.result.path, /^inkubator-backup-.+\.zip$/);
    assert.equal(dockerBackupSaveBehavior.fallback.click?.download, dockerBackupSaveBehavior.fallback.result.path, 'fallback download should use the server filename');
    assert.equal(dockerBackupSaveBehavior.fallback.click?.href, 'blob:inkubator-backup-test', 'fallback download should use the generated object URL');
    assert.equal(dockerBackupSaveBehavior.fallback.click?.connected, true, 'fallback download link should be attached before clicking');
    assert.ok(dockerBackupSaveBehavior.fallback.blobSize > 0, 'fallback download should contain the backup ZIP');
    assert.equal(dockerBackupSaveBehavior.fallback.revokedUrl, 'blob:inkubator-backup-test', 'fallback download should revoke its object URL');
    assert.deepEqual(dockerBackupSaveBehavior.fallback.order, ['started', 'fetch'], 'fallback downloads should show progress immediately before backup generation');

    const preservedDefaults = await evaluate(`(() => {
      const sharedDefaults = { ...appData.preferences.defaults };
      const sharedSchema = window.InkubatorDataSchema;
      window.InkubatorDataSchema = null;
      const fallbackDefaults = ensureAppDataDefaults({
        preferences: {
          defaults: {
            currency: 'EUR',
            pen_nib: 'M',
            pen_nib_material: 'Steel',
            pen_status: 'clean',
            ink_type: 'Bottle'
          }
        }
      }).preferences.defaults;
      const fallbackColors = ensureAppDataDefaults({
        pens: [{
          id: 'fallback-color-pen',
          hex_color: '#"><img',
          hex_colors: ['#123', 'not-a-color', '#A1b2C3']
        }],
        inks: [{
          id: 'fallback-color-ink',
          color_base: 'red; background:url(x)',
          color_accent: '#"><img',
          hex_colors: ['#abc', 'rgb(1,2,3)', '#DDEEFF']
        }]
      });
      window.InkubatorDataSchema = sharedSchema;
      return {
        sharedDefaults,
        fallbackDefaults,
        fallbackPen: fallbackColors.pens[0],
        fallbackInk: fallbackColors.inks[0]
      };
    })()`);
    assert.equal(preservedDefaults.sharedDefaults.pen_nib, 'M', 'shared normalization should preserve an explicit M nib default');
    assert.equal(preservedDefaults.sharedDefaults.pen_nib_material, 'Steel', 'shared normalization should preserve an explicit Steel nib material default');
    assert.equal(preservedDefaults.sharedDefaults.pen_status, 'clean', 'shared normalization should preserve an explicit clean pen status default');
    assert.equal(preservedDefaults.sharedDefaults.ink_type, 'Bottle', 'shared normalization should preserve an explicit Bottle ink type default');
    assert.deepEqual(
      preservedDefaults.fallbackDefaults,
      preservedDefaults.sharedDefaults,
      'renderer fallback normalization should preserve the same legitimate defaults as the shared schema'
    );
    assert.equal(preservedDefaults.fallbackPen.hex_color, '#123', 'renderer fallback normalization should derive a safe pen color from the valid palette');
    assert.deepEqual(preservedDefaults.fallbackPen.hex_colors, ['#123', '#A1b2C3'], 'renderer fallback normalization should remove invalid pen palette values');
    assert.equal(preservedDefaults.fallbackInk.color_base, '#4a0e28', 'renderer fallback normalization should replace an invalid ink base color');
    assert.equal(preservedDefaults.fallbackInk.color_accent, '#4a0e28', 'renderer fallback normalization should replace an invalid ink accent color');
    assert.deepEqual(preservedDefaults.fallbackInk.hex_colors, ['#abc', '#DDEEFF'], 'renderer fallback normalization should remove invalid ink palette values');

    const filterValues = await evaluate(`(() => {
      renderFilters();
      renderSwatchFilters();
      const values = (containerId, category) => Array.from(
        document.querySelectorAll(\`#\${containerId} [data-filter-category="\${category}"]\`)
      ).map((element) => element.dataset.filterValue);
      const result = {
        inks: {
          type: values('filter-options-container', 'type'),
          flow: values('filter-options-container', 'flow'),
          lubrication: values('filter-options-container', 'lubrication'),
          dryTime: values('filter-options-container', 'dryTime')
        },
        swatches: {
          type: values('swatch-filter-options-container', 'type'),
          flow: values('swatch-filter-options-container', 'flow'),
          lubrication: values('swatch-filter-options-container', 'lubrication'),
          dryTime: values('swatch-filter-options-container', 'dryTime')
        }
      };
      activeInksFilters.dryTime = ['15s'];
      activeSwatchesFilters.dryTime = ['15s'];
      renderInks();
      renderSwatches();
      result.inkMatchCount = document.querySelectorAll('#inks-grid .inked-card').length;
      result.swatchMatchCount = document.querySelectorAll('#swatches-grid .inked-card').length;
      activeInksFilters.dryTime = [];
      activeSwatchesFilters.dryTime = [];
      renderInks();
      renderSwatches();
      return result;
    })()`);
    assert.deepEqual(filterValues.inks.type, ['Other'], 'ink type filters should reflect stored form-supported values');
    assert.deepEqual(filterValues.inks.flow, ['Very Dry'], 'ink flow filters should include Very Dry when it is stored');
    assert.deepEqual(filterValues.inks.lubrication, ['High'], 'ink lubrication filters should reflect stored values');
    assert.deepEqual(filterValues.inks.dryTime, ['15s'], 'ink dry-time filters should use actual free-form values');
    assert.deepEqual(filterValues.swatches, filterValues.inks, 'swatch filters should derive the same linked-ink values');
    assert.equal(filterValues.inkMatchCount, 1, 'derived dry-time filters should match the stored ink');
    assert.equal(filterValues.swatchMatchCount, 2, 'derived dry-time filters should match linked swatches');

    const penFilterParity = await evaluate(`(() => {
      const pen = appData.pens.find((item) => item.id === 'pen-detail-carousel');
      const original = {
        material: pen.material,
        filling_system: pen.filling_system,
        color: pen.color
      };
      pen.material = 'Resin, Metal';
      pen.filling_system = 'Piston, Converter';
      pen.color = 'Teal, Blue';
      activePensFilters.material = ['Metal'];
      activePensFilters.filling_system = ['Converter'];
      activePensFilters.color = ['Blue'];
      renderPens();
      const gridModels = Array.from(document.querySelectorAll('#pens-grid .pen-card-model'))
        .map((element) => element.textContent.trim());
      const detailModels = getFilteredSortedPensForDetails().map((item) => item.model);
      Object.assign(pen, original);
      activePensFilters.material = [];
      activePensFilters.filling_system = [];
      activePensFilters.color = [];
      renderPens();
      return { gridModels, detailModels };
    })()`);
    assert.deepEqual(penFilterParity.gridModels, ['Detail Carousel'], 'pen grid filters should token-match CSV values');
    assert.deepEqual(penFilterParity.detailModels, penFilterParity.gridModels, 'pen detail navigation should use the same filtered set as the grid');

    await waitForCondition(`Array.from(document.querySelectorAll('#pens-grid .pen-card-horizontal')).some((card) => (
      card.querySelector('.pen-card-model')?.textContent.trim() === 'Broken Image'
      && card.querySelector('.pen-card-visual')?.classList.contains('image-unavailable')
    ))`);
    const brokenPenCardFallback = await evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('#pens-grid .pen-card-horizontal')).find(
        (item) => item.querySelector('.pen-card-model')?.textContent.trim() === 'Broken Image'
      );
      return {
        unavailable: card?.querySelector('.pen-card-visual')?.classList.contains('image-unavailable') || false,
        hasFallbackIcon: !!card?.querySelector('.card-image-fallback-icon'),
        hasBrokenImg: !!card?.querySelector('.pen-card-visual img')
      };
    })()`);
    assert.equal(brokenPenCardFallback.unavailable, true, 'a missing pen image should enter a deliberate unavailable state');
    assert.equal(brokenPenCardFallback.hasFallbackIcon, true, 'a missing pen image should show the pen fallback icon');
    assert.equal(brokenPenCardFallback.hasBrokenImg, false, 'a missing pen image should remove the broken img element');

    const initialInkVolume = await evaluate(`(async () => {
      const ink = appData.inks.find((item) => item.id === 'ink-blue');
      await openInkModal('ink-blue');
      const input = document.querySelector('#ink-volume-ml-input');
      const label = input?.closest('.input-group')?.querySelector('label')?.textContent?.trim() || '';
      return {
        volumeMl: ink?.volume_ml,
        hasLegacyCl: Object.prototype.hasOwnProperty.call(ink || {}, 'cl'),
        inputValue: input?.value || '',
        label
      };
    })()`);
    assert.equal(initialInkVolume.volumeMl, '50', 'legacy cl values should migrate one-for-one to volume_ml');
    assert.equal(initialInkVolume.hasLegacyCl, false, 'normalized renderer data should remove the legacy cl field');
    assert.equal(initialInkVolume.inputValue, '50', 'the ink form should load the migrated milliliter value');
    assert.equal(initialInkVolume.label, 'Volume (ml)', 'the ink form should label volume in milliliters');

    const multiselectCheckboxStyle = await evaluate(`(async () => {
      const popover = document.querySelector('#base-type-popover');
      const checkbox = document.querySelector('#base-type-popover input[type="checkbox"]');
      if (popover && typeof popover.showPopover === 'function' && !popover.matches(':popover-open')) {
        popover.showPopover();
      }
      const originalChecked = checkbox.checked;
      checkbox.checked = false;
      const unchecked = getComputedStyle(checkbox);
      const uncheckedState = {
        appearance: unchecked.appearance,
        width: unchecked.width,
        height: unchecked.height,
        borderRadius: unchecked.borderRadius,
        backgroundColor: unchecked.backgroundColor
      };
      checkbox.checked = true;
      checkbox.focus();
      await new Promise((resolve) => setTimeout(resolve, 220));
      const checked = getComputedStyle(checkbox);
      const checkedState = {
        backgroundColor: checked.backgroundColor,
        backgroundImage: checked.backgroundImage,
      };
      const focusRulePresent = Array.from(document.styleSheets).some((sheet) => {
        try {
          return Array.from(sheet.cssRules || []).some((rule) => (
            String(rule.selectorText || '').includes('.multiselect-options input[type="checkbox"]:focus')
            && !!rule.style?.boxShadow
          ));
        } catch (_) {
          return false;
        }
      });
      checkbox.checked = originalChecked;
      checkbox.blur();
      if (popover && typeof popover.hidePopover === 'function' && popover.matches(':popover-open')) {
        popover.hidePopover();
      }
      return { uncheckedState, checkedState, focusRulePresent };
    })()`);
    assert.equal(multiselectCheckboxStyle.uncheckedState.appearance, 'none', 'multiselect menu checkboxes should use the app-defined control style');
    assert.equal(multiselectCheckboxStyle.uncheckedState.width, '18px', 'multiselect checkboxes should keep a stable width');
    assert.equal(multiselectCheckboxStyle.uncheckedState.height, '18px', 'multiselect checkboxes should keep a stable height');
    assert.equal(multiselectCheckboxStyle.uncheckedState.borderRadius, '5px', 'multiselect checkboxes should use the restrained settings-control radius');
    assert.notEqual(
      multiselectCheckboxStyle.checkedState.backgroundColor,
      multiselectCheckboxStyle.uncheckedState.backgroundColor,
      `checked multiselect controls should have a clear selected state: ${JSON.stringify(multiselectCheckboxStyle)}`
    );
    assert.notEqual(multiselectCheckboxStyle.checkedState.backgroundImage, 'none', 'checked multiselect controls should render the custom checkmark');
    assert.equal(multiselectCheckboxStyle.focusRulePresent, true, 'multiselect checkbox styling should include a keyboard focus ring');

    const multiselectKeyboardSetup = await evaluate(`(() => {
      const trigger = document.querySelector('#base-type-header');
      const popover = document.querySelector('#base-type-popover');
      const notes = document.querySelector('#ink-notes');
      const checkboxes = Array.from(popover.querySelectorAll('input[type="checkbox"]'));
      window.__multiselectKeyboardTest = {
        originalConfirmDialog: desktopAPI.confirmDialog,
        originalNotes: notes.value,
        originalChecks: checkboxes.map((checkbox) => checkbox.checked),
        confirmCalls: []
      };
      checkboxes[0].checked = false;
      updateMultiselectHeader('base-type');
      desktopAPI.confirmDialog = async (options) => {
        window.__multiselectKeyboardTest.confirmCalls.push({
          title: options?.title || '',
          message: options?.message || ''
        });
        return { success: true, confirmed: false };
      };
      notes.value = notes.value + ' keyboard draft';
      trigger.focus();
      trigger.click();
      return {
        triggerLabelledBy: trigger.getAttribute('aria-labelledby') || '',
        popoverLabelledBy: popover.getAttribute('aria-labelledby') || '',
        popoverRole: popover.getAttribute('role') || ''
      };
    })()`);
    await waitForCondition(`document.querySelector('#base-type-popover').matches(':popover-open')`);
    assert.notEqual(multiselectKeyboardSetup.triggerLabelledBy, '', 'multiselect triggers should expose their field label and current value');
    assert.notEqual(multiselectKeyboardSetup.popoverLabelledBy, '', 'multiselect option groups should expose their field label');
    assert.equal(multiselectKeyboardSetup.popoverRole, 'group', 'multiselect checkbox options should expose group semantics');

    await pressBrowserKey({ key: 'Tab', code: 'Tab', keyCode: 9 });
    const multiselectFirstFocus = await evaluate(`(() => {
      const checkboxes = Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]'));
      return {
        activeIndex: checkboxes.indexOf(document.activeElement),
        open: document.querySelector('#base-type-popover').matches(':popover-open')
      };
    })()`);
    assert.equal(multiselectFirstFocus.activeIndex, 0, 'Tab from an open multiselect trigger should enter its first checkbox');
    assert.equal(multiselectFirstFocus.open, true, 'entering a multiselect with Tab should keep it open');

    await pressBrowserKey({ key: ' ', code: 'Space', keyCode: 32, text: ' ' });
    const multiselectSpaceToggle = await evaluate(`({
      checked: document.querySelector('#base-type-popover input[type="checkbox"]').checked,
      headerText: document.querySelector('#base-type-header .placeholder').textContent.trim(),
      open: document.querySelector('#base-type-popover').matches(':popover-open')
    })`);
    assert.equal(multiselectSpaceToggle.checked, true, 'Space should retain native checkbox toggling inside the multiselect');
    assert.match(multiselectSpaceToggle.headerText, /Dye/, 'Space toggling should update the multiselect header text');
    assert.equal(multiselectSpaceToggle.open, true, 'selecting a checkbox should not close a multiselect');

    await pressBrowserKey({ key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
    assert.equal(
      await evaluate(`Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]')).indexOf(document.activeElement)`),
      1,
      'Arrow Down should move to the next multiselect checkbox'
    );
    await pressBrowserKey({ key: 'Home', code: 'Home', keyCode: 36 });
    assert.equal(
      await evaluate(`Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]')).indexOf(document.activeElement)`),
      0,
      'Home should move to the first multiselect checkbox'
    );

    await pressBrowserKey({ key: 'Tab', code: 'Tab', keyCode: 9, modifiers: 8 });
    const multiselectShiftTabLoop = await evaluate(`(() => {
      const checkboxes = Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]'));
      return {
        activeIndex: checkboxes.indexOf(document.activeElement),
        open: document.querySelector('#base-type-popover').matches(':popover-open')
      };
    })()`);
    assert.equal(multiselectShiftTabLoop.activeIndex, 4, 'Shift+Tab from the first checkbox should wrap to the last checkbox');
    assert.equal(multiselectShiftTabLoop.open, true, 'Shift+Tab wrapping should keep the multiselect open');

    await pressBrowserKey({ key: 'Tab', code: 'Tab', keyCode: 9 });
    const multiselectTabLoop = await evaluate(`(() => {
      const checkboxes = Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]'));
      return {
        activeIndex: checkboxes.indexOf(document.activeElement),
        open: document.querySelector('#base-type-popover').matches(':popover-open')
      };
    })()`);
    assert.equal(multiselectTabLoop.activeIndex, 0, 'Tab from the last checkbox should wrap to the first checkbox');
    assert.equal(multiselectTabLoop.open, true, 'Tab wrapping should keep the multiselect open');

    await pressBrowserKey({ key: 'Escape', code: 'Escape', keyCode: 27 });
    await waitForCondition(`!document.querySelector('#base-type-popover').matches(':popover-open')`);
    const multiselectEscape = await evaluate(`({
      modalVisible: getComputedStyle(document.querySelector('#modal-ink')).display !== 'none',
      triggerFocused: document.activeElement === document.querySelector('#base-type-header'),
      ariaExpanded: document.querySelector('#base-type-header').getAttribute('aria-expanded'),
      confirmCalls: window.__multiselectKeyboardTest.confirmCalls.length
    })`);
    assert.equal(multiselectEscape.modalVisible, true, 'Escape from a multiselect should keep the edit panel open');
    assert.equal(multiselectEscape.triggerFocused, true, 'Escape from a multiselect should restore focus to its trigger');
    assert.equal(multiselectEscape.ariaExpanded, 'false', 'Escape should update the multiselect expanded state');
    assert.equal(multiselectEscape.confirmCalls, 0, 'Escape from a multiselect should not request discarded-edit confirmation');

    await evaluate(`(() => {
      const trigger = document.querySelector('#paper-compatibility-header');
      trigger.focus();
      trigger.click();
    })()`);
    await waitForCondition(`document.querySelector('#paper-compatibility-popover').matches(':popover-open')`);
    await pressBrowserKey({ key: 'Tab', code: 'Tab', keyCode: 9 });
    await pressBrowserKey({ key: 'Escape', code: 'Escape', keyCode: 27 });
    await waitForCondition(`!document.querySelector('#paper-compatibility-popover').matches(':popover-open')`);
    const secondMultiselectEscape = await evaluate(`({
      triggerFocused: document.activeElement === document.querySelector('#paper-compatibility-header'),
      confirmCalls: window.__multiselectKeyboardTest.confirmCalls.length
    })`);
    assert.equal(secondMultiselectEscape.triggerFocused, true, 'Paper Compatibility should share multiselect focus restoration');
    assert.equal(secondMultiselectEscape.confirmCalls, 0, 'Paper Compatibility Escape should not request discarded-edit confirmation');

    await evaluate(`document.querySelector('#ink-notes').focus()`);
    await pressBrowserKey({ key: 'Escape', code: 'Escape', keyCode: 27 });
    const activeFieldEscape = await evaluate(`({
      fieldBlurred: document.activeElement !== document.querySelector('#ink-notes'),
      modalVisible: getComputedStyle(document.querySelector('#modal-ink')).display !== 'none',
      confirmCalls: window.__multiselectKeyboardTest.confirmCalls.length
    })`);
    assert.equal(activeFieldEscape.fieldBlurred, true, 'Escape from an active form field should leave that field first');
    assert.equal(activeFieldEscape.modalVisible, true, 'leaving an active field with Escape should keep the edit panel open');
    assert.equal(activeFieldEscape.confirmCalls, 0, 'the first Escape from an active field should not request discarded-edit confirmation');

    await evaluate(`(() => {
      const heading = document.querySelector('#modal-ink h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    })()`);
    await pressBrowserKey({ key: 'Escape', code: 'Escape', keyCode: 27 });
    await waitForCondition(`window.__multiselectKeyboardTest.confirmCalls.length === 1`);
    const modalEscapeAfterField = await evaluate(`({
      modalVisible: getComputedStyle(document.querySelector('#modal-ink')).display !== 'none',
      confirmCall: window.__multiselectKeyboardTest.confirmCalls[0]
    })`);
    assert.equal(modalEscapeAfterField.modalVisible, true, 'declining the discard warning should keep the edit panel open');
    assert.equal(modalEscapeAfterField.confirmCall.title, 'Discard Changes?', 'Escape with no active field should retain the discard warning');
    assert.match(modalEscapeAfterField.confirmCall.message, /discard unsaved changes/i, 'modal Escape should retain its unsaved-edit explanation');

    await evaluate(`(() => {
      const state = window.__multiselectKeyboardTest;
      const notes = document.querySelector('#ink-notes');
      const checkboxes = Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]'));
      desktopAPI.confirmDialog = state.originalConfirmDialog;
      notes.value = state.originalNotes;
      checkboxes.forEach((checkbox, index) => {
        checkbox.checked = !!state.originalChecks[index];
      });
      updateMultiselectHeader('base-type');
      document.querySelector('#modal-ink h2').removeAttribute('tabindex');
      delete window.__multiselectKeyboardTest;
    })()`);

    await evaluate(`(() => {
      const trigger = document.querySelector('#ink-type-wrapper .custom-select-trigger');
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    })()`);
    const openedWithHome = await evaluate(`(() => {
      const trigger = document.querySelector('#ink-type-wrapper .custom-select-trigger');
      const options = document.querySelector('#ink-type-wrapper .custom-options');
      return trigger.getAttribute('aria-expanded') === 'true'
        && options.querySelector('.keyboard-active')?.dataset.value === 'Bottle';
    })()`);
    await evaluate(`document.querySelector('#ink-type-wrapper .custom-select-trigger')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
    const selectedWithEnter = await evaluate(`document.querySelector('#ink-type-input').value`);
    await evaluate(`document.querySelector('#ink-type-wrapper .custom-select-trigger')
      .dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))`);
    const openedWithSpace = await evaluate(`document.querySelector('#ink-type-wrapper .custom-select-trigger').getAttribute('aria-expanded') === 'true'`);
    await evaluate(`document.querySelector('#ink-type-wrapper .custom-select-trigger')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
    const customSelectKeyboard = await evaluate(`(() => {
      const trigger = document.querySelector('#ink-type-wrapper .custom-select-trigger');
      const options = document.querySelector('#ink-type-wrapper .custom-options');
      const settingsTrigger = document.querySelector('#default-ink-type-select-custom-trigger');
      const settingsLabel = document.querySelector('label[for="default-ink-type-select-custom-trigger"]');
      const settingsView = document.querySelector('#view-settings');
      const previousSettingsDisplay = settingsView?.style.display || '';
      const focusRetained = document.activeElement === trigger;
      if (settingsView) settingsView.style.display = 'block';
      settingsLabel?.click();
      const settingsLabelFocusedTrigger = document.activeElement === settingsTrigger;
      if (settingsView) settingsView.style.display = previousSettingsDisplay;
      const result = {
        openedWithHome: ${openedWithHome},
        selectedWithEnter: ${JSON.stringify(selectedWithEnter)},
        openedWithSpace: ${openedWithSpace},
        closedWithEscape: trigger.getAttribute('aria-expanded') === 'false' && !options.classList.contains('show'),
        triggerRole: trigger.getAttribute('role'),
        listRole: options.getAttribute('role'),
        optionRoles: Array.from(options.children).map((option) => option.getAttribute('role')),
        focusRetained,
        accessibleName: trigger.getAttribute('aria-labelledby') || trigger.getAttribute('aria-label') || '',
        settingsNativeAriaHidden: document.querySelector('#default-ink-type-select')?.getAttribute('aria-hidden') || '',
        settingsLabelFor: settingsLabel?.htmlFor || '',
        settingsTriggerId: settingsTrigger?.id || '',
        settingsAccessibleName: settingsTrigger?.getAttribute('aria-labelledby') || settingsTrigger?.getAttribute('aria-label') || '',
        settingsLabelFocusedTrigger
      };
      setCustomSelectValue('ink-type-input', 'Other');
      return result;
    })()`);
    assert.equal(customSelectKeyboard.openedWithHome, true, 'Home should open a custom select and highlight its first option');
    assert.equal(customSelectKeyboard.selectedWithEnter, 'Bottle', 'Enter should choose the highlighted custom-select option');
    assert.equal(customSelectKeyboard.openedWithSpace, true, 'Space should open a focused custom select');
    assert.equal(customSelectKeyboard.closedWithEscape, true, 'Escape should close a custom select');
    assert.equal(customSelectKeyboard.triggerRole, 'combobox', 'custom-select triggers should expose combobox semantics');
    assert.equal(customSelectKeyboard.listRole, 'listbox', 'custom-select option containers should expose listbox semantics');
    assert.ok(customSelectKeyboard.optionRoles.every((role) => role === 'option'), 'custom-select choices should expose option semantics');
    assert.equal(customSelectKeyboard.focusRetained, true, 'keyboard selection should keep focus on the custom-select trigger');
    assert.notEqual(customSelectKeyboard.accessibleName, '', 'static custom-select triggers should expose an accessible name');
    assert.equal(customSelectKeyboard.settingsNativeAriaHidden, 'true', 'enhanced native selects should be hidden from assistive technology');
    assert.equal(customSelectKeyboard.settingsLabelFor, customSelectKeyboard.settingsTriggerId, 'enhanced native-select labels should target the replacement trigger');
    assert.notEqual(customSelectKeyboard.settingsAccessibleName, '', 'enhanced native-select triggers should expose an accessible name');
    assert.equal(customSelectKeyboard.settingsLabelFocusedTrigger, true, 'clicking an enhanced native-select label should focus its replacement trigger');

    const savedInkVolume = await evaluate(`(async () => {
      document.querySelector('#ink-volume-ml-input').value = '60';
      await saveNewInk();
      const persisted = await fetch('/api/data').then((response) => response.json());
      const savedInk = persisted.data.inks.find((item) => item.id === 'ink-blue');
      return {
        volumeMl: savedInk?.volume_ml,
        hasLegacyCl: Object.prototype.hasOwnProperty.call(savedInk || {}, 'cl'),
        activityMessage: appData.activity_log.find((entry) => (
          entry.category === 'ink'
          && entry.action === 'updated'
          && entry.entity_id === 'ink-blue'
          && entry.id !== 'act-ink'
        ))?.message || ''
      };
    })()`);
    assert.equal(savedInkVolume.volumeMl, '60', 'the ink form should persist the canonical volume_ml field');
    assert.equal(savedInkVolume.hasLegacyCl, false, 'saved ink data should not reintroduce the legacy cl field');
    assert.match(savedInkVolume.activityMessage, /Volume \(ml\)/, 'new ink activity should label volume changes in milliliters');

    const inkVolumePresentation = await evaluate(`(() => {
      updateAutocompleteLists();
      renderFilters();
      const insight = computeCollectionInsights().find((row) => row.label === 'Total Ink Volume');
      openSwatchDetailModal('ink-blue', 'inks');
      const detailSections = Array.from(document.querySelectorAll('#swatch-detail-metadata > div')).map((section) => ({
        label: section.querySelector('h4')?.textContent?.trim() || '',
        value: section.querySelector('p')?.textContent?.trim() || ''
      }));
      const detailVolume = detailSections.find((section) => section.label === 'Volume (ml)');
      const result = {
        insightValue: insight?.value || '',
        insightTooltip: insight?.valueTooltip || '',
        detailValue: detailVolume?.value || '',
        filterText: document.querySelector('#filter-options-container [data-filter-category="volume"]')?.textContent?.trim() || '',
        autocompleteValues: autocompleteData['ink-volume-ml-input'] || []
      };
      closeAllModals();
      return result;
    })()`);
    assert.equal(inkVolumePresentation.insightValue, '120 ml', 'total ink volume should multiply milliliters by bottle amount');
    assert.equal(inkVolumePresentation.insightTooltip, '0.12 L', 'liter conversion should divide milliliters by 1000');
    assert.equal(inkVolumePresentation.detailValue, '60', 'ink details should display the saved milliliter value');
    assert.equal(inkVolumePresentation.filterText, '60 ml', 'ink volume filters should display milliliters');
    assert.deepEqual(inkVolumePresentation.autocompleteValues, ['60'], 'ink volume autocomplete should use volume_ml values');

    const strictColorInputs = await evaluate(`(async () => {
      await openInkModal('ink-blue');
      const inkInput = document.querySelector('#ink-colors-list .dynamic-color-slot input[type="text"]');
      const originalInkColor = currentInkColors[0];
      inkInput.value = '#"><img';
      inkInput.dispatchEvent(new Event('input', { bubbles: true }));
      const inkRejectedInvalid = currentInkColors[0] === originalInkColor;
      inkInput.value = '#AbC';
      inkInput.dispatchEvent(new Event('input', { bubbles: true }));
      const inkAcceptedValid = currentInkColors[0] === '#AbC';
      currentInkColors[0] = originalInkColor;
      renderInkColorSlots();
      closeAllModals();

      await openPenModal('pen-detail-carousel');
      const penInput = document.querySelector('#pen-colors-list .dynamic-color-slot input[type="text"]');
      const originalPenColor = currentPenColors[0];
      penInput.value = '#"><img';
      penInput.dispatchEvent(new Event('input', { bubbles: true }));
      const penRejectedInvalid = currentPenColors[0] === originalPenColor;
      penInput.value = '#A1b2C3';
      penInput.dispatchEvent(new Event('input', { bubbles: true }));
      const penAcceptedValid = currentPenColors[0] === '#A1b2C3';
      currentPenColors[0] = originalPenColor;
      renderPenColorSlots();
      closeAllModals();
      return { inkRejectedInvalid, inkAcceptedValid, penRejectedInvalid, penAcceptedValid };
    })()`);
    assert.equal(strictColorInputs.inkRejectedInvalid, true, 'ink color text inputs should reject non-hex values that only match the old length check');
    assert.equal(strictColorInputs.inkAcceptedValid, true, 'ink color text inputs should accept valid three-digit hex values');
    assert.equal(strictColorInputs.penRejectedInvalid, true, 'pen color text inputs should reject non-hex values that only match the old length check');
    assert.equal(strictColorInputs.penAcceptedValid, true, 'pen color text inputs should accept valid six-digit hex values');

    const storedInkNameEscaping = await evaluate(`(async () => {
      const ink = appData.inks.find((item) => item.id === 'ink-blue');
      const originalName = ink.name;
      const originalMatchMedia = window.matchMedia;
      const maliciousName = '<img id="stored-ink-name-injection" src="x">';
      try {
        ink.name = maliciousName;
        renderPens();
        const penCard = Array.from(document.querySelectorAll('#pens-grid .pen-card-horizontal')).find(
          (card) => card.querySelector('.pen-card-model')?.textContent.trim() === 'Detail Carousel'
        );
        const cardInjected = !!penCard?.querySelector('#stored-ink-name-injection');
        const cardText = penCard?.querySelector('.pen-card-inked-status span')?.textContent || '';

        window.matchMedia = (query) => ({
          matches: String(query).includes('max-width: 1024px'),
          media: String(query),
          addEventListener() {},
          removeEventListener() {}
        });
        openPenDetailModal('pen-detail-carousel');
        const detailInjected = !!document.querySelector('#pen-detail-metadata #stored-ink-name-injection');
        const detailText = document.querySelector('#pen-detail-metadata')?.textContent || '';
        const detailImage = document.querySelector('#pen-detail-img');
        if (detailImage && !detailImage.complete) {
          await new Promise((resolve) => {
            detailImage.addEventListener('load', resolve, { once: true });
            detailImage.addEventListener('error', resolve, { once: true });
          });
        }
        return { cardInjected, cardText, detailInjected, detailText, maliciousName };
      } finally {
        window.matchMedia = originalMatchMedia;
        ink.name = originalName;
        renderPens();
        closeAllModals();
      }
    })()`);
    assert.equal(storedInkNameEscaping.cardInjected, false, 'stored ink names should not create markup in pen cards');
    assert.match(storedInkNameEscaping.cardText, /<img id="stored-ink-name-injection"/, 'pen cards should display stored markup-like ink names as text');
    assert.equal(storedInkNameEscaping.detailInjected, false, 'stored ink names should not create markup in mobile pen details');
    assert.match(storedInkNameEscaping.detailText, /<img id="stored-ink-name-injection"/, 'mobile pen details should display stored markup-like ink names as text');

    const settingsTextNoopPersistence = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalPreferences = JSON.parse(JSON.stringify(appData.preferences));
      const snapshots = [];
      const clearNotice = () => {
        if (appNoticeTimer) {
          clearTimeout(appNoticeTimer);
          appNoticeTimer = null;
        }
        document.querySelector('.app-notice-floating')?.classList.remove('is-visible');
      };
      try {
        if (settingsInputPersistTimer) {
          clearTimeout(settingsInputPersistTimer);
          settingsInputPersistTimer = null;
        }
        await settingsPersistQueue;
        settingsPersistQueue = Promise.resolve();
        appData.preferences.defaults.pen_nib = '';
        renderSettingsView();
        desktopAPI.saveData = async (data) => {
          snapshots.push(JSON.parse(JSON.stringify(data)));
          return { success: true };
        };

        clearNotice();
        const unchangedFields = [
          showcaseTitleInput,
          defaultPenNibInput,
          defaultPenNibMaterialInput,
          backupRetentionCountInput
        ];
        for (const field of unchangedFields) {
          field.focus();
          field.blur();
        }
        await settingsPersistQueue;
        await new Promise((resolve) => setTimeout(resolve, 20));
        const noticeAfterNoop = document.querySelector('.app-notice-floating');
        const unchanged = {
          saveCalls: snapshots.length,
          noticeVisible: noticeAfterNoop?.classList.contains('is-visible') || false,
          noticeText: noticeAfterNoop?.textContent || ''
        };

        const editedTitle = 'Edited Settings Persistence Title';
        showcaseTitleInput.focus();
        showcaseTitleInput.value = editedTitle;
        showcaseTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
        showcaseTitleInput.dispatchEvent(new Event('change', { bubbles: true }));
        showcaseTitleInput.blur();
        await settingsPersistQueue;
        await new Promise((resolve) => setTimeout(resolve, 600));
        await settingsPersistQueue;
        const noticeAfterEdit = document.querySelector('.app-notice-floating');
        const edited = {
          saveCalls: snapshots.length,
          savedTitle: snapshots[0]?.preferences?.showcase?.title || '',
          currentTitle: appData.preferences.showcase.title,
          noticeVisible: noticeAfterEdit?.classList.contains('is-visible') || false,
          noticeText: noticeAfterEdit?.textContent || '',
          pendingTimer: settingsInputPersistTimer !== null
        };

        clearNotice();
        const forcedNoopResult = await persistShowcaseSettingsNow({ force: true });
        const noticeAfterForcedNoop = document.querySelector('.app-notice-floating');
        const forcedNoop = {
          result: forcedNoopResult,
          saveCalls: snapshots.length,
          noticeVisible: noticeAfterForcedNoop?.classList.contains('is-visible') || false
        };

        return { unchanged, edited, forcedNoop, editedTitle };
      } finally {
        if (settingsInputPersistTimer) {
          clearTimeout(settingsInputPersistTimer);
          settingsInputPersistTimer = null;
        }
        await settingsPersistQueue;
        desktopAPI.saveData = originalSaveData;
        appData.preferences = originalPreferences;
        settingsPersistQueue = Promise.resolve();
        settingsFormNeedsSync = false;
        clearNotice();
        renderSettingsView();
        applyShowcaseTitleUi();
      }
    })()`);
    assert.equal(settingsTextNoopPersistence.unchanged.saveCalls, 0, 'unchanged Settings text fields should not write data on blur');
    assert.equal(settingsTextNoopPersistence.unchanged.noticeVisible, false, 'unchanged Settings text fields should not show a success notice');
    assert.equal(settingsTextNoopPersistence.edited.saveCalls, 1, 'one real Settings text edit should persist exactly once');
    assert.equal(settingsTextNoopPersistence.edited.savedTitle, settingsTextNoopPersistence.editedTitle, 'a real Settings text edit should reach persistence');
    assert.equal(settingsTextNoopPersistence.edited.currentTitle, settingsTextNoopPersistence.editedTitle, 'a saved Settings text edit should update in-memory preferences');
    assert.equal(settingsTextNoopPersistence.edited.noticeVisible, true, 'a real Settings text edit should show its success notice');
    assert.equal(settingsTextNoopPersistence.edited.noticeText, 'Settings saved', 'a real Settings text edit should retain the existing success message');
    assert.equal(settingsTextNoopPersistence.edited.pendingTimer, false, 'an immediate Settings text save should clear its debounce timer');
    assert.equal(settingsTextNoopPersistence.forcedNoop.result, true, 'a forced no-op settings flush should report that settings are ready');
    assert.equal(settingsTextNoopPersistence.forcedNoop.saveCalls, 1, 'a forced no-op settings flush should not write data');
    assert.equal(settingsTextNoopPersistence.forcedNoop.noticeVisible, false, 'a forced no-op settings flush should not show a success notice');

    const failedShowcaseSettingsExport = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalExportShowcase = desktopAPI.exportShowcase;
      const originalDockerMode = isDockerMode;
      const originalPreferences = JSON.parse(JSON.stringify(appData.preferences));
      let saveCalls = 0;
      let exportCalls = 0;
      try {
        isDockerMode = false;
        desktopAPI.saveData = async () => {
          saveCalls += 1;
          return { success: false, message: 'Forced settings persistence failure.' };
        };
        desktopAPI.exportShowcase = async () => {
          exportCalls += 1;
          return { success: true, path: '/tmp/should-not-export' };
        };
        const originalShowPrices = !!appData.preferences.showcase.show_prices;
        const originalTitle = normalizeShowcaseTitle(appData.preferences.showcase.title);
        toggleShowcasePricesVisible.checked = !originalShowPrices;
        showcaseTitleInput.value = 'Rejected Preview Title';
        showcaseTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#btn-export-showcase').click();
        while (showcaseExportInFlight) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        const showcasePreferenceRestored = appData.preferences.showcase.show_prices === originalShowPrices;
        const showcaseControlRestored = toggleShowcasePricesVisible.checked === originalShowPrices;
        const showcaseTitleRestored = appLogoTitle?.textContent === originalTitle;

        const originalActivityVisibility = !!appData.preferences.show_activity_log;
        toggleActivityVisible.checked = !originalActivityVisibility;
        toggleActivityVisible.dispatchEvent(new Event('change', { bubbles: true }));
        while (saveCalls < 2) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        const activityPreferenceRestored = appData.preferences.show_activity_log === originalActivityVisibility;
        const activityControlRestored = toggleActivityVisible.checked === originalActivityVisibility;

        const originalRecentActivityVisibility = !!appData.preferences.show_recent_activity;
        toggleRecentActivityVisible.checked = !originalRecentActivityVisibility;
        toggleRecentActivityVisible.dispatchEvent(new Event('change', { bubbles: true }));
        while (saveCalls < 3) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        const recentActivityPreferenceRestored = appData.preferences.show_recent_activity === originalRecentActivityVisibility;
        const recentActivityControlRestored = toggleRecentActivityVisible.checked === originalRecentActivityVisibility;

        return {
          saveCalls,
          exportCalls,
          showcasePreferenceRestored,
          showcaseControlRestored,
          showcaseTitleRestored,
          activityPreferenceRestored,
          activityControlRestored,
          recentActivityPreferenceRestored,
          recentActivityControlRestored
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.exportShowcase = originalExportShowcase;
        isDockerMode = originalDockerMode;
        appData.preferences = originalPreferences;
        showcaseExportInFlight = false;
        suppressSettingsPersist = false;
        renderSettingsView();
        applyShowcaseTitleUi();
      }
    })()`);
    assert.equal(failedShowcaseSettingsExport.saveCalls, 3, 'failed visibility-setting attempts should each reach persistence once');
    assert.equal(failedShowcaseSettingsExport.exportCalls, 0, 'showcase export should stop when current settings cannot be persisted');
    assert.equal(failedShowcaseSettingsExport.showcasePreferenceRestored, true, 'failed showcase settings should restore the prior in-memory preferences');
    assert.equal(failedShowcaseSettingsExport.showcaseControlRestored, true, 'failed showcase settings should resync their form controls');
    assert.equal(failedShowcaseSettingsExport.showcaseTitleRestored, true, 'failed showcase title persistence should restore the visible app title');
    assert.equal(failedShowcaseSettingsExport.activityPreferenceRestored, true, 'failed Activity Log visibility should restore its prior preference');
    assert.equal(failedShowcaseSettingsExport.activityControlRestored, true, 'failed Activity Log visibility should resync its toggle');
    assert.equal(failedShowcaseSettingsExport.recentActivityPreferenceRestored, true, 'failed Recent Activity visibility should restore its prior preference');
    assert.equal(failedShowcaseSettingsExport.recentActivityControlRestored, true, 'failed Recent Activity visibility should resync its toggle');

    const serializedSettingsRollback = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalPreferences = JSON.parse(JSON.stringify(appData.preferences));
      let releaseFirstSave = null;
      let saveCalls = 0;
      try {
        desktopAPI.saveData = async () => {
          saveCalls += 1;
          if (saveCalls === 1) {
            await new Promise((resolve) => {
              releaseFirstSave = resolve;
            });
            return { success: true };
          }
          return { success: false, message: 'Forced second settings failure.' };
        };

        const originalShowPrices = !!appData.preferences.showcase.show_prices;
        const originalShowCharts = !!appData.preferences.showcase.show_charts;
        toggleShowcasePricesVisible.checked = !originalShowPrices;
        const firstSave = persistShowcaseSettingsNow({ notify: false });
        while (saveCalls < 1 || !releaseFirstSave) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        toggleShowcaseChartsVisible.checked = !originalShowCharts;
        const secondSave = persistShowcaseSettingsNow({ notify: false });
        releaseFirstSave();
        const results = await Promise.all([firstSave, secondSave]);

        return {
          results,
          saveCalls,
          showPrices: !!appData.preferences.showcase.show_prices,
          showCharts: !!appData.preferences.showcase.show_charts,
          priceControl: !!toggleShowcasePricesVisible.checked,
          chartControl: !!toggleShowcaseChartsVisible.checked,
          expectedPrices: !originalShowPrices,
          expectedCharts: originalShowCharts
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        appData.preferences = originalPreferences;
        settingsPersistQueue = Promise.resolve();
        settingsFormNeedsSync = false;
        renderSettingsView();
      }
    })()`);
    assert.deepEqual(serializedSettingsRollback.results, [true, false], 'queued settings saves should report their own outcomes');
    assert.equal(serializedSettingsRollback.saveCalls, 2, 'overlapping settings changes should persist in order');
    assert.equal(serializedSettingsRollback.showPrices, serializedSettingsRollback.expectedPrices, 'a failed later settings save should retain the last successful preference state');
    assert.equal(serializedSettingsRollback.showCharts, serializedSettingsRollback.expectedCharts, 'a failed later settings save should roll back only its own preference changes');
    assert.equal(serializedSettingsRollback.priceControl, serializedSettingsRollback.expectedPrices, 'settings controls should reflect the last successful queued save');
    assert.equal(serializedSettingsRollback.chartControl, serializedSettingsRollback.expectedCharts, 'failed queued settings controls should resync to persisted state');

    const mixedSettingsQueue = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalPreferences = JSON.parse(JSON.stringify(appData.preferences));
      const snapshots = [];
      let releaseFirstSave = null;
      try {
        desktopAPI.saveData = async (data) => {
          snapshots.push(JSON.parse(JSON.stringify(data)));
          if (snapshots.length === 1) {
            await new Promise((resolve) => {
              releaseFirstSave = resolve;
            });
          }
          return { success: true };
        };

        const originalShowPrices = !!appData.preferences.showcase.show_prices;
        const originalActivityVisible = !!appData.preferences.show_activity_log;
        toggleShowcasePricesVisible.checked = !originalShowPrices;
        const firstSave = persistShowcaseSettingsNow({ notify: false });
        while (snapshots.length < 1 || !releaseFirstSave) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        toggleActivityVisible.checked = !originalActivityVisible;
        toggleActivityVisible.dispatchEvent(new Event('change', { bubbles: true }));
        releaseFirstSave();
        await firstSave;
        await settingsPersistQueue;

        return {
          saveCalls: snapshots.length,
          secondSnapshotShowPrices: !!snapshots[1]?.preferences?.showcase?.show_prices,
          secondSnapshotActivityVisible: !!snapshots[1]?.preferences?.show_activity_log,
          inMemoryShowPrices: !!appData.preferences.showcase.show_prices,
          inMemoryActivityVisible: !!appData.preferences.show_activity_log,
          expectedShowPrices: !originalShowPrices,
          expectedActivityVisible: !originalActivityVisible
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        appData.preferences = originalPreferences;
        settingsPersistQueue = Promise.resolve();
        settingsFormNeedsSync = false;
        renderSettingsView();
      }
    })()`);
    assert.equal(mixedSettingsQueue.saveCalls, 2, 'different settings handlers should share one ordered queue');
    assert.equal(mixedSettingsQueue.secondSnapshotShowPrices, mixedSettingsQueue.expectedShowPrices, 'a later special settings save should include earlier successful general settings');
    assert.equal(mixedSettingsQueue.secondSnapshotActivityVisible, mixedSettingsQueue.expectedActivityVisible, 'the later special settings save should include its requested value');
    assert.equal(mixedSettingsQueue.inMemoryShowPrices, mixedSettingsQueue.expectedShowPrices, 'mixed queued settings should keep disk and memory aligned');
    assert.equal(mixedSettingsQueue.inMemoryActivityVisible, mixedSettingsQueue.expectedActivityVisible, 'mixed queued special settings should apply in memory after persistence');

    const failedSettingsIsolation = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalPreferences = JSON.parse(JSON.stringify(appData.preferences));
      const originalPens = cloneCollectionArray(appData.pens);
      const snapshots = [];
      let releaseSettingsSave = null;
      try {
        desktopAPI.saveData = async (data) => {
          snapshots.push(JSON.parse(JSON.stringify(data)));
          if (snapshots.length === 1) {
            await new Promise((resolve) => {
              releaseSettingsSave = resolve;
            });
            return { success: false, message: 'Forced isolated settings failure.' };
          }
          return { success: true };
        };

        const originalShowPrices = !!appData.preferences.showcase.show_prices;
        toggleShowcasePricesVisible.checked = !originalShowPrices;
        const settingsSave = persistShowcaseSettingsNow({ notify: false });
        while (snapshots.length < 1 || !releaseSettingsSave) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        appData.pens[0].notes = 'collection save after failed settings';
        const collectionSave = persistDataAndRefresh({ refresh: {} });
        await new Promise((resolve) => setTimeout(resolve, 15));
        const collectionWaited = snapshots.length === 1;
        releaseSettingsSave();
        const results = await Promise.all([settingsSave, collectionSave]);

        return {
          results,
          collectionWaited,
          saveCalls: snapshots.length,
          secondSnapshotShowPrices: !!snapshots[1]?.preferences?.showcase?.show_prices,
          expectedShowPrices: originalShowPrices,
          secondSnapshotNotes: snapshots[1]?.pens?.[0]?.notes || '',
          inMemoryShowPrices: !!appData.preferences.showcase.show_prices
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        appData.preferences = originalPreferences;
        appData.pens = originalPens;
        settingsPersistQueue = Promise.resolve();
        settingsFormNeedsSync = false;
        renderSettingsView();
      }
    })()`);
    assert.deepEqual(failedSettingsIsolation.results, [false, true], 'a collection save should continue after an earlier settings save fails');
    assert.equal(failedSettingsIsolation.collectionWaited, true, 'collection persistence should wait for pending settings persistence');
    assert.equal(failedSettingsIsolation.saveCalls, 2, 'the settings and collection snapshots should persist separately');
    assert.equal(failedSettingsIsolation.secondSnapshotShowPrices, failedSettingsIsolation.expectedShowPrices, 'a later collection save should not persist failed settings');
    assert.equal(failedSettingsIsolation.secondSnapshotNotes, 'collection save after failed settings', 'the later collection save should retain its own data mutation');
    assert.equal(failedSettingsIsolation.inMemoryShowPrices, failedSettingsIsolation.expectedShowPrices, 'failed settings should remain rolled back in memory');

    const retentionConcurrentDelete = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalPreferences = JSON.parse(JSON.stringify(appData.preferences));
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      const snapshots = [];
      let releaseRetentionSave = null;
      try {
        const now = Date.now();
        appData.activity_log.push(
          { id: 'retention-delete', timestamp: now, action: 'updated', category: 'ink', message: 'Delete during retention.' },
          { id: 'retention-keep', timestamp: now, action: 'updated', category: 'ink', message: 'Keep during retention.' }
        );
        desktopAPI.saveData = async (data) => {
          snapshots.push(JSON.parse(JSON.stringify(data)));
          if (snapshots.length === 1) {
            await new Promise((resolve) => {
              releaseRetentionSave = resolve;
            });
          }
          return { success: true };
        };

        activityRetentionSelect.value = '365';
        activityRetentionSelect.dispatchEvent(new Event('change', { bubbles: true }));
        while (snapshots.length < 1 || !releaseRetentionSave) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        const deleteSave = deleteActivityEntry('retention-delete');
        await new Promise((resolve) => setTimeout(resolve, 15));
        const deleteWaited = snapshots.length === 1;
        releaseRetentionSave();
        const deleteResult = await deleteSave;
        await settingsPersistQueue;

        return {
          deleteResult,
          deleteWaited,
          saveCalls: snapshots.length,
          secondHasDeletedEntry: snapshots[1]?.activity_log?.some((entry) => entry.id === 'retention-delete') || false,
          secondHasKeptEntry: snapshots[1]?.activity_log?.some((entry) => entry.id === 'retention-keep') || false,
          memoryHasDeletedEntry: appData.activity_log.some((entry) => entry.id === 'retention-delete'),
          memoryHasKeptEntry: appData.activity_log.some((entry) => entry.id === 'retention-keep')
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        appData.preferences = originalPreferences;
        appData.activity_log = originalActivityLog;
        settingsPersistQueue = Promise.resolve();
        settingsFormNeedsSync = false;
        renderSettingsView();
      }
    })()`);
    assert.equal(retentionConcurrentDelete.deleteResult, true, 'activity deletion should complete after retention persistence');
    assert.equal(retentionConcurrentDelete.deleteWaited, true, 'activity deletion persistence should wait for retention settings');
    assert.equal(retentionConcurrentDelete.saveCalls, 2, 'retention and the later activity deletion should persist separately');
    assert.equal(retentionConcurrentDelete.secondHasDeletedEntry, false, 'retention success should not restore an entry deleted while it was saving');
    assert.equal(retentionConcurrentDelete.secondHasKeptEntry, true, 'retention success should preserve unrelated current activity');
    assert.equal(retentionConcurrentDelete.memoryHasDeletedEntry, false, 'retention and delete memory state should match persistence');
    assert.equal(retentionConcurrentDelete.memoryHasKeptEntry, true, 'retention should keep unrelated current activity in memory');

    const importWaitsForSettings = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalSelectBackup = desktopAPI.selectBackup;
      const originalImportBackup = desktopAPI.importBackup;
      const originalData = JSON.parse(JSON.stringify(appData));
      const snapshots = [];
      const callOrder = [];
      let releaseFirstSave = null;
      let releaseImport = null;
      let importCalls = 0;
      try {
        appData.preferences.confirm_destructive_actions = false;
        const importedData = JSON.parse(JSON.stringify(appData));
        importedData.pens[0].notes = 'imported after settings queue';
        desktopAPI.saveData = async (data) => {
          snapshots.push(JSON.parse(JSON.stringify(data)));
          callOrder.push('settings-save');
          if (snapshots.length === 1) {
            await new Promise((resolve) => {
              releaseFirstSave = resolve;
            });
          }
          return { success: true };
        };
        desktopAPI.selectBackup = async () => {
          callOrder.push('select-backup');
          return '/tmp/queued-settings-import.zip';
        };
        desktopAPI.importBackup = async () => {
          importCalls += 1;
          callOrder.push('import-backup');
          await new Promise((resolve) => {
            releaseImport = resolve;
          });
          return { success: true, data: importedData };
        };

        const originalShowPrices = !!appData.preferences.showcase.show_prices;
        const originalShowCharts = !!appData.preferences.showcase.show_charts;
        toggleShowcasePricesVisible.checked = !originalShowPrices;
        const firstSave = persistShowcaseSettingsNow({ notify: false });
        while (snapshots.length < 1 || !releaseFirstSave) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        toggleShowcaseChartsVisible.checked = !originalShowCharts;
        const secondSave = persistShowcaseSettingsNow({ notify: false });
        document.querySelector('#btn-import-backup').click();
        while (!backupImportInFlight) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
        const importWaited = importCalls === 0;

        releaseFirstSave();
        await Promise.all([firstSave, secondSave]);
        while (importCalls < 1 || !releaseImport) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const noticeDuringImport = document.querySelector('.app-notice-floating');
        const persistentNotice = {
          text: noticeDuringImport?.textContent || '',
          visible: noticeDuringImport?.classList.contains('is-visible') || false,
          timerless: appNoticeTimer === null
        };
        releaseImport();
        while (backupImportInFlight) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
        const noticeAfterImport = document.querySelector('.app-notice-floating');

        return {
          importWaited,
          importCalls,
          settingsSaveCalls: snapshots.length,
          callOrder,
          importedNotes: appData.pens[0]?.notes || '',
          settingsViewInert: !!viewSettings?.inert,
          persistentNotice,
          completedNotice: {
            text: noticeAfterImport?.textContent || '',
            visible: noticeAfterImport?.classList.contains('is-visible') || false,
            timerScheduled: appNoticeTimer !== null
          }
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.selectBackup = originalSelectBackup;
        desktopAPI.importBackup = originalImportBackup;
        appData = ensureAppDataDefaults(originalData);
        backupImportInFlight = false;
        settingsPersistQueue = Promise.resolve();
        settingsFormNeedsSync = false;
        setSettingsOperationBusy(false);
        if (appNoticeTimer) {
          clearTimeout(appNoticeTimer);
          appNoticeTimer = null;
        }
        document.querySelector('.app-notice-floating')?.classList.remove('is-visible');
        renderSettingsView();
      }
    })()`);
    assert.equal(importWaitsForSettings.importWaited, true, 'backup import should wait for all queued settings saves');
    assert.equal(importWaitsForSettings.importCalls, 1, 'backup import should run once after settings drain');
    assert.equal(importWaitsForSettings.settingsSaveCalls, 2, 'queued settings should complete before import');
    assert.deepEqual(
      importWaitsForSettings.callOrder,
      ['settings-save', 'settings-save', 'select-backup', 'import-backup'],
      'backup selection and import should begin only after queued settings persistence'
    );
    assert.equal(importWaitsForSettings.importedNotes, 'imported after settings queue', 'late settings candidates should not overwrite imported collection data');
    assert.equal(importWaitsForSettings.settingsViewInert, false, 'settings should unlock after backup import');
    assert.equal(importWaitsForSettings.persistentNotice.visible, true, 'backup progress notice should stay visible while import is pending');
    assert.equal(importWaitsForSettings.persistentNotice.timerless, true, 'backup progress notice should remain timerless while import is pending');
    assert.match(importWaitsForSettings.persistentNotice.text, /Importing backup/i);
    assert.equal(importWaitsForSettings.completedNotice.text, 'Backup imported successfully', 'success should replace the progress notice');
    assert.equal(importWaitsForSettings.completedNotice.visible, true, 'the terminal import notice should be visible');
    assert.equal(importWaitsForSettings.completedNotice.timerScheduled, true, 'the terminal import notice should dismiss normally');

    const failedImportNotice = await evaluate(`(async () => {
      const originalSelectBackup = desktopAPI.selectBackup;
      const originalImportBackup = desktopAPI.importBackup;
      let releaseImport = null;
      try {
        appData.preferences.confirm_destructive_actions = false;
        desktopAPI.selectBackup = async () => '/tmp/failing-import.zip';
        desktopAPI.importBackup = async () => {
          await new Promise((resolve) => {
            releaseImport = resolve;
          });
          throw new Error('simulated backup failure');
        };
        document.querySelector('#btn-import-backup').click();
        while (!releaseImport) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const noticeDuringImport = document.querySelector('.app-notice-floating');
        const pending = {
          visible: noticeDuringImport?.classList.contains('is-visible') || false,
          timerless: appNoticeTimer === null
        };
        releaseImport();
        while (backupImportInFlight) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const noticeAfterImport = document.querySelector('.app-notice-floating');
        return {
          pending,
          text: noticeAfterImport?.textContent || '',
          error: noticeAfterImport?.classList.contains('is-error') || false,
          timerScheduled: appNoticeTimer !== null,
          buttonDisabled: !!btnImportBackup?.disabled,
          settingsViewInert: !!viewSettings?.inert
        };
      } finally {
        desktopAPI.selectBackup = originalSelectBackup;
        desktopAPI.importBackup = originalImportBackup;
        backupImportInFlight = false;
        setSettingsOperationBusy(false);
        if (appNoticeTimer) {
          clearTimeout(appNoticeTimer);
          appNoticeTimer = null;
        }
        document.querySelector('.app-notice-floating')?.classList.remove('is-visible');
      }
    })()`);
    assert.equal(failedImportNotice.pending.visible, true, 'failed imports should retain progress while pending');
    assert.equal(failedImportNotice.pending.timerless, true, 'failed imports should not time out before completion');
    assert.match(failedImportNotice.text, /Backup import failed: simulated backup failure/i);
    assert.equal(failedImportNotice.error, true, 'failed imports should replace progress with an error notice');
    assert.equal(failedImportNotice.timerScheduled, true, 'import error notices should dismiss normally');
    assert.equal(failedImportNotice.buttonDisabled, false, 'the import button should unlock after failure');
    assert.equal(failedImportNotice.settingsViewInert, false, 'settings should unlock after import failure');

    const dockerRemoteHeic = await evaluate(`(async () => {
      const url = 'https://example.invalid/renderer-order-test.heic';
      const originalReadRemoteImageBytes = desktopAPI.readRemoteImageBytes;
      const originalSaveImageBytes = desktopAPI.saveImageBytes;
      const originalHeic = window.inkubatorHeic;
      const calls = [];
      try {
        convertedRemoteHeicImageCache.delete(url);
        desktopAPI.readRemoteImageBytes = async () => {
          calls.push('read');
          return { base64: 'AQID', sourceHint: 'remote-order-test.heic' };
        };
        desktopAPI.saveImageBytes = async (bytesBase64, imageType, metadata, sourceHint) => {
          calls.push('save');
          return {
            filename: 'swatches/converted-order-test.webp',
            bytesBase64,
            imageType,
            metadata,
            sourceHint
          };
        };
        window.inkubatorHeic = {
          hasHeicExtension: () => true,
          convertBytesToWebp: async () => {
            calls.push('convert');
            return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          }
        };
        const result = await saveRemoteImageUrl(url, 'swatch', { brand: 'Pilot', model: 'Blue Test' });
        window.inkubatorHeic.convertBytesToWebp = async () => (
          new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
        );
        const webp = await convertHeicBytesForManagedImage(new Uint8Array([1]), 'webp-test.heic');
        URL.revokeObjectURL(webp.objectUrl);
        window.inkubatorHeic.convertBytesToWebp = async () => new Uint8Array([1, 2, 3]);
        let invalidRejected = false;
        try {
          await convertHeicBytesForManagedImage(new Uint8Array([1]), 'invalid-test.heic');
        } catch (error) {
          invalidRejected = /unsupported image format/i.test(error?.message || '');
        }
        return {
          calls,
          success: result.success,
          filename: result.filename?.filename || '',
          bytesBase64: result.filename?.bytesBase64 || '',
          sourceHint: result.filename?.sourceHint || '',
          webpSourceHint: webp.sourceHint,
          invalidRejected
        };
      } finally {
        desktopAPI.readRemoteImageBytes = originalReadRemoteImageBytes;
        desktopAPI.saveImageBytes = originalSaveImageBytes;
        window.inkubatorHeic = originalHeic;
        convertedRemoteHeicImageCache.delete(url);
      }
    })()`);
    assert.deepEqual(dockerRemoteHeic.calls, ['read', 'convert', 'save'], 'Docker remote HEIC images should be converted before saving');
    assert.equal(dockerRemoteHeic.success, true, 'converted Docker remote HEIC images should report a successful save');
    assert.equal(dockerRemoteHeic.filename, 'swatches/converted-order-test.webp', 'Docker remote HEIC saves should return the managed filename');
    assert.equal(dockerRemoteHeic.bytesBase64, 'iVBORw0KGgo=', 'Docker remote HEIC saves should use converted bytes');
    assert.match(dockerRemoteHeic.sourceHint, /\.png$/, 'PNG encoder fallbacks should pass an accurate converted source hint');
    assert.match(dockerRemoteHeic.webpSourceHint, /\.webp$/, 'real WebP conversions should pass a WebP source hint');
    assert.equal(dockerRemoteHeic.invalidRejected, true, 'HEIC conversion should reject output that is neither PNG nor WebP');

    const atomicGalleryFailure = await evaluate(`(async () => {
      const originalSaveImage = desktopAPI.saveImage;
      const originalDeleteImage = desktopAPI.deleteImage;
      const gallery = [
        { id: 'existing', path: 'swatches/swatch-a.png', rotation: 0, primary: true },
        { id: 'pending-a', path: 'docker-upload:atomic-a', rotation: 0, primary: false },
        { id: 'pending-b', path: 'docker-upload:atomic-b', rotation: 0, primary: false }
      ];
      const saveCalls = [];
      const deletedPaths = [];
      try {
        desktopAPI.saveImage = async (sourcePath) => {
          saveCalls.push(sourcePath);
          if (sourcePath === 'docker-upload:atomic-a') return 'swatches/atomic-a.webp';
          throw new Error('Forced second image failure.');
        };
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };
        let failure = null;
        try {
          await savePendingGalleryImages(gallery, 'swatch', { brand: 'Pilot', model: 'Atomic' });
        } catch (error) {
          failure = {
            message: error?.message || '',
            cause: error?.cause?.message || '',
            cleanupFailed: !!error?.cleanupFailed
          };
        }
        return {
          saveCalls,
          deletedPaths,
          galleryPaths: gallery.map((entry) => entry.path),
          failure
        };
      } finally {
        desktopAPI.saveImage = originalSaveImage;
        desktopAPI.deleteImage = originalDeleteImage;
      }
    })()`);
    assert.deepEqual(
      atomicGalleryFailure.saveCalls,
      ['docker-upload:atomic-a', 'docker-upload:atomic-b'],
      'atomic gallery saves should attempt pending images in order'
    );
    assert.deepEqual(
      atomicGalleryFailure.deletedPaths,
      ['swatches/atomic-a.webp'],
      'a later image failure should delete only files created earlier in the same attempt'
    );
    assert.deepEqual(
      atomicGalleryFailure.galleryPaths,
      ['swatches/swatch-a.png', 'docker-upload:atomic-a', 'docker-upload:atomic-b'],
      'an image failure should leave the original gallery selections unchanged'
    );
    assert.match(atomicGalleryFailure.failure?.message || '', /nothing was changed/i, 'atomic gallery failure should explain that no partial save was accepted');
    assert.match(atomicGalleryFailure.failure?.cause || '', /second image failure/i, 'atomic gallery failure should retain its original cause');
    assert.equal(atomicGalleryFailure.failure?.cleanupFailed, false, 'successful rollback should not report a cleanup failure');

    const failedNewSwatchSave = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalSaveImage = desktopAPI.saveImage;
      const originalDeleteImage = desktopAPI.deleteImage;
      const originalActivityLog = appData.activity_log;
      const deletedPaths = [];
      appData.activity_log = Array.from({ length: MAX_ACTIVITY_ENTRIES }, (_, index) => ({
        id: \`rollback-activity-\${index}\`,
        timestamp: Date.now(),
        action: 'updated',
        category: 'ink',
        message: \`Rollback activity \${index}\`
      }));
      const before = {
        swatches: appData.swatches.length,
        activity: appData.activity_log.length,
        firstActivityId: appData.activity_log[0]?.id || '',
        lastActivityId: appData.activity_log.at(-1)?.id || '',
        pathname: window.location.pathname
      };
      try {
        await openAddSwatchModal();
        setSwatchLinkedInkSelection('ink-blue');
        currentSwatchImageCandidate = { type: 'upload', value: 'docker-upload:rollback-a' };
        setSwatchModalGallery([
          {
            id: 'failed-save-selection-a',
            path: 'docker-upload:rollback-a',
            previewSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/%3E',
            rotation: 0,
            primary: true
          },
          {
            id: 'failed-save-selection-b',
            path: 'docker-upload:rollback-b',
            previewSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/%3E',
            rotation: 0,
            primary: false
          }
        ]);
        desktopAPI.saveImage = async (sourcePath) => (
          sourcePath === 'docker-upload:rollback-a'
            ? 'swatches/rollback-a.webp'
            : 'swatches/rollback-b.webp'
        );
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };
        desktopAPI.saveData = async () => ({
          success: false,
          message: 'Forced renderer persistence failure.'
        });
        document.querySelector('#btn-save-swatch-unified').click();
        while (isSavingSwatch) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return {
          modalVisible: getComputedStyle(document.querySelector('#modal-add-swatch')).display !== 'none',
          swatches: appData.swatches.length,
          activity: appData.activity_log.length,
          firstActivityId: appData.activity_log[0]?.id || '',
          lastActivityId: appData.activity_log.at(-1)?.id || '',
          pathname: window.location.pathname,
          galleryLength: currentSwatchGallery.length,
          galleryPaths: currentSwatchGallery.map((entry) => entry.path),
          candidateRetained: !!currentSwatchImageCandidate,
          deletedPaths,
          validation: document.querySelector('#swatch-validation-msg')?.textContent || '',
          before
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.saveImage = originalSaveImage;
        desktopAPI.deleteImage = originalDeleteImage;
        appData.activity_log = originalActivityLog;
        closeAllModals();
      }
    })()`);
    assert.equal(failedNewSwatchSave.modalVisible, true, 'a failed new-swatch persistence attempt should keep the modal open');
    assert.equal(failedNewSwatchSave.swatches, failedNewSwatchSave.before.swatches, 'a failed new-swatch save should roll back the staged swatch');
    assert.equal(failedNewSwatchSave.activity, failedNewSwatchSave.before.activity, 'a failed new-swatch save should roll back its staged activity entry');
    assert.equal(failedNewSwatchSave.firstActivityId, failedNewSwatchSave.before.firstActivityId, 'failed swatch rollback should preserve the first prior activity entry');
    assert.equal(failedNewSwatchSave.lastActivityId, failedNewSwatchSave.before.lastActivityId, 'failed swatch rollback should restore an activity entry displaced by the size limit');
    assert.equal(failedNewSwatchSave.pathname, failedNewSwatchSave.before.pathname, 'a failed new-swatch save should not switch views');
    assert.equal(failedNewSwatchSave.galleryLength, 2, 'a failed new-swatch save should retain the selected gallery');
    assert.deepEqual(
      failedNewSwatchSave.galleryPaths,
      ['docker-upload:rollback-a', 'docker-upload:rollback-b'],
      'a failed new-swatch save should retain its original pending image selections'
    );
    assert.deepEqual(
      failedNewSwatchSave.deletedPaths,
      ['swatches/rollback-a.webp', 'swatches/rollback-b.webp'],
      'a failed new-swatch collection save should delete every image created for that attempt'
    );
    assert.match(failedNewSwatchSave.validation, /nothing was changed/i, 'a failed new-swatch save should show an atomic rollback message');
    assert.equal(failedNewSwatchSave.candidateRetained, true, 'a failed new-swatch save should remain retryable');

    const penPhotoProcessingLock = await evaluate(`(async () => {
      const originalSelectImage = desktopAPI.selectImage;
      const originalGetImagePreviewUrl = desktopAPI.getImagePreviewUrl;
      const originalDetectPenColors = desktopAPI.detectPenColors;
      const originalPens = cloneCollectionArray(appData.pens);
      let releaseDetection = null;
      let detectionCalls = 0;
      try {
        await openPenModal('pen-detail-carousel');
        desktopAPI.selectImage = async () => 'docker-upload:pending-pen-photo';
        desktopAPI.getImagePreviewUrl = async () => (
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="8"%3E%3Crect width="4" height="8" fill="%23112233"/%3E%3C/svg%3E'
        );
        desktopAPI.detectPenColors = async () => {
          detectionCalls += 1;
          return await new Promise((resolve) => {
            releaseDetection = () => resolve({
              success: true,
              colors: { base: '#112233', palette: ['#112233'] }
            });
          });
        };

        await selectPenPhoto({ append: true });
        while (detectionCalls < 1 || !releaseDetection || !pendingPenPhotoPromise) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const processingPromise = pendingPenPhotoPromise;
        const closeResult = await requestCloseAllModals();
        const inertDuringProcessing = !!document.querySelector('#modal-pen .modal')?.inert;
        releaseDetection();
        const processingResult = await processingPromise;

        return {
          closeResult,
          inertDuringProcessing,
          processingResult,
          pendingAfterProcessing: !!pendingPenPhotoPromise,
          inertAfterProcessing: !!document.querySelector('#modal-pen .modal')?.inert,
          appendedPath: currentPenGallery[currentPenGallery.length - 1]?.path || ''
        };
      } finally {
        desktopAPI.selectImage = originalSelectImage;
        desktopAPI.getImagePreviewUrl = originalGetImagePreviewUrl;
        desktopAPI.detectPenColors = originalDetectPenColors;
        appData.pens = originalPens;
        closeAllModals();
      }
    })()`);
    assert.equal(penPhotoProcessingLock.closeResult, false, 'a modal should not close while a selected photo is still processing');
    assert.equal(penPhotoProcessingLock.inertDuringProcessing, true, 'gallery controls should be inert while photo processing uses the shared preview');
    assert.equal(penPhotoProcessingLock.processingResult, true, 'photo processing should resolve after color detection completes');
    assert.equal(penPhotoProcessingLock.pendingAfterProcessing, false, 'photo processing should clear its pending state');
    assert.equal(penPhotoProcessingLock.inertAfterProcessing, false, 'the form should unlock after photo processing');
    assert.equal(penPhotoProcessingLock.appendedPath, 'docker-upload:pending-pen-photo', 'completed photo processing should append the selected image once');

    const guardedInkSave = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalSaveImage = desktopAPI.saveImage;
      const originalInks = cloneCollectionArray(appData.inks);
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      let releaseImageSave = null;
      let saveImageCalls = 0;
      try {
        await openInkModal('ink-blue');
        inkNameInput.value = 'Blue Test guarded save';
        currentSelectedImagePath = 'docker-upload:guarded-ink';
        desktopAPI.saveImage = async () => {
          saveImageCalls += 1;
          return await new Promise((resolve) => {
            releaseImageSave = () => resolve('inks/guarded-ink.webp');
          });
        };
        desktopAPI.saveData = async () => ({ success: true });

        const savePromise = saveNewInk();
        while (saveImageCalls < 1 || !releaseImageSave) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        const modalPanel = document.querySelector('#modal-ink .modal');
        const closeResult = await requestCloseAllModals();
        const modalVisibleDuringSave = getComputedStyle(document.querySelector('#modal-ink')).display !== 'none';
        const inertDuringSave = !!modalPanel?.inert;
        currentEditingId = 'ink-wrong-target';
        releaseImageSave();
        const saveResult = await savePromise;
        const savedInk = appData.inks.find((item) => item.id === 'ink-blue');

        return {
          closeResult,
          saveResult,
          modalVisibleDuringSave,
          inertDuringSave,
          modalClosedAfterSave: getComputedStyle(document.querySelector('#modal-ink')).display === 'none',
          inertAfterSave: !!modalPanel?.inert,
          savedName: savedInk?.name || '',
          inkCount: appData.inks.length,
          wrongTargetCreated: appData.inks.some((item) => item.id === 'ink-wrong-target')
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.saveImage = originalSaveImage;
        appData.inks = originalInks;
        appData.activity_log = originalActivityLog;
        currentSelectedImagePath = null;
        currentEditingId = null;
        closeAllModals();
      }
    })()`);
    assert.equal(guardedInkSave.closeResult, false, 'a form should refuse to close while its save is in progress');
    assert.equal(guardedInkSave.saveResult, true, 'the guarded ink save should complete successfully');
    assert.equal(guardedInkSave.modalVisibleDuringSave, true, 'the active modal should remain visible during an awaited save');
    assert.equal(guardedInkSave.inertDuringSave, true, 'the active form should be inert while its save is in progress');
    assert.equal(guardedInkSave.modalClosedAfterSave, true, 'a successful guarded save should close its modal');
    assert.equal(guardedInkSave.inertAfterSave, false, 'the form busy state should clear after saving');
    assert.equal(guardedInkSave.savedName, 'Blue Test guarded save', 'an awaited ink save should keep its original record target');
    assert.equal(guardedInkSave.inkCount, 1, 'a changed global edit ID should not turn an edit into a new record');
    assert.equal(guardedInkSave.wrongTargetCreated, false, 'an awaited ink save should never create or update a replacement target');

    const failedInkSave = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalSaveImage = desktopAPI.saveImage;
      const originalDeleteImage = desktopAPI.deleteImage;
      const originalInks = cloneCollectionArray(appData.inks);
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      const deletedPaths = [];
      let saveDataCalls = 0;
      let saveImageCalls = 0;
      try {
        await openInkModal('ink-blue');
        inkNameInput.value = 'Blue Test failed edit';
        currentSelectedImagePath = 'docker-upload:failed-ink';
        desktopAPI.saveImage = async () => {
          saveImageCalls += 1;
          return 'inks/failed-ink.webp';
        };
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };
        desktopAPI.saveData = async () => {
          saveDataCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 25));
          return { success: false, message: 'Forced ink persistence failure.' };
        };
        const results = await Promise.all([saveNewInk(), saveNewInk()]);
        return {
          results,
          modalVisible: getComputedStyle(document.querySelector('#modal-ink')).display !== 'none',
          inksRestored: JSON.stringify(appData.inks) === JSON.stringify(originalInks),
          activityRestored: JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog),
          pendingImagePath: currentSelectedImagePath,
          saveDataCalls,
          saveImageCalls,
          deletedPaths,
          validation: document.querySelector('#ink-validation-msg')?.textContent || '',
          saving: isSavingInk,
          saveDisabled: btnSaveInk.disabled,
          ariaBusy: btnSaveInk.getAttribute('aria-busy'),
          modalInert: !!document.querySelector('#modal-ink .modal')?.inert
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.saveImage = originalSaveImage;
        desktopAPI.deleteImage = originalDeleteImage;
        appData.inks = originalInks;
        appData.activity_log = originalActivityLog;
        currentSelectedImagePath = null;
        closeAllModals();
      }
    })()`);
    assert.deepEqual(failedInkSave.results, [false, false], 'duplicate ink submissions should share one guarded save attempt');
    assert.equal(failedInkSave.modalVisible, true, 'a failed ink save should keep the edit modal open');
    assert.equal(failedInkSave.inksRestored, true, 'a failed ink save should restore the prior ink collection');
    assert.equal(failedInkSave.activityRestored, true, 'a failed ink save should restore prior activity entries');
    assert.equal(failedInkSave.pendingImagePath, 'docker-upload:failed-ink', 'a failed ink save should retain the pending image for retry');
    assert.equal(failedInkSave.saveDataCalls, 1, 'a duplicate ink submission should persist only once');
    assert.equal(failedInkSave.saveImageCalls, 1, 'a duplicate ink submission should create only one managed image');
    assert.deepEqual(failedInkSave.deletedPaths, ['inks/failed-ink.webp'], 'a failed ink persistence attempt should remove its newly created managed image');
    assert.match(failedInkSave.validation, /nothing was changed/i, 'a failed ink save should explain its atomic rollback');
    assert.equal(failedInkSave.saving, false, 'the ink save guard should reset after failure');
    assert.equal(failedInkSave.saveDisabled, false, 'the ink save button should be re-enabled after failure');
    assert.equal(failedInkSave.ariaBusy, null, 'the ink save button should clear its busy state after failure');
    assert.equal(failedInkSave.modalInert, false, 'a failed ink save should leave the form retryable');

    const failedPenSave = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalSaveImage = desktopAPI.saveImage;
      const originalDeleteImage = desktopAPI.deleteImage;
      const originalDisposeReplacedImage = desktopAPI.disposeReplacedImage;
      const originalPens = cloneCollectionArray(appData.pens);
      const originalCurrentlyInked = cloneCollectionArray(appData.currently_inked);
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      const deletedPaths = [];
      const disposedPaths = [];
      try {
        await openPenModal('pen-detail-carousel');
        setPenModalGallery([
          {
            id: 'failed-pen-a',
            path: 'docker-upload:failed-pen-a',
            previewSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/%3E',
            rotation: 0,
            primary: true
          },
          {
            id: 'failed-pen-b',
            path: 'docker-upload:failed-pen-b',
            previewSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/%3E',
            rotation: 0,
            primary: false
          }
        ]);
        penNotesInput.value = 'This change must roll back.';
        desktopAPI.saveImage = async (sourcePath) => (
          sourcePath === 'docker-upload:failed-pen-a'
            ? 'pens/failed-pen-a.webp'
            : 'pens/failed-pen-b.webp'
        );
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };
        desktopAPI.disposeReplacedImage = async (imagePath) => {
          disposedPaths.push(imagePath);
          return { success: true };
        };
        desktopAPI.saveData = async () => ({
          success: false,
          message: 'Forced pen persistence failure.'
        });
        await saveNewPen();
        return {
          modalVisible: getComputedStyle(document.querySelector('#modal-pen')).display !== 'none',
          pensRestored: JSON.stringify(appData.pens) === JSON.stringify(originalPens),
          linksRestored: JSON.stringify(appData.currently_inked) === JSON.stringify(originalCurrentlyInked),
          activityRestored: JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog),
          galleryPaths: currentPenGallery.map((entry) => entry.path),
          deletedPaths,
          disposedPaths,
          validation: document.querySelector('#pen-validation-msg')?.textContent || ''
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.saveImage = originalSaveImage;
        desktopAPI.deleteImage = originalDeleteImage;
        desktopAPI.disposeReplacedImage = originalDisposeReplacedImage;
        appData.pens = originalPens;
        appData.currently_inked = originalCurrentlyInked;
        appData.activity_log = originalActivityLog;
        closeAllModals();
      }
    })()`);
    assert.equal(failedPenSave.modalVisible, true, 'a failed pen collection save should keep the edit modal open');
    assert.equal(failedPenSave.pensRestored, true, 'a failed pen save should restore the prior pen collection');
    assert.equal(failedPenSave.linksRestored, true, 'a failed pen save should restore prior pen and ink links');
    assert.equal(failedPenSave.activityRestored, true, 'a failed pen save should restore prior activity entries');
    assert.deepEqual(
      failedPenSave.galleryPaths,
      ['docker-upload:failed-pen-a', 'docker-upload:failed-pen-b'],
      'a failed pen save should retain the original pending gallery'
    );
    assert.deepEqual(
      failedPenSave.deletedPaths,
      ['pens/failed-pen-a.webp', 'pens/failed-pen-b.webp'],
      'a failed pen collection save should delete every image created for that attempt'
    );
    assert.deepEqual(failedPenSave.disposedPaths, [], 'a failed pen save should not dispose previously committed photos');
    assert.match(failedPenSave.validation, /nothing was changed/i, 'a failed pen save should show an atomic rollback message');

    const committedPenCleanupFailure = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalDisposeReplacedImage = desktopAPI.disposeReplacedImage;
      const originalPens = cloneCollectionArray(appData.pens);
      const originalCurrentlyInked = cloneCollectionArray(appData.currently_inked);
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      const disposedPaths = [];
      try {
        await openPenModal('pen-detail-carousel');
        const pen = appData.pens.find((item) => item.id === 'pen-detail-carousel');
        setPenModalGallery([pen.images.find((entry) => entry.path === 'pens/detail-c.png')]);
        desktopAPI.saveData = async () => ({ success: true });
        desktopAPI.disposeReplacedImage = async (imagePath) => {
          disposedPaths.push(imagePath);
          if (disposedPaths.length === 1) throw new Error('Forced first cleanup failure.');
          return { success: true };
        };

        await saveNewPen();
        const savedPen = appData.pens.find((item) => item.id === 'pen-detail-carousel');
        return {
          disposedPaths,
          modalClosed: getComputedStyle(document.querySelector('#modal-pen')).display === 'none',
          modalInert: !!document.querySelector('#modal-pen .modal')?.inert,
          savedImage: savedPen?.image || '',
          savedGalleryLength: savedPen?.images?.length || 0,
          notice: document.querySelector('.app-notice-floating')?.textContent || ''
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.disposeReplacedImage = originalDisposeReplacedImage;
        appData.pens = originalPens;
        appData.currently_inked = originalCurrentlyInked;
        appData.activity_log = originalActivityLog;
        closeAllModals();
      }
    })()`);
    assert.deepEqual(
      committedPenCleanupFailure.disposedPaths,
      ['pens/detail-a.png', 'pens/detail-b.png'],
      'post-save cleanup should continue after an earlier image deletion fails'
    );
    assert.equal(committedPenCleanupFailure.modalClosed, true, 'a cleanup failure after persistence should not leave the saved pen modal open');
    assert.equal(committedPenCleanupFailure.modalInert, false, 'post-save cleanup failure should still clear the form busy state');
    assert.equal(committedPenCleanupFailure.savedImage, 'pens/detail-c.png', 'post-save cleanup failure should keep the committed pen data');
    assert.equal(committedPenCleanupFailure.savedGalleryLength, 1, 'post-save cleanup failure should not roll back the committed gallery');
    assert.match(committedPenCleanupFailure.notice, /cleanup step failed/i, 'post-save cleanup failure should show a non-destructive warning');

    const sharedImageReferenceCleanup = await evaluate(`(async () => {
      const originalDeleteImage = desktopAPI.deleteImage;
      const originalInks = cloneCollectionArray(appData.inks);
      const originalSwatches = cloneCollectionArray(appData.swatches);
      const deletedPaths = [];
      const sharedPath = 'swatches/shared-legacy.webp';
      try {
        appData.inks[0].image = sharedPath;
        appData.inks[0].images = [{ id: 'shared-ink', path: sharedPath, rotation: 0, primary: true }];
        appData.swatches.push({
          id: 'shared-swatch',
          ink_id: appData.inks[0].id,
          image: sharedPath,
          images: [{ id: 'shared-swatch-image', path: sharedPath, rotation: 0, primary: true }]
        });
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };

        appData.swatches = appData.swatches.filter((item) => item.id !== 'shared-swatch');
        await deleteManagedImageIfUnreferenced(sharedPath);
        const retainedWhileReferenced = deletedPaths.length === 0;
        appData.inks[0].image = '';
        appData.inks[0].images = [];
        await deleteManagedImageIfUnreferenced(sharedPath);

        return {
          retainedWhileReferenced,
          deletedPaths
        };
      } finally {
        desktopAPI.deleteImage = originalDeleteImage;
        appData.inks = originalInks;
        appData.swatches = originalSwatches;
      }
    })()`);
    assert.equal(sharedImageReferenceCleanup.retainedWhileReferenced, true, 'removing a migrated swatch should keep media still referenced by its ink');
    assert.deepEqual(sharedImageReferenceCleanup.deletedPaths, ['swatches/shared-legacy.webp'], 'shared media should become removable after its final collection reference is gone');

    const failedSwatchEditSave = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalSaveImage = desktopAPI.saveImage;
      const originalDeleteImage = desktopAPI.deleteImage;
      const originalDisposeReplacedImage = desktopAPI.disposeReplacedImage;
      const originalSwatches = cloneCollectionArray(appData.swatches);
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      const deletedPaths = [];
      const disposedPaths = [];
      try {
        await openEditSwatchModal('swatch-make-primary');
        setSwatchModalGallery([{
          id: 'failed-swatch-edit',
          path: 'docker-upload:failed-swatch-edit',
          previewSrc: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/%3E',
          rotation: 0,
          primary: true
        }]);
        document.querySelector('#swatch-paper-input').value = 'This change must roll back.';
        desktopAPI.saveImage = async () => 'swatches/failed-swatch-edit.webp';
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };
        desktopAPI.disposeReplacedImage = async (imagePath) => {
          disposedPaths.push(imagePath);
          return { success: true };
        };
        desktopAPI.saveData = async () => ({
          success: false,
          message: 'Forced swatch edit persistence failure.'
        });
        document.querySelector('#btn-save-swatch-unified').click();
        while (isSavingSwatch) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return {
          modalVisible: getComputedStyle(document.querySelector('#modal-add-swatch')).display !== 'none',
          swatchesRestored: JSON.stringify(appData.swatches) === JSON.stringify(originalSwatches),
          activityRestored: JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog),
          galleryPaths: currentSwatchGallery.map((entry) => entry.path),
          deletedPaths,
          disposedPaths,
          validation: document.querySelector('#swatch-validation-msg')?.textContent || ''
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.saveImage = originalSaveImage;
        desktopAPI.deleteImage = originalDeleteImage;
        desktopAPI.disposeReplacedImage = originalDisposeReplacedImage;
        appData.swatches = originalSwatches;
        appData.activity_log = originalActivityLog;
        closeAllModals();
      }
    })()`);
    assert.equal(failedSwatchEditSave.modalVisible, true, 'a failed swatch edit should keep the modal open');
    assert.equal(failedSwatchEditSave.swatchesRestored, true, 'a failed swatch edit should restore the previous swatch data');
    assert.equal(failedSwatchEditSave.activityRestored, true, 'a failed swatch edit should restore the previous activity data');
    assert.deepEqual(
      failedSwatchEditSave.galleryPaths,
      ['docker-upload:failed-swatch-edit'],
      'a failed swatch edit should retain its original pending image selection'
    );
    assert.deepEqual(
      failedSwatchEditSave.deletedPaths,
      ['swatches/failed-swatch-edit.webp'],
      'a failed swatch edit should delete the newly created image'
    );
    assert.deepEqual(failedSwatchEditSave.disposedPaths, [], 'a failed swatch edit should not dispose the previous committed photos');
    assert.match(failedSwatchEditSave.validation, /nothing was changed/i, 'a failed swatch edit should show an atomic rollback message');

    const failedDeleteRollbacks = await evaluate(`(async () => {
      const originalSaveData = desktopAPI.saveData;
      const originalDeleteImage = desktopAPI.deleteImage;
      const originalPens = cloneCollectionArray(appData.pens);
      const originalInks = cloneCollectionArray(appData.inks);
      const originalSwatches = cloneCollectionArray(appData.swatches);
      const originalCurrentlyInked = cloneCollectionArray(appData.currently_inked);
      const originalActivityLog = cloneCollectionArray(appData.activity_log);
      const deletedPaths = [];
      try {
        desktopAPI.saveData = async () => ({
          success: false,
          message: 'Forced delete persistence failure.'
        });
        desktopAPI.deleteImage = async (imagePath) => {
          deletedPaths.push(imagePath);
          return { success: true };
        };

        currentEditingId = 'ink-blue';
        const inkResult = await deleteInk();
        const inkRestored = (
          JSON.stringify(appData.inks) === JSON.stringify(originalInks)
          && JSON.stringify(appData.swatches) === JSON.stringify(originalSwatches)
          && JSON.stringify(appData.currently_inked) === JSON.stringify(originalCurrentlyInked)
          && JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog)
        );

        currentEditingId = 'pen-detail-carousel';
        const penResult = await deletePen();
        const penRestored = (
          JSON.stringify(appData.pens) === JSON.stringify(originalPens)
          && JSON.stringify(appData.currently_inked) === JSON.stringify(originalCurrentlyInked)
          && JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog)
        );

        currentSwatchFormMode = 'edit';
        currentEditingSwatchId = 'swatch-make-primary';
        const swatchResult = await deleteCurrentSwatch();
        const swatchRestored = (
          JSON.stringify(appData.swatches) === JSON.stringify(originalSwatches)
          && JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog)
        );

        const activityResult = await deleteActivityEntry(originalActivityLog[0]?.id || '');
        const activityRestored = JSON.stringify(appData.activity_log) === JSON.stringify(originalActivityLog);

        return {
          results: [inkResult, penResult, swatchResult, activityResult],
          inkRestored,
          penRestored,
          swatchRestored,
          activityRestored,
          deletedPaths
        };
      } finally {
        desktopAPI.saveData = originalSaveData;
        desktopAPI.deleteImage = originalDeleteImage;
        appData.pens = originalPens;
        appData.inks = originalInks;
        appData.swatches = originalSwatches;
        appData.currently_inked = originalCurrentlyInked;
        appData.activity_log = originalActivityLog;
        currentEditingId = null;
        currentEditingSwatchId = null;
        setSwatchFormMode('create');
        closeAllModals();
        renderDashboard();
        renderActivityLogView();
      }
    })()`);
    assert.deepEqual(failedDeleteRollbacks.results, [false, false, false, false], 'failed collection and activity deletions should report failure');
    assert.equal(failedDeleteRollbacks.inkRestored, true, 'a failed ink deletion should restore inks, linked swatches, current links, and activity');
    assert.equal(failedDeleteRollbacks.penRestored, true, 'a failed pen deletion should restore pens, current links, and activity');
    assert.equal(failedDeleteRollbacks.swatchRestored, true, 'a failed swatch deletion should restore swatches and activity');
    assert.equal(failedDeleteRollbacks.activityRestored, true, 'a failed activity deletion should restore the removed entry');
    assert.deepEqual(failedDeleteRollbacks.deletedPaths, [], 'failed deletions should not remove managed image files');

    const queuedSaveHandling = await evaluate(`(async () => {
      const firstSnapshot = JSON.parse(JSON.stringify(appData));
      const secondSnapshot = JSON.parse(JSON.stringify(appData));
      firstSnapshot.pens[0].notes = 'first queued save';
      secondSnapshot.pens[0].notes = 'second queued save';
      const [firstResult, secondResult] = await Promise.all([
        desktopAPI.saveData(firstSnapshot),
        desktopAPI.saveData(secondSnapshot)
      ]);
      const persisted = await fetch('/api/data').then((response) => response.json());
      appData.pens[0].notes = persisted.data.pens[0].notes;
      return {
        firstSucceeded: firstResult?.success === true,
        secondSucceeded: secondResult?.success === true,
        persistedNotes: persisted.data.pens[0].notes
      };
    })()`);
    assert.equal(queuedSaveHandling.firstSucceeded, true, 'the first queued window save should succeed');
    assert.equal(queuedSaveHandling.secondSucceeded, true, 'the second queued window save should use the revision returned by the first');
    assert.equal(queuedSaveHandling.persistedNotes, 'second queued save', 'queued window saves should preserve invocation order');

    const saveFailureHandling = await evaluate(`(async () => {
      const remoteSnapshot = await fetch('/api/data').then((response) => response.json());
      remoteSnapshot.data.pens[0].notes = 'newer external writer marker';
      const remoteSave = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: remoteSnapshot.data,
          expectedRevision: remoteSnapshot.revision
        })
      }).then(async (response) => ({
        status: response.status,
        body: await response.json()
      }));
      appData.pens[0].notes = 'unsaved conflict marker';
      const saved = await persistDataAndRefresh({ onErrorMessage: 'Failed to save test data.' });
      const persisted = await fetch('/api/data').then((response) => response.json());
      return {
        remoteSaveStatus: remoteSave.status,
        remoteSaveSucceeded: remoteSave.body?.success === true,
        saved,
        notice: document.querySelector('.app-notice-floating')?.textContent || '',
        noticeIsError: document.querySelector('.app-notice-floating')?.classList.contains('is-error') || false,
        retainedNotes: appData.pens[0].notes,
        persistedNotes: persisted.data.pens[0].notes
      };
    })()`);
    assert.equal(saveFailureHandling.remoteSaveStatus, 200, 'the simulated newer writer should save successfully');
    assert.equal(saveFailureHandling.remoteSaveSucceeded, true, 'the simulated newer writer should receive a successful save result');
    assert.equal(saveFailureHandling.saved, false, 'rejected saves should return false instead of escaping as unhandled rejections');
    assert.equal(saveFailureHandling.noticeIsError, true, 'rejected saves should use the visible error notice');
    assert.match(saveFailureHandling.notice, /changed in another tab or app window/i, 'stale-save conflicts should explain why the save was rejected');
    assert.match(saveFailureHandling.notice, /reload/i, 'stale-save conflicts should tell the user to reload');
    assert.equal(saveFailureHandling.retainedNotes, 'unsaved conflict marker', 'stale-save conflicts should retain the current in-memory edit');
    assert.equal(saveFailureHandling.persistedNotes, 'newer external writer marker', 'a stale save should not overwrite the newer persisted collection');

    await navigate(`${baseUrl}/admin/pens`);
    await waitForCondition(`typeof appData !== 'undefined' && document.querySelectorAll('#pens-grid .pen-card-horizontal').length >= 3`);

    await evaluate(`openPenModal('pen-make-primary')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display !== 'none' && currentPenGallery.length === 3`);
    await evaluate(`document.querySelector('#btn-next-pen-photo').click()`);
    await waitForCondition(`currentPenGalleryIndex === 1`);
    await evaluate(`document.querySelector('#btn-next-pen-photo').click()`);
    await waitForCondition(`currentPenGalleryIndex === 2`);
    await evaluate(`document.querySelector('#btn-primary-pen-photo').click()`);
    const madePrimary = await evaluate(`({
      primaryPath: currentPenGallery.find((entry) => entry.primary)?.path || '',
      orderedPaths: currentPenGallery.map((entry) => entry.path),
      currentIndex: currentPenGalleryIndex,
      primaryDisabled: document.querySelector('#btn-primary-pen-photo').disabled,
      prevHidden: document.querySelector('#btn-prev-pen-photo').hidden,
      nextHidden: document.querySelector('#btn-next-pen-photo').hidden
    })`);
    assert.equal(madePrimary.primaryPath, 'pens/make-c.png', 'make-primary should mark the visible pen image primary');
    assert.deepEqual(madePrimary.orderedPaths, [
      'pens/make-c.png',
      'pens/make-a.png',
      'pens/make-b.png'
    ], 'make-primary should move the selected pen image to the front without reordering the others');
    assert.equal(madePrimary.currentIndex, 0, 'make-primary should keep the selected pen image visible at the first position');
    assert.equal(madePrimary.primaryDisabled, true, 'make-primary action should disable on the primary image');
    assert.equal(madePrimary.prevHidden, true, 'make-primary should hide previous navigation at the first image');
    assert.equal(madePrimary.nextHidden, false, 'make-primary should keep forward navigation available');
    await evaluate(`document.querySelector('#btn-save-pen').click()`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display === 'none'`);

    let data = await fetchData();
    let pen = data.pens.find((item) => item.id === 'pen-make-primary');
    assert.equal(pen.image, 'pens/make-c.png', 'saved pen primary image should update legacy image field');
    assert.equal(pen.images.filter((entry) => entry.primary).length, 1, 'saved pen should keep exactly one primary image');
    assert.equal(pen.images.find((entry) => entry.primary).path, 'pens/make-c.png', 'saved pen image array should persist the selected primary');
    assert.deepEqual(pen.images.map((entry) => entry.path), [
      'pens/make-c.png',
      'pens/make-a.png',
      'pens/make-b.png'
    ], 'saved pen image order should keep the primary image first');

    await evaluate(`openPenModal('pen-delete-primary')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display !== 'none' && currentPenGallery.length === 3 && currentPenGalleryIndex === 0`);
    await evaluate(`document.querySelector('#btn-remove-pen-photo').click()`);
    await waitForCondition(`currentPenGallery.length === 2 && currentPenGallery[0].primary === true`);
    const deletePreview = await evaluate(`({
      length: currentPenGallery.length,
      primaryPath: currentPenGallery.find((entry) => entry.primary)?.path || '',
      currentPath: currentPenGallery[currentPenGalleryIndex]?.path || ''
    })`);
    assert.equal(deletePreview.primaryPath, 'pens/delete-b.png', 'deleting a primary image should promote the first remaining image');
    assert.equal(deletePreview.currentPath, 'pens/delete-b.png', 'deleted primary should leave the carousel on the promoted image');
    await evaluate(`document.querySelector('#btn-save-pen').click()`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display === 'none'`);

    data = await fetchData();
    pen = data.pens.find((item) => item.id === 'pen-delete-primary');
    assert.equal(pen.image, 'pens/delete-b.png', 'persisted pen image should follow the promoted primary');
    assert.equal(pen.images.length, 2, 'deleted pen image should be removed from persisted gallery');
    assert.equal(pen.images.filter((entry) => entry.primary).length, 1, 'delete flow should persist exactly one primary image');

    await evaluate(`openEditSwatchModal('swatch-make-primary')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-add-swatch')).display !== 'none' && currentSwatchGallery.length === 2`);
    const lockedEditSwatchInk = await evaluate(`(() => {
      const trigger = document.querySelector('#fetch-swatch-ink-wrapper .custom-select-trigger');
      const input = document.querySelector('#fetch-swatch-ink-input');
      const before = input.value;
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      return {
        before,
        after: input.value,
        ariaDisabled: trigger.getAttribute('aria-disabled'),
        tabIndex: trigger.tabIndex,
        expanded: trigger.getAttribute('aria-expanded'),
        wrapperDisabled: trigger.closest('.custom-select-wrapper-outer')?.classList.contains('is-disabled') || false
      };
    })()`);
    assert.equal(lockedEditSwatchInk.ariaDisabled, 'true', 'the linked-ink select should expose a disabled state while editing a swatch');
    assert.equal(lockedEditSwatchInk.tabIndex, -1, 'the linked-ink select should leave the tab order while editing a swatch');
    assert.equal(lockedEditSwatchInk.wrapperDisabled, true, 'the linked-ink wrapper should use the disabled control state');
    assert.equal(lockedEditSwatchInk.expanded, 'false', 'keyboard input should not open a locked linked-ink select');
    assert.equal(lockedEditSwatchInk.after, lockedEditSwatchInk.before, 'keyboard input should not change the linked ink while editing a swatch');
    const swatchCalendar = await evaluate(`(() => {
      setSwatchDateInputValue('2026-01-15');
      swatchCalendarViewDate = new Date(2026, 0, 1);
      renderSwatchCalendar();
      const selected = document.querySelector('#swatch-calendar-grid [data-swatch-calendar-date="2026-01-15"]');
      return {
        cellCount: document.querySelectorAll('#swatch-calendar-grid .activity-calendar-day').length,
        hasSelected: selected?.classList.contains('selected') || false,
        hasEvent: selected?.classList.contains('has-events') || false,
        nextDisabled: document.querySelector('#swatch-calendar-next')?.disabled ?? null
      };
    })()`);
    assert.equal(swatchCalendar.cellCount % 7, 0, 'swatch calendar should render complete calendar weeks');
    assert.equal(swatchCalendar.hasSelected, true, 'swatch calendar should keep the selected date marker');
    assert.equal(swatchCalendar.hasEvent, true, 'swatch calendar should keep swatch-date event markers');
    assert.equal(swatchCalendar.nextDisabled, false, 'swatch calendar should allow moving forward from an older month');
    await evaluate(`document.querySelector('#btn-next-swatch-photo').click()`);
    await waitForCondition(`currentSwatchGalleryIndex === 1`);
    await evaluate(`document.querySelector('#btn-primary-swatch-photo').click()`);
    const swatchMadePrimary = await evaluate(`({
      orderedPaths: currentSwatchGallery.map((entry) => entry.path),
      currentIndex: currentSwatchGalleryIndex,
      prevHidden: document.querySelector('#btn-prev-swatch-photo').hidden,
      nextHidden: document.querySelector('#btn-next-swatch-photo').hidden
    })`);
    assert.deepEqual(swatchMadePrimary.orderedPaths, [
      'swatches/swatch-b.png',
      'swatches/swatch-a.png'
    ], 'make-primary should move the selected swatch image to the front');
    assert.equal(swatchMadePrimary.currentIndex, 0, 'make-primary should keep the selected swatch image visible at the first position');
    assert.equal(swatchMadePrimary.prevHidden, true, 'swatch previous navigation should hide after moving the primary image first');
    assert.equal(swatchMadePrimary.nextHidden, false, 'swatch forward navigation should remain available after moving the primary image first');
    await evaluate(`document.querySelector('#btn-save-swatch-unified').click()`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-add-swatch')).display === 'none'`);

    data = await fetchData();
    const swatch = data.swatches.find((item) => item.id === 'swatch-make-primary');
    assert.equal(swatch.image, 'swatches/swatch-b.png', 'saved swatch primary image should update legacy image field');
    assert.equal(swatch.images.filter((entry) => entry.primary).length, 1, 'saved swatch should keep exactly one primary image');
    assert.equal(swatch.images.find((entry) => entry.primary).path, 'swatches/swatch-b.png', 'saved swatch image array should persist the selected primary');
    assert.deepEqual(swatch.images.map((entry) => entry.path), [
      'swatches/swatch-b.png',
      'swatches/swatch-a.png'
    ], 'saved swatch image order should keep the primary image first');

    await evaluate(`openSwatchDetailModal('swatch-make-primary', 'swatches')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-swatch-detail')).display !== 'none'
      && document.querySelector('#swatch-detail-img').naturalWidth > 0`);
    const initialSwatchCarousel = await evaluate(`({
      index: currentSwatchDetailImageIndex,
      src: document.querySelector('#swatch-detail-img')?.getAttribute('src') || '',
      prevHidden: document.querySelector('#swatch-detail-image-container .detail-photo-nav.prev')?.hidden ?? null,
      nextHidden: document.querySelector('#swatch-detail-image-container .detail-photo-nav.next')?.hidden ?? null
    })`);
    assert.equal(initialSwatchCarousel.index, 0, 'swatch detail carousel should start with the primary image first');
    assert.match(initialSwatchCarousel.src, /swatch-b\.png/, 'swatch detail carousel should show the selected primary image first');
    assert.equal(initialSwatchCarousel.prevHidden, true, 'swatch detail previous arrow should hide on the primary image');
    assert.equal(initialSwatchCarousel.nextHidden, false, 'swatch detail next arrow should lead to the remaining images');

    await evaluate(`document.querySelector('#swatch-detail-image-container .detail-photo-nav.next').click()`);
    await waitForCondition(`currentSwatchDetailImageIndex === 1
      && /swatch-a\\.png/.test(document.querySelector('#swatch-detail-img')?.getAttribute('src') || '')`);
    const nextSwatchCarousel = await evaluate(`({
      index: currentSwatchDetailImageIndex,
      prevHidden: document.querySelector('#swatch-detail-image-container .detail-photo-nav.prev')?.hidden ?? null,
      nextHidden: document.querySelector('#swatch-detail-image-container .detail-photo-nav.next')?.hidden ?? null
    })`);
    assert.equal(nextSwatchCarousel.prevHidden, false, 'swatch detail previous arrow should return to the primary image');
    assert.equal(nextSwatchCarousel.nextHidden, true, 'swatch detail next arrow should hide at the last image');
    await evaluate(`closeDetailModals()`);

    await waitForCondition(`Array.from(document.querySelectorAll('#swatches-grid .inked-card')).some((card) => (
      card.textContent.includes('Broken')
      && card.querySelector('.ink-swatch-bg')?.classList.contains('image-unavailable')
    ))`);
    const brokenSwatchCardFallback = await evaluate(`(() => {
      const card = Array.from(document.querySelectorAll('#swatches-grid .inked-card')).find(
        (item) => item.textContent.includes('Broken')
      );
      const visual = card?.querySelector('.ink-swatch-bg');
      return {
        unavailable: visual?.classList.contains('image-unavailable') || false,
        hasFallbackIcon: !!visual?.querySelector('.card-image-fallback-icon'),
        backgroundImage: visual?.style.backgroundImage || ''
      };
    })()`);
    assert.equal(brokenSwatchCardFallback.unavailable, true, 'a missing swatch image should enter a deliberate unavailable state');
    assert.equal(brokenSwatchCardFallback.hasFallbackIcon, true, 'a missing swatch image should show an image fallback icon');
    assert.doesNotMatch(brokenSwatchCardFallback.backgroundImage, /url\(/i, 'a missing swatch image should not keep a broken background URL');
    assert.match(brokenSwatchCardFallback.backgroundImage, /gradient/i, 'a missing swatch image should retain the linked ink color fallback');

    await navigate(`${baseUrl}/pens`);
    await waitForCondition(`typeof appData !== 'undefined' && document.querySelectorAll('#pens-grid .pen-card-horizontal').length >= 3`);
    await evaluate(`openPenDetailModal('pen-detail-carousel')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen-detail')).display !== 'none' && document.querySelector('#pen-detail-img').naturalWidth > 0`);
    const initialCarousel = await evaluate(`({
      index: currentPenDetailImageIndex,
      prevHidden: document.querySelector('#pen-detail-visual-container .detail-photo-nav.prev')?.hidden ?? null,
      nextHidden: document.querySelector('#pen-detail-visual-container .detail-photo-nav.next')?.hidden ?? null,
      indicatorCount: document.querySelectorAll('.photo-dot, .photo-indicator, .gallery-indicator, .photo-pill').length
    })`);
    assert.equal(initialCarousel.index, 0, 'detail carousel should start on the primary image');
    assert.equal(initialCarousel.prevHidden, true, 'previous arrow should be hidden at first image');
    assert.equal(initialCarousel.nextHidden, false, 'next arrow should be visible before last image');
    assert.equal(initialCarousel.indicatorCount, 0, 'removed dot-pill indicators should not be rendered');

    await evaluate(`document.querySelector('#pen-detail-visual-container .detail-photo-nav.next').click()`);
    await waitForCondition(`currentPenDetailImageIndex === 1`);
    await evaluate(`document.querySelector('#pen-detail-visual-container .detail-photo-nav.next').click()`);
    await waitForCondition(`currentPenDetailImageIndex === 2`);
    const lastCarousel = await evaluate(`({
      index: currentPenDetailImageIndex,
      prevHidden: document.querySelector('#pen-detail-visual-container .detail-photo-nav.prev')?.hidden ?? null,
      nextHidden: document.querySelector('#pen-detail-visual-container .detail-photo-nav.next')?.hidden ?? null
    })`);
    assert.equal(lastCarousel.prevHidden, false, 'previous arrow should be visible after moving forward');
    assert.equal(lastCarousel.nextHidden, true, 'next arrow should be hidden at last image');

    await evaluate(`openPenDetailModal('pen-broken-image')`);
    await waitForCondition(`currentPenDetailPenId === 'pen-broken-image'
      && getComputedStyle(document.querySelector('#pen-detail-img')).display === 'none'
      && getComputedStyle(document.querySelector('#pen-detail-placeholder-icon')).display !== 'none'
      && !document.querySelector('#pen-detail-img').hasAttribute('src')`);
    const brokenPenDetailFallback = await evaluate(`({
      model: document.querySelector('#pen-detail-model')?.textContent.trim() || '',
      imageSrc: document.querySelector('#pen-detail-img')?.getAttribute('src'),
      imageDisplay: getComputedStyle(document.querySelector('#pen-detail-img')).display,
      placeholderDisplay: getComputedStyle(document.querySelector('#pen-detail-placeholder-icon')).display,
      layoutDirection: document.querySelector('#pen-detail-layout')?.style.flexDirection || '',
      hasLandscapeClass: document.querySelector('#pen-detail-layout')?.classList.contains('pen-detail-layout-landscape') || false
    })`);
    assert.equal(brokenPenDetailFallback.model, 'Broken Image', 'the broken-image detail view should show the requested pen metadata');
    assert.equal(brokenPenDetailFallback.imageSrc, null, 'a failed pen detail image should clear the previous image source');
    assert.equal(brokenPenDetailFallback.imageDisplay, 'none', 'a failed pen detail image should stay hidden');
    assert.notEqual(brokenPenDetailFallback.placeholderDisplay, 'none', 'a failed pen detail image should show the placeholder');
    assert.equal(brokenPenDetailFallback.layoutDirection, 'row', 'a failed pen detail image should reset the detail layout');
    assert.equal(brokenPenDetailFallback.hasLandscapeClass, false, 'a failed pen detail image should clear stale landscape state');

    await navigate(`${baseUrl}/admin/activity`);
    await waitForCondition(`typeof appData !== 'undefined' && document.querySelector('#btn-filter-activity')`);
    await evaluate(`document.querySelector('#btn-filter-activity').click()`);
    await waitForCondition(`document.querySelector('#filter-sidebar-activity').classList.contains('active')`);
    const activityCalendars = await evaluate(`(() => {
      activityDateFilter = '2026-01-15';
      activityCalendarViewDate = new Date(2026, 0, 1);
      renderActivityCalendar();
      activityDateFromFilter = '2026-01-15';
      activityDateToFilter = '';
      setActivityFilterDateInputValue('from', '2026-01-15');
      setActivityFilterDateInputValue('to', '');
      activityFilterDateFromCalendarViewDate = new Date(2026, 0, 1);
      renderActivityFilterDateCalendar('from');
      activityFilterDateToCalendarViewDate = new Date(2026, 0, 1);
      renderActivityFilterDateCalendar('to');

      const exact = document.querySelector('#activity-calendar-grid [data-calendar-date="2026-01-15"]');
      const from = document.querySelector('#activity-filter-date-from-grid [data-activity-filter-date-from="2026-01-15"]');
      const invalidTo = document.querySelector('#activity-filter-date-to-grid [data-activity-filter-date-to="2026-01-14"]');
      const validTo = document.querySelector('#activity-filter-date-to-grid [data-activity-filter-date-to="2026-01-15"]');
      invalidTo?.click();
      const toAfterInvalidClick = document.querySelector('#activity-filter-date-to')?.value || '';

      activityDateFromFilter = '';
      activityDateToFilter = '2026-01-15';
      setActivityFilterDateInputValue('from', '');
      setActivityFilterDateInputValue('to', '2026-01-15');
      renderActivityFilterDateCalendar('from');
      const invalidFrom = document.querySelector('#activity-filter-date-from-grid [data-activity-filter-date-from="2026-01-16"]');
      const validFrom = document.querySelector('#activity-filter-date-from-grid [data-activity-filter-date-from="2026-01-15"]');
      invalidFrom?.click();
      const fromAfterInvalidClick = document.querySelector('#activity-filter-date-from')?.value || '';

      activityDateFromFilter = '2026-01-16';
      activityDateToFilter = '2026-01-15';
      const reversedMatches = getFilteredActivityEntries().length;

      activityDateFromFilter = '';
      activityDateToFilter = '';
      setActivityFilterDateInputValue('from', '');
      setActivityFilterDateInputValue('to', '');
      return {
        exactCellCount: document.querySelectorAll('#activity-calendar-grid .activity-calendar-day').length,
        exactSelected: exact?.classList.contains('selected') || false,
        exactEvent: exact?.classList.contains('has-events') || false,
        fromSelected: from?.classList.contains('selected') || false,
        fromEvent: from?.classList.contains('has-events') || false,
        fromNextDisabled: document.querySelector('#activity-filter-date-from-next')?.disabled ?? null,
        invalidToDisabled: invalidTo?.disabled ?? null,
        validToDisabled: validTo?.disabled ?? null,
        toAfterInvalidClick,
        invalidFromDisabled: invalidFrom?.disabled ?? null,
        validFromDisabled: validFrom?.disabled ?? null,
        fromAfterInvalidClick,
        reversedMatches
      };
    })()`);
    assert.equal(activityCalendars.exactCellCount % 7, 0, 'activity calendar should render complete calendar weeks');
    assert.equal(activityCalendars.exactSelected, true, 'activity exact-date calendar should keep selected date markers');
    assert.equal(activityCalendars.exactEvent, true, 'activity exact-date calendar should keep activity event markers');
    assert.equal(activityCalendars.fromSelected, true, 'activity from-date calendar should keep selected date markers');
    assert.equal(activityCalendars.fromEvent, true, 'activity from-date calendar should keep activity event markers');
    assert.equal(activityCalendars.fromNextDisabled, false, 'activity date calendar should allow moving forward from an older month');
    assert.equal(activityCalendars.invalidToDisabled, true, 'activity to-date calendar should disable dates before the selected from date');
    assert.equal(activityCalendars.validToDisabled, false, 'activity to-date calendar should allow the selected from date as an inclusive end date');
    assert.equal(activityCalendars.toAfterInvalidClick, '', 'disabled to-date choices should not change the range input');
    assert.equal(activityCalendars.invalidFromDisabled, true, 'activity from-date calendar should disable dates after the selected to date');
    assert.equal(activityCalendars.validFromDisabled, false, 'activity from-date calendar should allow the selected to date as an inclusive start date');
    assert.equal(activityCalendars.fromAfterInvalidClick, '', 'disabled from-date choices should not change the range input');
    assert.equal(activityCalendars.reversedMatches, 0, 'programmatic reversed activity ranges should not normalize into a valid range');
    const activityFilter = await evaluate(`(() => {
      document.querySelector('#activity-filter-search').value = 'detail carousel';
      document.querySelector('#activity-filter-search').dispatchEvent(new Event('input', { bubbles: true }));
      return {
        sidebarActive: document.querySelector('#filter-sidebar-activity').classList.contains('active'),
        matches: getFilteredActivityEntries().map((entry) => entry.id)
      };
    })()`);
    assert.equal(activityFilter.sidebarActive, true, 'Activity filter sidebar should stay open while filtering');
    assert.deepEqual(activityFilter.matches, ['act-pen'], 'Activity search should filter matching entries');
    await evaluate(`switchView('pens')`);
    const sidebarAfterSwitch = await evaluate(`({
      active: document.querySelector('#filter-sidebar-activity').classList.contains('active'),
      display: getComputedStyle(document.querySelector('#filter-sidebar-activity')).display
    })`);
    assert.equal(sidebarAfterSwitch.active, false, 'Activity filter sidebar should close when switching pages');
    assert.equal(sidebarAfterSwitch.display, 'none', 'Activity filter sidebar should be hidden after switching pages');

    assert.deepEqual(runtimeErrors, [], 'browser runtime should not throw exceptions during renderer smoke checks');
    console.log(JSON.stringify({
      success: true,
      baseUrl,
      checks: [
        'public/admin color-mode separation',
        'Docker showcase-export exclusion',
        'length-aware notification timing',
        'full-backup export notice and busy lifecycle',
        'Docker full-backup save picker, queue ordering, cleanup, and download fallback',
        'hidden-price completeness and derived ink privacy',
        'hidden public route fallback',
        'Tauri save serialization and conflict contract',
        'ink volume cl-to-volume_ml migration and ml presentation',
        'default preference preservation',
        'default currency form and pen-detail presentation',
        'stored-value ink and swatch filters',
        'pen grid/detail filter parity',
        'custom-select keyboard behavior',
        'multiselect checkbox styling and contained keyboard navigation',
        'layered field, popover, and modal Escape behavior',
        'card and pen-detail broken-image fallbacks',
        'strict renderer color input validation',
        'stored ink-name HTML escaping',
        'settings text-field no-op suppression',
        'settings persistence rollback and export gating',
        'serialized settings rollback',
        'mixed settings queue state preservation',
        'failed settings isolation from collection saves',
        'retention and concurrent activity deletion',
        'backup import settings-queue drain',
        'Docker remote HEIC conversion order',
        'atomic gallery image rollback',
        'photo-processing modal locking',
        'modal save target locking',
        'post-save cleanup finalization',
        'shared managed-image reference protection',
        'failed ink, pen, and swatch collection-save rollback',
        'failed collection and activity delete rollback',
        'same-window save serialization',
        'save rejection and stale-data conflict handling',
        'pen make-primary persistence',
        'pen primary delete promotion',
        'swatch make-primary persistence',
        'swatch detail carousel arrows',
        'shared calendar rendering',
        'pen detail carousel arrows without dot-pill',
        'Activity filter sidebar behavior'
      ]
    }, null, 2));
  } finally {
    if (client) client.close();
    chromium.kill('SIGTERM');
    server.kill('SIGTERM');
    await Promise.race([chromiumExited, sleep(2000)]);
    await Promise.race([serverExited, sleep(2000)]);
    await fs.rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (server.exitCode && server.exitCode !== 0 && serverLog.length) {
      process.stderr.write(serverLog.join(''));
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
