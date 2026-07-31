const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const yazl = require('yazl');
const { extractBackupZip } = require('../lib/backup-archive');

async function createZipBytes(entries) {
  const zip = new yazl.ZipFile();
  for (const [name, value] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(value), name);
  }
  const completed = (async () => {
    const chunks = [];
    for await (const chunk of zip.outputStream) chunks.push(chunk);
    return Buffer.concat(chunks);
  })();
  zip.end();
  return completed;
}

test('authenticated Docker routes export and restore a full backup', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-docker-backup-'));
  process.env.INKUBATOR_DATA_DIR = dataDir;
  process.env.INKUBATOR_ADMIN_USER = 'route-admin';
  process.env.INKUBATOR_ADMIN_PASSWORD = 'route-password';

  const {
    commitLiveStorageTransaction,
    initStorage,
    server,
    sortStorageTransactionEntries
  } = require('../server/docker-server');
  await initStorage();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const authorization = `Basic ${Buffer.from('route-admin:route-password').toString('base64')}`;

  t.after(async () => {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const authorizedFetch = (route, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', authorization);
    return fetch(`${baseUrl}${route}`, { ...options, headers });
  };
  const postJson = (route, payload) => authorizedFetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.deepEqual(
    sortStorageTransactionEntries([
      { name: '.import-rollback-200-newer' },
      { name: '.collection-save-rollback-100-older' }
    ]).map((entry) => entry.name),
    ['.collection-save-rollback-100-older', '.import-rollback-200-newer']
  );

  const unauthorized = await fetch(`${baseUrl}/api/export-backup`, { method: 'POST' });
  assert.equal(unauthorized.status, 401);

  const initialResponse = await authorizedFetch('/api/data');
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  assert.equal(initial.success, true);
  assert.equal(typeof initial.revision, 'string');
  assert.equal('_inkubator_storage_revision' in initial.data.preferences, false);

  const gateSuffix = 'route-committed-cleanup';
  const gateStage = path.join(dataDir, `.collection-save-stage-${gateSuffix}`);
  const gateRollback = path.join(dataDir, `.collection-save-rollback-${gateSuffix}`);
  await fs.mkdir(gateStage);
  await fs.copyFile(path.join(dataDir, 'data.json'), path.join(gateStage, 'data.json'));
  await fs.copyFile(
    path.join(dataDir, 'preferences.json'),
    path.join(gateStage, 'preferences.json')
  );
  let failGateCleanup = true;
  const gateFileSystem = {
    mkdir: (...args) => fs.mkdir(...args),
    rm: async (target, ...args) => {
      if (target === gateStage && failGateCleanup) {
        failGateCleanup = false;
        throw new Error('injected route cleanup failure');
      }
      return fs.rm(target, ...args);
    },
    stat: (...args) => fs.stat(...args),
    writeFile: (...args) => fs.writeFile(...args),
    rename: (...args) => fs.rename(...args)
  };
  const gateCommit = await commitLiveStorageTransaction({
    stagedRoot: gateStage,
    rollbackRoot: gateRollback,
    fileSystem: gateFileSystem,
    targets: [
      {
        kind: 'file',
        name: 'data.json',
        staged: path.join(gateStage, 'data.json'),
        target: path.join(dataDir, 'data.json')
      },
      {
        kind: 'file',
        name: 'preferences.json',
        staged: path.join(gateStage, 'preferences.json'),
        target: path.join(dataDir, 'preferences.json')
      }
    ]
  });
  assert.equal(gateCommit.recoveryRequired, true);
  assert.ok(await fs.stat(gateRollback));

  const afterGateRecoveryResponse = await authorizedFetch('/api/data');
  assert.equal(afterGateRecoveryResponse.status, 200);
  assert.equal((await afterGateRecoveryResponse.json()).revision, initial.revision);
  assert.equal(await fs.stat(gateStage).catch(() => null), null);
  assert.equal(await fs.stat(gateRollback).catch(() => null), null);

  const missingReferenceSave = await postJson('/api/data', {
    data: {
      ...initial.data,
      pens: [{ id: 'missing-reference', image: 'pens/not-uploaded.webp' }]
    },
    expectedRevision: initial.revision
  });
  assert.equal(missingReferenceSave.status, 400);
  assert.match((await missingReferenceSave.json()).message, /referenced image is missing/i);
  assert.equal((await (await authorizedFetch('/api/data')).json()).revision, initial.revision);

  const whitespaceReferenceSave = await postJson('/api/data', {
    data: {
      ...initial.data,
      pens: [{
        id: 'whitespace-reference',
        image_url: ' https://example.test/external.webp'
      }]
    },
    expectedRevision: initial.revision
  });
  assert.equal(whitespaceReferenceSave.status, 400);
  assert.match((await whitespaceReferenceSave.json()).message, /unsupported managed image path/i);
  assert.equal((await (await authorizedFetch('/api/data')).json()).revision, initial.revision);

  const imageBytes = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 28, g: 79, b: 160, alpha: 1 }
    }
  }).webp().toBuffer();
  const secondImageBytes = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 160, g: 42, b: 55, alpha: 1 }
    }
  }).webp().toBuffer();
  const imageMetadata = {
    brand: 'Route',
    model: 'Round Trip',
    nib: 'M',
    color: 'Blue'
  };
  const [imageResponse, secondImageResponse, legacySwatchImageResponse] = await Promise.all([
    postJson('/api/save-image-bytes', {
      imageType: 'pen',
      metadata: imageMetadata,
      bytesBase64: imageBytes.toString('base64'),
      thumbnailBase64: imageBytes.toString('base64')
    }),
    postJson('/api/save-image-bytes', {
      imageType: 'pen',
      metadata: imageMetadata,
      bytesBase64: secondImageBytes.toString('base64'),
      thumbnailBase64: secondImageBytes.toString('base64')
    }),
    postJson('/api/save-image-bytes', {
      imageType: 'swatch',
      metadata: { brand: 'Route', model: 'Legacy Swatch' },
      bytesBase64: secondImageBytes.toString('base64'),
      thumbnailBase64: secondImageBytes.toString('base64')
    })
  ]);
  assert.equal(imageResponse.status, 200);
  assert.equal(secondImageResponse.status, 200);
  assert.equal(legacySwatchImageResponse.status, 200);
  const imagePath = await imageResponse.json();
  const secondImagePath = await secondImageResponse.json();
  const legacySwatchImagePath = await legacySwatchImageResponse.json();
  assert.match(imagePath, /^pens\/.+\.webp$/);
  assert.match(secondImagePath, /^pens\/.+\.webp$/);
  assert.notEqual(secondImagePath, imagePath);

  const [storedImageResponse, storedSecondImageResponse] = await Promise.all([
    authorizedFetch(`/api/images/${imagePath}`),
    authorizedFetch(`/api/images/${secondImagePath}`)
  ]);
  assert.deepEqual(Buffer.from(await storedImageResponse.arrayBuffer()), imageBytes);
  assert.deepEqual(Buffer.from(await storedSecondImageResponse.arrayBuffer()), secondImageBytes);

  const originalData = {
    pens: [{
      id: 'route-pen-original',
      brand: 'Route',
      model: 'Round Trip',
      image: imagePath,
      image_url: secondImagePath,
      images: [{
        id: 'route-image-original',
        path: imagePath,
        rotation: 0,
        primary: true
      }, secondImagePath]
    }],
    inks: [{
      id: 'route-ink-original',
      brand: 'Route',
      name: 'Backup Blue',
      image: legacySwatchImagePath
    }],
    swatches: [],
    currently_inked: [],
    activity_log: [],
    preferences: {
      backup: {
        auto_frequency: 'off',
        retention_count: 3,
        keep_replaced_images: false
      }
    }
  };
  const originalSave = await postJson('/api/data', {
    data: originalData,
    expectedRevision: initial.revision
  });
  assert.equal(originalSave.status, 200);
  const originalSaveResult = await originalSave.json();
  assert.equal(originalSaveResult.success, true);
  assert.equal(typeof originalSaveResult.revision, 'string');
  assert.notEqual(originalSaveResult.revision, initial.revision);
  const originalStoredPreferences = JSON.parse(
    await fs.readFile(path.join(dataDir, 'preferences.json'), 'utf8')
  );
  assert.match(originalStoredPreferences._inkubator_storage_revision, /^[0-9a-f-]{36}$/i);

  const staleSave = await postJson('/api/data', {
    data: {
      ...originalData,
      pens: [{ id: 'route-pen-stale', brand: 'Stale', model: 'Rejected' }]
    },
    expectedRevision: initial.revision
  });
  assert.equal(staleSave.status, 409);
  assert.deepEqual(await staleSave.json(), {
    success: false,
    code: 'DATA_CONFLICT',
    conflict: true,
    revision: originalSaveResult.revision,
    message: 'Collection data changed since it was loaded. Reload before saving again.'
  });

  await fs.rm(path.join(dataDir, 'images', secondImagePath));
  const incompleteExport = await authorizedFetch('/api/export-backup', { method: 'POST' });
  assert.equal(incompleteExport.status, 409);
  assert.match((await incompleteExport.json()).message, /referenced image is missing/i);
  await fs.writeFile(path.join(dataDir, 'images', secondImagePath), secondImageBytes);

  const directoryLinkType = process.platform === 'win32' ? 'junction' : 'dir';
  const dataPath = path.join(dataDir, 'data.json');
  const dataBeforeSymlinkExport = await fs.readFile(dataPath);
  const outsideExportMedia = path.join(dataDir, 'outside-export-media');
  const linkedExportParent = path.join(dataDir, 'images', 'pens', 'linked-export');
  let linkedExportResponse;
  await fs.mkdir(outsideExportMedia);
  await fs.writeFile(path.join(outsideExportMedia, 'escape.webp'), imageBytes);
  await fs.symlink(outsideExportMedia, linkedExportParent, directoryLinkType);
  try {
    const collectionWithLinkedImage = JSON.parse(dataBeforeSymlinkExport.toString('utf8'));
    collectionWithLinkedImage.pens.push({
      id: 'linked-export-pen',
      image: 'pens/linked-export/escape.webp'
    });
    await fs.writeFile(dataPath, JSON.stringify(collectionWithLinkedImage));
    linkedExportResponse = await authorizedFetch('/api/export-backup', { method: 'POST' });
  } finally {
    await fs.writeFile(dataPath, dataBeforeSymlinkExport);
    await fs.unlink(linkedExportParent);
    await fs.rm(outsideExportMedia, { recursive: true });
  }
  assert.equal(linkedExportResponse.status, 409);
  assert.match(
    (await linkedExportResponse.json()).message,
    /symbolic-link parent|managed image directory/i
  );
  const restoredAfterSymlinkExport = await (await authorizedFetch('/api/data')).json();
  assert.equal(restoredAfterSymlinkExport.revision, originalSaveResult.revision);
  assert.equal(restoredAfterSymlinkExport.data.pens.length, originalData.pens.length);

  const exported = await authorizedFetch('/api/export-backup', { method: 'POST' });
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get('content-type'), 'application/zip');
  assert.match(
    exported.headers.get('content-disposition') || '',
    /^attachment; filename="inkubator-backup-.*\.zip"$/
  );
  const backupBytes = Buffer.from(await exported.arrayBuffer());
  assert.ok(backupBytes.length > imageBytes.length);
  const exportedZipPath = path.join(dataDir, 'export-inspection.zip');
  const exportedInspection = path.join(dataDir, 'export-inspection');
  await fs.writeFile(exportedZipPath, backupBytes);
  await extractBackupZip(exportedZipPath, exportedInspection);
  const exportedPreferences = JSON.parse(
    await fs.readFile(path.join(exportedInspection, 'preferences.json'), 'utf8')
  );
  assert.equal('_inkubator_storage_revision' in exportedPreferences, false);
  await fs.rm(exportedZipPath);
  await fs.rm(exportedInspection, { recursive: true });

  const replacementSave = await postJson('/api/data', {
    data: {
      pens: [{ id: 'route-pen-replacement', brand: 'Other', model: 'Temporary' }],
      inks: [],
      swatches: [],
      currently_inked: [],
      activity_log: [],
      preferences: originalData.preferences
    },
    expectedRevision: originalSaveResult.revision
  });
  assert.equal(replacementSave.status, 200);
  const replacementSaveResult = await replacementSave.json();
  assert.equal(replacementSaveResult.success, true);
  assert.notEqual(replacementSaveResult.revision, originalSaveResult.revision);
  const replacementStoredPreferences = JSON.parse(
    await fs.readFile(path.join(dataDir, 'preferences.json'), 'utf8')
  );
  assert.notEqual(
    replacementStoredPreferences._inkubator_storage_revision,
    originalStoredPreferences._inkubator_storage_revision
  );

  const missingTreeBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [{ id: 'missing-tree', image: 'pens/missing.webp' }],
      inks: [],
      swatches: [],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '{}',
    'manifest.json': '{"type":"inkubator-backup","version":3}'
  });
  const missingTreeImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': replacementSaveResult.revision
    },
    body: missingTreeBackup
  });
  assert.equal(missingTreeImport.status, 400);
  assert.match((await missingTreeImport.json()).message, /referenced image is missing/i);

  const missingOneBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [{
        id: 'missing-one',
        image: 'pens/present.webp',
        images: ['pens/present.webp', { url: 'pens/nested/missing.webp' }]
      }],
      inks: [],
      swatches: [],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '{}',
    'manifest.json': '{"type":"inkubator-backup","version":3}',
    'images/pens/present.webp': imageBytes
  });
  const missingOneImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': replacementSaveResult.revision
    },
    body: missingOneBackup
  });
  assert.equal(missingOneImport.status, 400);
  assert.match((await missingOneImport.json()).message, /pens\/nested\/missing\.webp/i);

  const invalidPreferencesBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [],
      inks: [],
      swatches: [],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '[]',
    'manifest.json': '{"type":"inkubator-backup","version":3}'
  });
  const invalidPreferencesImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': replacementSaveResult.revision
    },
    body: invalidPreferencesBackup
  });
  assert.equal(invalidPreferencesImport.status, 400);
  assert.match((await invalidPreferencesImport.json()).message, /must be JSON objects/i);

  const liveDataBeforeMalformedImport = await fs.readFile(path.join(dataDir, 'data.json'));
  const livePreferencesBeforeMalformedImport = await fs.readFile(
    path.join(dataDir, 'preferences.json')
  );
  const revisionBeforeMalformedImport = (
    await (await authorizedFetch('/api/data')).json()
  ).revision;
  const malformedPreferencesBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [],
      inks: [],
      swatches: [],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '{"backup":',
    'manifest.json': '{"type":"inkubator-backup","version":3}'
  });
  const malformedPreferencesImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': revisionBeforeMalformedImport
    },
    body: malformedPreferencesBackup
  });
  assert.equal(malformedPreferencesImport.status, 400);
  assert.match((await malformedPreferencesImport.json()).message, /preferences\.json/i);
  assert.deepEqual(
    await fs.readFile(path.join(dataDir, 'data.json')),
    liveDataBeforeMalformedImport
  );
  assert.deepEqual(
    await fs.readFile(path.join(dataDir, 'preferences.json')),
    livePreferencesBeforeMalformedImport
  );
  const stateAfterMalformedImport = await (await authorizedFetch('/api/data')).json();
  assert.equal(stateAfterMalformedImport.revision, revisionBeforeMalformedImport);

  const unchangedAfterRejectedImports = await (await authorizedFetch('/api/data')).json();
  assert.equal(unchangedAfterRejectedImports.revision, replacementSaveResult.revision);
  assert.equal(unchangedAfterRejectedImports.data.pens[0].id, 'route-pen-replacement');

  const deleteImage = await postJson('/api/delete-image', { relativePath: imagePath });
  assert.equal(deleteImage.status, 200);

  const staleImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': originalSaveResult.revision
    },
    body: backupBytes
  });
  assert.equal(staleImport.status, 409);
  const staleImportResult = await staleImport.json();
  assert.equal(staleImportResult.code, 'DATA_CONFLICT');
  assert.equal(staleImportResult.revision, replacementSaveResult.revision);

  const unsafeReferenceBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [{ id: 'unsafe-pen', image: 'pens/payload.html' }],
      inks: [],
      swatches: [],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '{}',
    'manifest.json': '{"type":"inkubator-backup","version":3}'
  });
  const unsafeImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': replacementSaveResult.revision
    },
    body: unsafeReferenceBackup
  });
  assert.equal(unsafeImport.status, 400);
  assert.match((await unsafeImport.json()).message, /unsupported managed image path/i);

  const noncanonicalSwatchAliasBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [],
      inks: [{
        id: 'stale-swatch-alias',
        image: 'swatches/missing-legacy.webp'
      }],
      swatches: [{
        id: 'noncanonical-current-swatch',
        ink_id: 'stale-swatch-alias',
        image: 'inks/wrong-section.webp',
        image_url: 'swatches/noncanonical.webp'
      }],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '{}',
    'manifest.json': '{"type":"inkubator-backup","version":3}',
    'images/inks/wrong-section.webp': imageBytes,
    'images/swatches/noncanonical.webp': secondImageBytes
  });
  const noncanonicalSwatchAliasImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': replacementSaveResult.revision
    },
    body: noncanonicalSwatchAliasBackup
  });
  assert.equal(noncanonicalSwatchAliasImport.status, 400);
  assert.match(
    (await noncanonicalSwatchAliasImport.json()).message,
    /swatches\/missing-legacy\.webp/i
  );

  const legacyPngBytes = await sharp({
    create: {
      width: 5,
      height: 3,
      channels: 4,
      background: { r: 42, g: 95, b: 72, alpha: 1 }
    }
  }).png().toBuffer();
  const legacyCompatibilityBackup = await createZipBytes({
    'data.json': JSON.stringify({
      pens: [{
        id: 'legacy-png-pen',
        image: 'pens/legacy-png.webp'
      }],
      inks: [{
        id: 'stale-swatch-alias',
        image: 'swatches/missing-legacy.webp'
      }, {
        id: 'preserved-swatch-alias',
        image: 'swatches/preserved-legacy.webp'
      }],
      swatches: [{
        id: 'current-swatch',
        ink_id: 'stale-swatch-alias',
        image: 'swatches/current.webp'
      }, {
        id: 'preserved-current-swatch',
        ink_id: 'preserved-swatch-alias',
        image: 'swatches/preserved-current.webp'
      }],
      currently_inked: [],
      activity_log: []
    }),
    'preferences.json': '{}',
    'manifest.json': '{"type":"inkubator-backup","version":3}',
    'images/pens/legacy-png.webp': legacyPngBytes,
    'images/swatches/current.webp': imageBytes,
    'images/swatches/preserved-legacy.webp': imageBytes,
    'images/swatches/preserved-current.webp': secondImageBytes
  });
  const legacyCompatibilityImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': replacementSaveResult.revision
    },
    body: legacyCompatibilityBackup
  });
  assert.equal(legacyCompatibilityImport.status, 200);
  const legacyCompatibilityResult = await legacyCompatibilityImport.json();
  assert.equal(legacyCompatibilityResult.success, true);
  assert.equal(legacyCompatibilityResult.data.inks[0].image, '');
  assert.equal(
    legacyCompatibilityResult.data.inks[1].image,
    'swatches/preserved-legacy.webp'
  );
  const repairedLegacyPng = await fs.readFile(
    path.join(dataDir, 'images', 'pens', 'legacy-png.webp')
  );
  assert.equal(repairedLegacyPng.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(repairedLegacyPng.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.equal(
    (await sharp(repairedLegacyPng).metadata()).format,
    'webp'
  );

  const corruptLiveCollection = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  corruptLiveCollection.pens[0].image = 'pens/missing-live-image.webp';
  await fs.writeFile(dataPath, JSON.stringify(corruptLiveCollection));
  const corruptLiveState = await (await authorizedFetch('/api/data')).json();

  const imported = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': corruptLiveState.revision
    },
    body: backupBytes
  });
  assert.equal(imported.status, 200);
  const importResult = await imported.json();
  assert.equal(importResult.success, true);
  assert.equal(importResult.warning, true);
  assert.match(importResult.message, /pre-import restore snapshot failed/i);
  assert.equal(importResult.data.pens[0].id, 'route-pen-original');
  assert.equal('_inkubator_storage_revision' in importResult.data.preferences, false);
  const importedStoredPreferences = JSON.parse(
    await fs.readFile(path.join(dataDir, 'preferences.json'), 'utf8')
  );
  assert.notEqual(
    importedStoredPreferences._inkubator_storage_revision,
    originalStoredPreferences._inkubator_storage_revision
  );

  const restoredResponse = await authorizedFetch('/api/data');
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json();
  assert.equal(restored.success, true);
  assert.equal(restored.revision, importResult.revision);
  const restoredData = restored.data;
  assert.equal(restoredData.pens[0].id, 'route-pen-original');
  assert.equal(restoredData.inks[0].id, 'route-ink-original');
  assert.equal(restoredData.pens[0].image, imagePath);
  assert.equal('_inkubator_storage_revision' in restoredData.preferences, false);

  const identicalImport = await authorizedFetch('/api/import-backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Inkubator-Expected-Revision': restored.revision
    },
    body: backupBytes
  });
  assert.equal(identicalImport.status, 200);
  const identicalImportResult = await identicalImport.json();
  assert.notEqual(identicalImportResult.revision, restored.revision);

  const staleAfterIdenticalImport = await postJson('/api/data', {
    data: restoredData,
    expectedRevision: restored.revision
  });
  assert.equal(staleAfterIdenticalImport.status, 409);
  assert.equal(
    (await staleAfterIdenticalImport.json()).revision,
    identicalImportResult.revision
  );
  restored.revision = identicalImportResult.revision;

  const restoredImageResponse = await authorizedFetch(`/api/images/${imagePath}`);
  assert.equal(restoredImageResponse.status, 200);
  assert.deepEqual(Buffer.from(await restoredImageResponse.arrayBuffer()), imageBytes);
  assert.equal((await authorizedFetch(`/api/images/${secondImagePath}`)).status, 200);
  assert.equal((await authorizedFetch(`/api/images/${legacySwatchImagePath}`)).status, 200);

  const autoBackupDir = path.join(dataDir, 'backups', 'auto');
  const backupStatusBefore = await authorizedFetch('/api/backup-status');
  assert.equal(backupStatusBefore.status, 200);
  const backupStatusBeforeData = await backupStatusBefore.json();
  const incompleteBackup = path.join(autoBackupDir, 'auto-incomplete');
  const abandonedBackupStage = path.join(autoBackupDir, '.auto-stage-abandoned');
  const manualBackupDir = path.join(dataDir, 'backups', 'manual');
  const abandonedUpload = path.join(manualBackupDir, '.upload-abandoned.zip');
  const unexpectedUpload = path.join(manualBackupDir, '.upload-keep.txt');
  const uploadSymlinkTarget = path.join(dataDir, 'upload-symlink-target.zip');
  const uploadSymlink = path.join(manualBackupDir, '.upload-link.zip');
  await fs.mkdir(incompleteBackup, { recursive: true });
  await fs.writeFile(path.join(incompleteBackup, 'data.json'), '{}');
  await fs.mkdir(abandonedBackupStage, { recursive: true });
  await fs.writeFile(path.join(abandonedBackupStage, 'data.json'), '{}');
  await fs.writeFile(abandonedUpload, 'abandoned upload');
  await fs.writeFile(unexpectedUpload, 'unexpected file');
  await fs.writeFile(uploadSymlinkTarget, 'symlink target');
  await fs.symlink(uploadSymlinkTarget, uploadSymlink);

  const recoverySuffix = 'route-partial-save';
  const recoveryStage = path.join(dataDir, `.collection-save-stage-${recoverySuffix}`);
  const recoveryRollback = path.join(dataDir, `.collection-save-rollback-${recoverySuffix}`);
  const liveDataPath = path.join(dataDir, 'data.json');
  const livePreferencesPath = path.join(dataDir, 'preferences.json');
  const oldDataBytes = await fs.readFile(liveDataPath);
  const oldPreferencesBytes = await fs.readFile(livePreferencesPath);
  const oldStorageRevision = JSON.parse(oldPreferencesBytes.toString())
    ._inkubator_storage_revision;
  assert.match(oldStorageRevision, /^[0-9a-f-]{36}$/i);
  await fs.mkdir(recoveryStage);
  await fs.mkdir(recoveryRollback);
  await fs.writeFile(path.join(recoveryStage, 'data.json'), JSON.stringify({
    pens: [{ id: 'partial-new-pen' }],
    inks: [],
    swatches: [],
    currently_inked: [],
    activity_log: []
  }));
  await fs.writeFile(path.join(recoveryStage, 'preferences.json'), '{}');
  await fs.writeFile(path.join(recoveryRollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [
      { name: 'data.json', hadExisting: true },
      { name: 'preferences.json', hadExisting: true }
    ]
  }));
  await fs.rename(liveDataPath, path.join(recoveryRollback, 'data.json'));
  await fs.rename(livePreferencesPath, path.join(recoveryRollback, 'preferences.json'));
  await fs.rename(path.join(recoveryStage, 'data.json'), liveDataPath);

  await initStorage();

  assert.deepEqual(await fs.readFile(liveDataPath), oldDataBytes);
  assert.deepEqual(await fs.readFile(livePreferencesPath), oldPreferencesBytes);
  assert.equal(
    JSON.parse(await fs.readFile(livePreferencesPath, 'utf8'))._inkubator_storage_revision,
    oldStorageRevision
  );
  assert.equal(await fs.stat(recoveryStage).catch(() => null), null);
  assert.equal(await fs.stat(recoveryRollback).catch(() => null), null);
  assert.equal(await fs.stat(abandonedBackupStage).catch(() => null), null);
  assert.equal(await fs.stat(abandonedUpload).catch(() => null), null);
  assert.equal(await fs.readFile(unexpectedUpload, 'utf8'), 'unexpected file');
  assert.equal((await fs.lstat(uploadSymlink)).isSymbolicLink(), true);
  assert.equal(await fs.readFile(uploadSymlinkTarget, 'utf8'), 'symlink target');

  const backupStatusAfter = await authorizedFetch('/api/backup-status');
  assert.equal(backupStatusAfter.status, 200);
  const backupStatusAfterData = await backupStatusAfter.json();
  assert.equal(backupStatusAfterData.count, backupStatusBeforeData.count);
  assert.equal(backupStatusAfterData.latest?.name, backupStatusBeforeData.latest?.name);

  await fs.rm(autoBackupDir, { recursive: true, force: true });
  await fs.writeFile(autoBackupDir, 'blocks backup directory creation');
  const warningSave = await postJson('/api/data', {
    data: {
      ...restoredData,
      pens: [{ id: 'route-pen-warning', brand: 'Saved', model: 'Despite Backup Failure' }],
      preferences: {
        ...restoredData.preferences,
        backup: {
          ...restoredData.preferences.backup,
          auto_frequency: 'daily'
        }
      }
    },
    expectedRevision: restored.revision
  });
  assert.equal(warningSave.status, 200);
  const warningResult = await warningSave.json();
  assert.equal(warningResult.success, true);
  assert.equal(warningResult.warning, true);
  assert.match(warningResult.message, /backup step failed/i);
  assert.equal(typeof warningResult.revision, 'string');

  const committedResponse = await authorizedFetch('/api/data');
  const committed = await committedResponse.json();
  assert.equal(committed.revision, warningResult.revision);
  const committedData = committed.data;
  assert.equal(committedData.pens[0].id, 'route-pen-warning');
  assert.doesNotThrow(() => JSON.parse(
    require('node:fs').readFileSync(path.join(dataDir, 'data.json'), 'utf8')
  ));

  await fs.rm(autoBackupDir, { force: true });
  await fs.mkdir(autoBackupDir);
  await fs.writeFile(path.join(dataDir, 'data.json'), '{ malformed json');
  const originalConsoleError = console.error;
  let malformedResponse;
  console.error = () => {};
  try {
    malformedResponse = await authorizedFetch('/api/data');
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(malformedResponse.status, 500);
  const malformedResult = await malformedResponse.json();
  assert.equal(malformedResult.success, false);
  assert.match(malformedResult.message, /JSON/i);
  await assert.rejects(initStorage(), (error) => {
    assert.match(error.message, /data\.json/i);
    assert.match(error.message, /JSON/i);
    return true;
  });

  const { preferences: ignoredPreferences, ...committedCollection } = committedData;
  assert.ok(ignoredPreferences);
  await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(committedCollection));

  const blockedSuffix = '9999999999999-blocked-recovery';
  const blockedRollback = path.join(
    dataDir,
    `.collection-save-rollback-${blockedSuffix}`
  );
  await fs.mkdir(blockedRollback);
  await fs.writeFile(path.join(blockedRollback, 'transaction.json'), JSON.stringify({
    version: 1,
    state: 'prepared',
    items: [
      { name: 'data.json', hadExisting: true },
      { name: 'preferences.json', hadExisting: true }
    ]
  }));
  await fs.rm(path.join(dataDir, 'data.json'));

  await assert.rejects(initStorage(), /storage recovery must complete|missing both/i);

  let blockedMediaRead;
  let blockedSave;
  console.error = () => {};
  try {
    blockedMediaRead = await authorizedFetch(`/api/images/${imagePath}`);
    blockedSave = await postJson('/api/data', {
      data: originalData,
      expectedRevision: 'cannot-be-read-during-recovery'
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(blockedMediaRead.status, 503);
  assert.match((await blockedMediaRead.json()).message, /storage recovery must complete/i);
  assert.equal(blockedSave.status, 503);
  assert.equal(await fs.stat(path.join(dataDir, 'data.json')).catch(() => null), null);

  await fs.writeFile(
    path.join(blockedRollback, 'data.json'),
    JSON.stringify(committedCollection)
  );
  const recoveredResponse = await authorizedFetch('/api/data');
  assert.equal(recoveredResponse.status, 200);
  const recovered = await recoveredResponse.json();
  assert.equal(recovered.data.pens[0].id, 'route-pen-warning');
  assert.equal(await fs.stat(blockedRollback).catch(() => null), null);

  if (process.platform !== 'win32') {
    const preferencesPath = path.join(dataDir, 'preferences.json');
    const savedPreferencesPath = path.join(dataDir, 'preferences.saved.json');
    const outsidePreferencesPath = path.join(dataDir, 'outside-preferences.json');
    await fs.writeFile(outsidePreferencesPath, await fs.readFile(preferencesPath));
    await fs.rename(preferencesPath, savedPreferencesPath);
    await fs.symlink(outsidePreferencesPath, preferencesPath);
    try {
      await assert.rejects(initStorage(), /regular file|symbolic link/i);
      assert.deepEqual(
        await fs.readFile(outsidePreferencesPath),
        await fs.readFile(savedPreferencesPath)
      );
    } finally {
      await fs.unlink(preferencesPath);
      await fs.rename(savedPreferencesPath, preferencesPath);
    }
  }
  await initStorage();
});
