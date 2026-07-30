const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

test('Docker replaced-image disposal follows the saved retention preference', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-docker-retention-'));
  process.env.INKUBATOR_DATA_DIR = dataDir;
  process.env.INKUBATOR_ADMIN_USER = 'retention-admin';
  process.env.INKUBATOR_ADMIN_PASSWORD = 'retention-password';

  const {
    initStorage,
    saveRemoteImage,
    server,
    uniqueAvailableFilename,
    writeImageWithThumbnail
  } = require('../server/docker-server');
  await initStorage();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const authorization = `Basic ${Buffer.from('retention-admin:retention-password').toString('base64')}`;

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

  const initialResponse = await authorizedFetch('/api/data');
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  assert.equal(initial.data.preferences.backup.keep_replaced_images, false);

  const validWebp = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#245c48' }
  }).webp().toBuffer();
  const validPng = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#245c48' }
  }).png().toBuffer();
  const directoryLinkType = process.platform === 'win32' ? 'junction' : 'dir';
  const symlinkedInkSection = path.join(dataDir, 'images', 'inks');
  const outsideInkSection = path.join(dataDir, 'outside-ink-section');
  let symlinkedSaveResponse;
  let outsideInkEntries;
  await fs.mkdir(outsideInkSection);
  await fs.rm(symlinkedInkSection, { recursive: true });
  await fs.symlink(outsideInkSection, symlinkedInkSection, directoryLinkType);
  try {
    symlinkedSaveResponse = await postJson('/api/save-image-bytes', {
      imageType: 'ink',
      metadata: { brand: 'Unsafe', model: 'Linked Parent' },
      bytesBase64: validWebp.toString('base64')
    });
    outsideInkEntries = await fs.readdir(outsideInkSection);
  } finally {
    await fs.unlink(symlinkedInkSection);
    await fs.mkdir(symlinkedInkSection);
  }
  assert.equal(symlinkedSaveResponse.status, 400);
  assert.deepEqual(outsideInkEntries, []);

  const longMetadataSave = await postJson('/api/save-image-bytes', {
    imageType: 'pen',
    metadata: {
      brand: 'brand'.repeat(100),
      model: 'model'.repeat(100),
      nib: 'nib'.repeat(100),
      color: 'color'.repeat(100)
    },
    bytesBase64: validWebp.toString('base64')
  });
  assert.equal(longMetadataSave.status, 200);
  const longMetadataPath = await longMetadataSave.json();
  assert.ok(Buffer.byteLength(path.basename(longMetadataPath)) <= 255);
  assert.match(longMetadataPath, /-[0-9a-f]{10}-1\.webp$/);
  assert.equal(
    (await postJson('/api/delete-image', { relativePath: longMetadataPath })).status,
    200
  );

  if (process.platform !== 'win32') {
    const outsideThumbnail = path.join(dataDir, 'outside-thumbnail.webp');
    const linkedThumbnail = path.join(
      dataDir,
      'images',
      '.thumbs',
      'inks',
      'thumbnail-link.webp'
    );
    await fs.writeFile(outsideThumbnail, 'outside-thumbnail');
    await fs.symlink(outsideThumbnail, linkedThumbnail, 'file');
    const linkedThumbnailSave = await postJson('/api/save-image-bytes', {
      imageType: 'ink',
      metadata: { brand: 'Thumbnail', model: 'Link' },
      bytesBase64: validWebp.toString('base64'),
      thumbnailBase64: validWebp.toString('base64')
    });
    assert.equal(linkedThumbnailSave.status, 200);
    const linkedThumbnailImage = await linkedThumbnailSave.json();
    assert.equal(linkedThumbnailImage, 'inks/thumbnail-link-2.webp');
    assert.equal(await fs.readFile(outsideThumbnail, 'utf8'), 'outside-thumbnail');
    assert.equal((await fs.lstat(linkedThumbnail)).isSymbolicLink(), true);
    assert.equal(
      (await postJson('/api/delete-image', { relativePath: linkedThumbnailImage })).status,
      200
    );
    await fs.unlink(linkedThumbnail);
    await fs.rm(outsideThumbnail);
  }

  const outsideNestedMedia = path.join(dataDir, 'outside-nested-media');
  const outsideNestedImage = path.join(outsideNestedMedia, 'escape.webp');
  const linkedNestedParent = path.join(dataDir, 'images', 'pens', 'linked-parent');
  await fs.mkdir(outsideNestedMedia);
  await fs.writeFile(outsideNestedImage, validWebp);
  await fs.symlink(outsideNestedMedia, linkedNestedParent, directoryLinkType);

  const linkedServeResponse = await authorizedFetch(
    '/api/images/pens/linked-parent/escape.webp'
  );
  assert.equal(linkedServeResponse.status, 400);
  assert.deepEqual(await fs.readFile(outsideNestedImage), validWebp);

  const linkedDeleteResponse = await postJson('/api/delete-image', {
    relativePath: 'pens/linked-parent/escape.webp'
  });
  assert.equal(linkedDeleteResponse.status, 400);
  assert.deepEqual(await fs.readFile(outsideNestedImage), validWebp);

  const inksBeforeInvalidSave = (await fs.readdir(path.join(dataDir, 'images', 'inks'))).sort();
  const invalidImageSave = await postJson('/api/save-image-bytes', {
    imageType: 'ink',
    metadata: { brand: 'Invalid', model: 'Payload' },
    bytesBase64: Buffer.from('<script>alert(1)</script>').toString('base64')
  });
  assert.equal(invalidImageSave.status, 415);
  assert.deepEqual(
    (await fs.readdir(path.join(dataDir, 'images', 'inks'))).sort(),
    inksBeforeInvalidSave
  );

  const invalidThumbnailSave = await postJson('/api/save-image-bytes', {
    imageType: 'ink',
    metadata: { brand: 'Invalid', model: 'Thumbnail' },
    bytesBase64: validWebp.toString('base64'),
    thumbnailBase64: Buffer.from('<html>not an image</html>').toString('base64')
  });
  assert.equal(invalidThumbnailSave.status, 415);
  assert.deepEqual(
    (await fs.readdir(path.join(dataDir, 'images', 'inks'))).sort(),
    inksBeforeInvalidSave
  );

  const swatchesBeforeInvalidRemote = (
    await fs.readdir(path.join(dataDir, 'images', 'swatches'))
  ).sort();
  await assert.rejects(
    saveRemoteImage(
      {
        url: 'https://example.test/forged.png',
        imageType: 'swatch',
        metadata: { brand: 'Invalid', model: 'Remote' }
      },
      async () => ({
        bytes: validWebp,
        mimeType: 'image/png',
        sourceUrl: 'https://example.test/forged.png',
        sourceHint: '/forged.png'
      })
    ),
    (error) => error.statusCode === 415 && /do not match/i.test(error.message)
  );
  assert.deepEqual(
    (await fs.readdir(path.join(dataDir, 'images', 'swatches'))).sort(),
    swatchesBeforeInvalidRemote
  );

  const collisionDir = path.join(dataDir, 'images', 'inks');
  await fs.writeFile(path.join(collisionDir, 'remote.png'), 'existing');
  assert.equal(await uniqueAvailableFilename(collisionDir, 'remote.png'), 'remote-2.png');
  const collisionImage = path.join(collisionDir, 'existing.webp');
  await fs.writeFile(collisionImage, 'do not replace');
  await assert.rejects(
    writeImageWithThumbnail(
      collisionImage,
      'inks/existing.webp',
      Buffer.from('replacement'),
      ''
    ),
    (error) => error && error.code === 'EEXIST'
  );
  assert.equal(await fs.readFile(collisionImage, 'utf8'), 'do not replace');

  const failedImagePath = path.join(dataDir, 'images', 'inks', 'failed-save.webp');
  const failedThumbnailPath = path.join(dataDir, 'images', '.thumbs', 'inks', 'failed-save.webp');
  await assert.rejects(
    writeImageWithThumbnail(
      failedImagePath,
      'inks/failed-save.webp',
      Buffer.from('full image'),
      Buffer.from('thumbnail').toString('base64'),
      async () => {
        await fs.writeFile(failedThumbnailPath, 'partial thumbnail');
        throw new Error('injected thumbnail failure');
      }
    ),
    /injected thumbnail failure/
  );
  await assert.rejects(fs.access(failedImagePath));
  await assert.rejects(fs.access(failedThumbnailPath));

  const durableImagePath = path.join(dataDir, 'images', 'inks', 'durable-save.webp');
  const syncEvents = [];
  const durableFileSystem = {
    writeFile: (...args) => fs.writeFile(...args),
    stat: (...args) => fs.stat(...args),
    open: async (target, flags) => {
      const handle = await fs.open(target, flags);
      return {
        sync: async () => {
          syncEvents.push(target);
          await handle.sync();
        },
        close: () => handle.close()
      };
    }
  };
  await writeImageWithThumbnail(
    durableImagePath,
    'inks/durable-save.webp',
    Buffer.from('durable image'),
    '',
    async () => {},
    durableFileSystem
  );
  assert.deepEqual(syncEvents, [durableImagePath, path.dirname(durableImagePath)]);
  await fs.rm(durableImagePath);

  const missingThumbnailPath = path.join(
    dataDir,
    'images',
    '.thumbs',
    'pens',
    'already-missing.webp'
  );
  await fs.writeFile(missingThumbnailPath, 'orphan thumbnail');
  const missingDeleteResponse = await postJson('/api/delete-image', {
    relativePath: 'pens/already-missing.webp'
  });
  assert.equal(missingDeleteResponse.status, 200);
  assert.deepEqual(await missingDeleteResponse.json(), {
    success: true,
    action: 'missing',
    relativePath: 'pens/already-missing.webp'
  });
  await assert.rejects(fs.access(missingThumbnailPath));

  const discardPath = path.join(dataDir, 'images', 'pens', 'discard.webp');
  const discardThumbnailPath = path.join(dataDir, 'images', '.thumbs', 'pens', 'discard.webp');
  await fs.writeFile(discardPath, 'discard image');
  await fs.writeFile(discardThumbnailPath, 'discard thumbnail');

  const discardedResponse = await postJson('/api/dispose-replaced-image', {
    relativePath: 'pens/discard.webp'
  });
  assert.equal(discardedResponse.status, 200);
  const discarded = await discardedResponse.json();
  assert.equal(discarded.action, 'deleted');
  await assert.rejects(fs.access(discardPath));
  await assert.rejects(fs.access(discardThumbnailPath));
  await assert.rejects(fs.access(path.join(dataDir, 'replaced-images', 'pens', 'discard.webp')));

  const retentionData = structuredClone(initial.data);
  retentionData.preferences.backup.keep_replaced_images = true;
  const retentionSaveResponse = await postJson('/api/data', {
    data: retentionData,
    expectedRevision: initial.revision
  });
  assert.equal(retentionSaveResponse.status, 200);
  assert.equal((await retentionSaveResponse.json()).success, true);

  const linkedArchiveResponse = await postJson('/api/dispose-replaced-image', {
    relativePath: 'pens/linked-parent/escape.webp'
  });
  assert.equal(linkedArchiveResponse.status, 400);
  assert.deepEqual(await fs.readFile(outsideNestedImage), validWebp);
  await assert.rejects(
    fs.access(path.join(dataDir, 'replaced-images', 'pens', 'linked-parent', 'escape.webp'))
  );
  await fs.unlink(linkedNestedParent);
  await fs.rm(outsideNestedMedia, { recursive: true });

  const pngImage = path.join(dataDir, 'images', 'pens', 'thumbnail-mime.png');
  const pngThumbnail = path.join(
    dataDir,
    'images',
    '.thumbs',
    'pens',
    'thumbnail-mime.png'
  );
  await fs.writeFile(pngImage, validPng);
  await fs.writeFile(pngThumbnail, validWebp);
  const pngThumbnailResponse = await authorizedFetch('/api/thumbs/pens/thumbnail-mime.png');
  assert.equal(pngThumbnailResponse.status, 200);
  assert.equal(pngThumbnailResponse.headers.get('content-type'), 'image/webp');
  assert.deepEqual(Buffer.from(await pngThumbnailResponse.arrayBuffer()), validWebp);
  await fs.rm(pngImage);
  await fs.rm(pngThumbnail);

  const archiveLinkRelative = 'pens/archive-link/escape.webp';
  const archiveLinkSource = path.join(dataDir, 'images', archiveLinkRelative);
  const outsideArchive = path.join(dataDir, 'outside-archive');
  const linkedArchiveParent = path.join(dataDir, 'replaced-images', 'pens', 'archive-link');
  await fs.mkdir(path.dirname(archiveLinkSource), { recursive: true });
  await fs.writeFile(archiveLinkSource, validWebp);
  await fs.mkdir(outsideArchive);
  await fs.symlink(outsideArchive, linkedArchiveParent, directoryLinkType);

  const unsafeArchiveResponse = await postJson('/api/dispose-replaced-image', {
    relativePath: archiveLinkRelative
  });
  assert.equal(unsafeArchiveResponse.status, 400);
  assert.deepEqual(await fs.readFile(archiveLinkSource), validWebp);
  assert.deepEqual(await fs.readdir(outsideArchive), []);
  await fs.unlink(linkedArchiveParent);
  await fs.rm(path.dirname(archiveLinkSource), { recursive: true });
  await fs.rmdir(outsideArchive);

  const archivePath = path.join(dataDir, 'images', 'pens', 'archive.webp');
  const archiveThumbnailPath = path.join(dataDir, 'images', '.thumbs', 'pens', 'archive.webp');
  await fs.writeFile(archivePath, 'archive image');
  await fs.writeFile(archiveThumbnailPath, 'archive thumbnail');

  const archivedResponse = await postJson('/api/dispose-replaced-image', {
    relativePath: 'pens/archive.webp'
  });
  assert.equal(archivedResponse.status, 200);
  const archived = await archivedResponse.json();
  assert.equal(archived.action, 'archived');
  assert.equal(archived.archivedRelativePath, 'pens/archive.webp');
  await assert.rejects(fs.access(archivePath));
  await assert.rejects(fs.access(archiveThumbnailPath));
  assert.equal(
    await fs.readFile(path.join(dataDir, 'replaced-images', 'pens', 'archive.webp'), 'utf8'),
    'archive image'
  );

  const referencedPaths = [
    'pens/direct.webp',
    'inks/string.webp',
    'swatches/path.webp',
    'pens/gallery-image.webp',
    'inks/gallery-url.webp',
    'swatches/legacy-ink.webp',
    'pens/shared.webp'
  ];
  await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify({
    pens: [
      { image: 'pens/direct.webp' },
      { images: [{ image: 'pens/gallery-image.webp' }] },
      { image: 'pens/shared.webp' }
    ],
    inks: [
      { images: ['inks/string.webp', { url: 'inks/gallery-url.webp' }] },
      { image: 'swatches/legacy-ink.webp' }
    ],
    swatches: [
      { images: [{ path: 'swatches/path.webp' }] },
      { image: 'images/pens/shared.webp' }
    ],
    currently_inked: [],
    activity_log: []
  }));

  for (const relativePath of referencedPaths) {
    const imagePath = path.join(dataDir, 'images', relativePath);
    const thumbnailPath = path.join(dataDir, 'images', '.thumbs', relativePath);
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
    await fs.writeFile(imagePath, `image:${relativePath}`);
    await fs.writeFile(thumbnailPath, `thumbnail:${relativePath}`);
  }

  for (const [index, relativePath] of referencedPaths.entries()) {
    const route = index % 2 === 0 ? '/api/delete-image' : '/api/dispose-replaced-image';
    const response = await postJson(route, { relativePath });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      action: 'referenced',
      relativePath
    });
    assert.equal(
      await fs.readFile(path.join(dataDir, 'images', relativePath), 'utf8'),
      `image:${relativePath}`
    );
    assert.equal(
      await fs.readFile(path.join(dataDir, 'images', '.thumbs', relativePath), 'utf8'),
      `thumbnail:${relativePath}`
    );
  }

  const activePath = path.join(dataDir, 'images', 'pens', 'payload.html');
  await fs.writeFile(activePath, '<script>document.cookie</script>');
  const blockedActiveMedia = await authorizedFetch('/api/images/pens/payload.html');
  assert.equal(blockedActiveMedia.status, 400);
  assert.equal((await blockedActiveMedia.json()).success, false);

  const nestedRelativePath = 'pens/nested/album/valid.webp';
  const nestedPath = path.join(dataDir, 'images', nestedRelativePath);
  await fs.mkdir(path.dirname(nestedPath), { recursive: true });
  await fs.writeFile(nestedPath, validWebp);
  const nestedResponse = await authorizedFetch(`/api/images/${nestedRelativePath}`);
  assert.equal(nestedResponse.status, 200);
  assert.deepEqual(Buffer.from(await nestedResponse.arrayBuffer()), validWebp);
});
