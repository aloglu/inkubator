#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { normalizeAppData } = require('../lib/data-schema');

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

async function waitForJson(url, timeoutMs = 15000) {
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

function svgImage(color, width = 12, height = 24) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="2" fill="${color}"/></svg>`;
}

async function writeFixture() {
  const images = {
    'pens/delete-a.svg': svgImage('#0f5132'),
    'pens/delete-b.svg': svgImage('#5f0f40'),
    'pens/delete-c.svg': svgImage('#1d4ed8'),
    'pens/make-a.svg': svgImage('#111827'),
    'pens/make-b.svg': svgImage('#b45309'),
    'pens/make-c.svg': svgImage('#6d28d9'),
    'pens/detail-a.svg': svgImage('#0f766e'),
    'pens/detail-b.svg': svgImage('#dc2626', 24, 12),
    'pens/detail-c.svg': svgImage('#2563eb'),
    'swatches/swatch-a.svg': svgImage('#60a5fa', 24, 12),
    'swatches/swatch-b.svg': svgImage('#f472b6', 24, 12)
  };

  await fs.mkdir(path.join(dataDir, 'images', 'pens'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'images', 'swatches'), { recursive: true });
  for (const [relativePath, content] of Object.entries(images)) {
    await fs.writeFile(path.join(dataDir, 'images', relativePath), content, 'utf8');
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
        image: 'pens/delete-a.svg',
        image_rotation: 0,
        images: [
          { id: 'delete-a', path: 'pens/delete-a.svg', rotation: 0, primary: true },
          { id: 'delete-b', path: 'pens/delete-b.svg', rotation: 0, primary: false },
          { id: 'delete-c', path: 'pens/delete-c.svg', rotation: 0, primary: false }
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
        image: 'pens/make-a.svg',
        image_rotation: 0,
        images: [
          { id: 'make-a', path: 'pens/make-a.svg', rotation: 0, primary: true },
          { id: 'make-b', path: 'pens/make-b.svg', rotation: 0, primary: false },
          { id: 'make-c', path: 'pens/make-c.svg', rotation: 0, primary: false }
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
        hex_color: '#0f766e',
        hex_colors: ['#0f766e'],
        image: 'pens/detail-a.svg',
        image_rotation: 0,
        images: [
          { id: 'detail-a', path: 'pens/detail-a.svg', rotation: 0, primary: true },
          { id: 'detail-b', path: 'pens/detail-b.svg', rotation: 0, primary: false },
          { id: 'detail-c', path: 'pens/detail-c.svg', rotation: 0, primary: false }
        ]
      }
    ],
    inks: [
      {
        id: 'ink-blue',
        brand: 'Pilot',
        name: 'Blue Test',
        type: 'Bottle',
        color_base: '#2563eb',
        color_accent: '#60a5fa',
        hex_colors: ['#2563eb', '#60a5fa']
      }
    ],
    swatches: [
      {
        id: 'swatch-make-primary',
        ink_id: 'ink-blue',
        image: 'swatches/swatch-a.svg',
        images: [
          { id: 'swatch-a', path: 'swatches/swatch-a.svg', rotation: 0, primary: true },
          { id: 'swatch-b', path: 'swatches/swatch-b.svg', rotation: 0, primary: false }
        ],
        swatch_paper: 'Test Paper',
        swatch_nib: 'M',
        swatch_date: '2026-01-15',
        swatch_lighting: 'Natural',
        created_at: now
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
      showcase: {
        title: 'Renderer Smoke',
        color_mode: 'light',
        show_swatches: false,
        show_activity_filters: true
      }
    }
  });

  const { preferences, ...collectionData } = normalized;
  await fs.writeFile(path.join(dataDir, 'data.json'), `${JSON.stringify(collectionData, null, 2)}\n`);
  await fs.writeFile(path.join(dataDir, 'preferences.json'), `${JSON.stringify(preferences, null, 2)}\n`);
}

async function main() {
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(dataDir, { recursive: true });
  await writeFixture();

  const appPort = await freePort();
  const debugPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
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
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const serverExited = new Promise((resolve) => server.once('exit', resolve));
  const chromiumExited = new Promise((resolve) => chromium.once('exit', resolve));
  let client;
  const runtimeErrors = [];

  try {
    await waitForHttp(baseUrl);
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
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

    const evaluate = async (expression, awaitPromise = true) => {
      const result = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true
      });
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

    const navigate = async (url) => {
      const loaded = client.waitFor('Page.loadEventFired');
      await client.send('Page.navigate', { url });
      await loaded;
    };

    const fetchData = () => evaluate(`fetch('/api/data').then((response) => response.json())`);

    await navigate(`${baseUrl}/`);
    await waitForCondition(`document.body && document.body.dataset.theme === 'light'`);
    const publicTheme = await evaluate(`({
      theme: document.body.dataset.theme,
      title: document.title,
      hasAdminApi: !!window.inkubatorAPI,
      hasSharedSchema: !!(window.InkubatorDataSchema && typeof window.InkubatorDataSchema.normalizeAppData === 'function')
    })`);
    assert.equal(publicTheme.theme, 'light', 'public showcase should use showcase color mode');
    assert.equal(publicTheme.hasAdminApi, false, 'public showcase should not expose admin API');
    assert.equal(publicTheme.hasSharedSchema, true, 'public showcase should load shared data schema normalization');

    await navigate(`${baseUrl}/swatches`);
    await waitForCondition(`typeof appData !== 'undefined' && !document.body.classList.contains('app-booting')`);
    const hiddenSwatchesRoute = await evaluate(`({
      pathname: window.location.pathname,
      dashboardVisible: getComputedStyle(document.querySelector('#view-dashboard')).display !== 'none',
      swatchesVisible: getComputedStyle(document.querySelector('#view-swatches')).display !== 'none',
      swatchesRendered: document.querySelectorAll('#swatches-grid .inked-card').length,
      swatchesNavHidden: getComputedStyle(document.querySelector('#nav-swatches')).display === 'none'
    })`);
    assert.equal(hiddenSwatchesRoute.pathname, '/', 'hidden public section route should be replaced with the public dashboard route');
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
    await waitForCondition(`typeof appData !== 'undefined' && document.querySelectorAll('#pens-grid .pen-card-horizontal').length >= 3`);
    const adminTheme = await evaluate(`document.body.dataset.theme`);
    assert.equal(adminTheme, 'dark', 'admin should use app color mode separately from public showcase');

    await evaluate(`openPenModal('pen-make-primary')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display !== 'none' && currentPenGallery.length === 3`);
    await evaluate(`document.querySelector('#btn-next-pen-photo').click()`);
    await waitForCondition(`currentPenGalleryIndex === 1`);
    await evaluate(`document.querySelector('#btn-primary-pen-photo').click()`);
    const madePrimary = await evaluate(`({
      primaryPath: currentPenGallery.find((entry) => entry.primary)?.path || '',
      primaryDisabled: document.querySelector('#btn-primary-pen-photo').disabled
    })`);
    assert.equal(madePrimary.primaryPath, 'pens/make-b.svg', 'make-primary should mark the visible pen image primary');
    assert.equal(madePrimary.primaryDisabled, true, 'make-primary action should disable on the primary image');
    await evaluate(`document.querySelector('#btn-save-pen').click()`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display === 'none'`);

    let data = await fetchData();
    let pen = data.pens.find((item) => item.id === 'pen-make-primary');
    assert.equal(pen.image, 'pens/make-b.svg', 'saved pen primary image should update legacy image field');
    assert.equal(pen.images.filter((entry) => entry.primary).length, 1, 'saved pen should keep exactly one primary image');
    assert.equal(pen.images.find((entry) => entry.primary).path, 'pens/make-b.svg', 'saved pen image array should persist the selected primary');

    await evaluate(`openPenModal('pen-delete-primary')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display !== 'none' && currentPenGallery.length === 3 && currentPenGalleryIndex === 0`);
    await evaluate(`document.querySelector('#btn-remove-pen-photo').click()`);
    await waitForCondition(`currentPenGallery.length === 2 && currentPenGallery[0].primary === true`);
    const deletePreview = await evaluate(`({
      length: currentPenGallery.length,
      primaryPath: currentPenGallery.find((entry) => entry.primary)?.path || '',
      currentPath: currentPenGallery[currentPenGalleryIndex]?.path || ''
    })`);
    assert.equal(deletePreview.primaryPath, 'pens/delete-b.svg', 'deleting a primary image should promote the first remaining image');
    assert.equal(deletePreview.currentPath, 'pens/delete-b.svg', 'deleted primary should leave the carousel on the promoted image');
    await evaluate(`document.querySelector('#btn-save-pen').click()`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-pen')).display === 'none'`);

    data = await fetchData();
    pen = data.pens.find((item) => item.id === 'pen-delete-primary');
    assert.equal(pen.image, 'pens/delete-b.svg', 'persisted pen image should follow the promoted primary');
    assert.equal(pen.images.length, 2, 'deleted pen image should be removed from persisted gallery');
    assert.equal(pen.images.filter((entry) => entry.primary).length, 1, 'delete flow should persist exactly one primary image');

    await evaluate(`openEditSwatchModal('swatch-make-primary')`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-add-swatch')).display !== 'none' && currentSwatchGallery.length === 2`);
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
    await evaluate(`document.querySelector('#btn-save-swatch-unified').click()`);
    await waitForCondition(`getComputedStyle(document.querySelector('#modal-add-swatch')).display === 'none'`);

    data = await fetchData();
    const swatch = data.swatches.find((item) => item.id === 'swatch-make-primary');
    assert.equal(swatch.image, 'swatches/swatch-b.svg', 'saved swatch primary image should update legacy image field');
    assert.equal(swatch.images.filter((entry) => entry.primary).length, 1, 'saved swatch should keep exactly one primary image');
    assert.equal(swatch.images.find((entry) => entry.primary).path, 'swatches/swatch-b.svg', 'saved swatch image array should persist the selected primary');

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
        'hidden public route fallback',
        'pen make-primary persistence',
        'pen primary delete promotion',
        'swatch make-primary persistence',
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
