const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('Docker public routes expose only projected data and referenced public media', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-docker-public-'));
  process.env.INKUBATOR_DATA_DIR = dataDir;
  process.env.INKUBATOR_ADMIN_USER = 'privacy-admin';
  process.env.INKUBATOR_ADMIN_PASSWORD = 'privacy-password';

  const { initStorage, server } = require('../server/docker-server');
  await initStorage();

  const collection = {
    pens: [{
      id: 'public-pen',
      brand: 'Public Pen Brand',
      model: 'Public Pen Model',
      price: '500',
      image: 'pens/public.webp',
      images: [{ id: 'public-image', path: 'pens/public.webp', rotation: 0, primary: true }]
    }],
    inks: [{
      id: 'private-ink',
      brand: 'Private Ink Brand',
      name: 'Private Ink Name',
      price: '75',
      notes: 'Private ink notes',
      image: 'inks/private.webp'
    }],
    swatches: [{
      id: 'private-swatch',
      ink_id: 'private-ink',
      image: 'swatches/private.webp',
      swatch_paper: 'Private paper'
    }],
    currently_inked: [],
    activity_log: [
      {
        id: 'private-activity-id',
        timestamp: 1_700_000_000_000,
        action: 'updated',
        category: 'pen',
        entity_id: 'public-pen',
        message: 'Changed price to 500.',
        metadata: { price: '500', secret: 'private pen metadata' }
      },
      {
        timestamp: 1_699_999_999_999,
        action: 'updated',
        category: 'ink',
        entity_id: 'private-ink',
        message: 'Private Ink Name notes changed.',
        metadata: { secret: 'private ink metadata' }
      }
    ]
  };
  const preferences = {
    show_activity_log: true,
    show_recent_activity: true,
    open_cards_in_edit_mode: false,
    confirm_destructive_actions: false,
    defaults: {
      currency: 'EUR',
      date_format: 'iso',
      pen_nib: 'Private Default'
    },
    backup: {
      auto_frequency: 'daily',
      retention_count: 30
    },
    showcase: {
      title: 'Privacy Test',
      color_mode: 'dark',
      show_prices: false,
      show_pens: true,
      show_inks: false,
      show_swatches: false,
      show_activity_filters: true,
      show_insights: true,
      show_charts: true
    }
  };

  await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(collection));
  await fs.writeFile(path.join(dataDir, 'preferences.json'), JSON.stringify(preferences));
  await fs.writeFile(path.join(dataDir, 'images', 'pens', 'public.webp'), 'public pen image');
  await fs.writeFile(
    path.join(dataDir, 'images', '.thumbs', 'pens', 'public.webp'),
    'public pen thumbnail'
  );
  await fs.writeFile(path.join(dataDir, 'images', 'pens', 'unreferenced.webp'), 'unreferenced pen image');
  await fs.writeFile(path.join(dataDir, 'images', 'inks', 'private.webp'), 'private ink image');
  await fs.writeFile(path.join(dataDir, 'images', 'swatches', 'private.webp'), 'private swatch image');

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const authorization = `Basic ${Buffer.from('privacy-admin:privacy-password').toString('base64')}`;
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Proto': 'https'
    },
    body: JSON.stringify({
      username: 'privacy-admin',
      password: 'privacy-password'
    })
  });
  assert.equal(loginResponse.status, 200);
  const setCookie = loginResponse.headers.get('set-cookie') || '';
  assert.match(setCookie, /\bHttpOnly\b/);
  assert.match(setCookie, /\bSameSite=Lax\b/);
  assert.match(setCookie, /\bSecure\b/);
  const sessionCookie = setCookie.split(';')[0];

  t.after(async () => {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await fs.rm(dataDir, { recursive: true, force: true });
    delete process.env.INKUBATOR_DATA_DIR;
    delete process.env.INKUBATOR_ADMIN_USER;
    delete process.env.INKUBATOR_ADMIN_PASSWORD;
  });

  const publicDataResponse = await fetch(`${baseUrl}/data.js`);
  assert.equal(publicDataResponse.status, 200);
  const publicDataScript = await publicDataResponse.text();
  const match = publicDataScript.match(/^window\.__INKUBATOR_DATA__ = (.*);\n?$/s);
  assert.ok(match);
  const publicData = JSON.parse(match[1]);

  assert.equal(publicData.pens.length, 1);
  assert.equal(publicData.pens[0].price, undefined);
  assert.deepEqual(publicData.inks, []);
  assert.deepEqual(publicData.swatches, []);
  assert.deepEqual(publicData.currently_inked, []);
  assert.equal(publicData.activity_log.length, 1);
  assert.equal(publicData.activity_log[0].message, 'pen: updated');
  assert.deepEqual(publicData.activity_log[0].metadata, {});
  assert.equal(publicData.preferences.backup, undefined);
  assert.equal(publicData.preferences.open_cards_in_edit_mode, undefined);
  assert.equal(publicData.preferences.defaults.currency, undefined);
  assert.doesNotMatch(publicDataScript, /Private Ink Name|Private ink notes|private ink metadata|Changed price to 500/);

  const publicJsonResponse = await fetch(`${baseUrl}/data.json`);
  assert.equal(publicJsonResponse.status, 200);
  assert.deepEqual(await publicJsonResponse.json(), publicData);

  const publicIndex = await fetch(`${baseUrl}/`);
  assert.equal(publicIndex.status, 200);
  assert.equal(publicIndex.headers.get('content-security-policy'), "frame-ancestors 'none'");
  assert.equal(publicIndex.headers.get('referrer-policy'), 'same-origin');
  assert.equal(publicIndex.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(publicIndex.headers.get('x-frame-options'), 'DENY');
  assert.match(await publicIndex.text(), /data-inkubator-public-color-mode="dark"/);

  const publicPenImage = await fetch(`${baseUrl}/images/pens/public.webp`);
  assert.equal(publicPenImage.status, 200);
  assert.equal(publicPenImage.headers.get('cache-control'), 'public, no-cache');
  assert.equal(await publicPenImage.text(), 'public pen image');

  const publicPenThumbnail = await fetch(`${baseUrl}/thumbs/pens/public.webp`);
  assert.equal(publicPenThumbnail.status, 200);
  assert.equal(publicPenThumbnail.headers.get('content-type'), 'image/webp');
  assert.equal(await publicPenThumbnail.text(), 'public pen thumbnail');

  assert.equal((await fetch(`${baseUrl}/images/inks/private.webp`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/thumbs/inks/private.webp`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/images/swatches/private.webp`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/images/pens/unreferenced.webp`)).status, 404);

  const headers = { Authorization: authorization };
  const privateDataResponse = await fetch(`${baseUrl}/api/data`, { headers });
  assert.equal(privateDataResponse.status, 200);
  const privateData = await privateDataResponse.json();
  assert.equal(privateData.data.pens[0].price, '500');
  assert.equal(privateData.data.inks[0].name, 'Private Ink Name');
  assert.equal(privateData.data.preferences.backup.retention_count, 30);

  const disabledShowcaseExport = await fetch(`${baseUrl}/api/export-showcase`, {
    method: 'POST',
    headers
  });
  assert.equal(disabledShowcaseExport.status, 410);
  assert.deepEqual(await disabledShowcaseExport.json(), {
    success: false,
    message: 'Showcase export is unavailable in Docker mode because the public website is served directly.'
  });

  const foreignOriginMutation = await fetch(`${baseUrl}/api/delete-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      Origin: 'https://attacker.example'
    },
    body: JSON.stringify({ relativePath: 'pens/public.webp' })
  });
  assert.equal(foreignOriginMutation.status, 403);

  const sameSiteMutation = await fetch(`${baseUrl}/api/delete-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      Origin: baseUrl,
      'Sec-Fetch-Site': 'same-site'
    },
    body: JSON.stringify({ relativePath: 'pens/public.webp' })
  });
  assert.equal(sameSiteMutation.status, 403);

  const plainTextMutation = await fetch(`${baseUrl}/api/delete-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Cookie: sessionCookie
    },
    body: JSON.stringify({ relativePath: 'pens/public.webp' })
  });
  assert.equal(plainTextMutation.status, 415);

  const sameOriginMutation = await fetch(`${baseUrl}/api/delete-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      Origin: baseUrl,
      'Sec-Fetch-Site': 'same-origin'
    },
    body: JSON.stringify({ relativePath: 'pens/does-not-exist.webp' })
  });
  assert.equal(sameOriginMutation.status, 200);

  const privateInkImage = await fetch(`${baseUrl}/api/images/inks/private.webp`, { headers });
  assert.equal(privateInkImage.status, 200);
  assert.equal(privateInkImage.headers.get('cache-control'), 'private, no-cache');
  assert.equal(await privateInkImage.text(), 'private ink image');

  const privateUnreferencedImage = await fetch(`${baseUrl}/api/images/pens/unreferenced.webp`, { headers });
  assert.equal(privateUnreferencedImage.status, 200);
  assert.equal(await privateUnreferencedImage.text(), 'unreferenced pen image');

  const reshownData = structuredClone(privateData.data);
  reshownData.preferences.showcase.show_inks = true;
  reshownData.preferences.showcase.show_swatches = true;
  const reshowSave = await fetch(`${baseUrl}/api/data`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: reshownData,
      expectedRevision: privateData.revision
    })
  });
  assert.equal(reshowSave.status, 200);
  assert.equal((await reshowSave.json()).success, true);

  const reshownPublicResponse = await fetch(`${baseUrl}/data.json`);
  assert.equal(reshownPublicResponse.status, 200);
  const reshownPublic = await reshownPublicResponse.json();
  assert.equal(reshownPublic.inks[0].name, 'Private Ink Name');
  assert.equal(reshownPublic.inks[0].notes, 'Private ink notes');
  assert.equal(reshownPublic.inks[0].price, undefined);
  assert.equal(reshownPublic.swatches[0].id, 'private-swatch');
  assert.equal((await fetch(`${baseUrl}/images/inks/private.webp`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/images/swatches/private.webp`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/images/pens/unreferenced.webp`)).status, 404);

  const reshownPrivateResponse = await fetch(`${baseUrl}/api/data`, { headers });
  assert.equal(reshownPrivateResponse.status, 200);
  const reshownPrivate = await reshownPrivateResponse.json();
  assert.equal(reshownPrivate.data.inks[0].price, '75');
  assert.equal(reshownPrivate.data.swatches[0].id, 'private-swatch');
});
