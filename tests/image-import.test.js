const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getSourceExtension,
  isHeicBuffer,
  isHeicSource,
  prepareImageInputForSharp
} = require('../lib/image-import');

test('getSourceExtension handles file paths and URLs', () => {
  assert.equal(getSourceExtension('C:\\photos\\sample.HEIC'), '.heic');
  assert.equal(getSourceExtension('https://example.com/a/b/photo.heif?download=1'), '.heif');
  assert.equal(getSourceExtension(''), '');
});

test('isHeicBuffer recognizes HEIC file brands', () => {
  const buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
    0x00, 0x00, 0x00, 0x00,
    0x68, 0x65, 0x69, 0x63,
    0x6d, 0x69, 0x66, 0x31
  ]);

  assert.equal(isHeicBuffer(buffer), true);
  assert.equal(isHeicBuffer(Buffer.from('not-heic')), false);
});

test('isHeicSource matches extensions, mime types, and buffers', () => {
  const heicBuffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
    0x00, 0x00, 0x00, 0x00,
    0x68, 0x65, 0x69, 0x63,
    0x6d, 0x69, 0x66, 0x31
  ]);

  assert.equal(isHeicSource({ sourcePath: 'image.heic' }), true);
  assert.equal(isHeicSource({ sourceUrl: 'https://example.com/image.heif' }), true);
  assert.equal(isHeicSource({ mimeType: 'image/heic; charset=binary' }), true);
  assert.equal(isHeicSource({ buffer: heicBuffer }), true);
  assert.equal(isHeicSource({ sourcePath: 'image.png' }), false);
});

test('prepareImageInputForSharp converts HEIC paths through the provided converter', async () => {
  const inputBuffer = Buffer.from('heic-buffer');
  let readPath = '';
  let converted = false;

  const result = await prepareImageInputForSharp({
    input: 'C:\\photos\\sample.heic',
    fs: {
      readFile: async (filePath) => {
        readPath = filePath;
        return inputBuffer;
      }
    },
    sourcePath: 'C:\\photos\\sample.heic',
    convertHeicBuffer: async (buffer) => {
      converted = true;
      assert.equal(buffer, inputBuffer);
      return Buffer.from('png-buffer');
    }
  });

  assert.equal(readPath, 'C:\\photos\\sample.heic');
  assert.equal(converted, true);
  assert.deepEqual(result, Buffer.from('png-buffer'));
});

test('prepareImageInputForSharp leaves non-HEIC inputs untouched', async () => {
  const pngBuffer = Buffer.from('png-buffer');
  let converted = false;

  const result = await prepareImageInputForSharp({
    input: pngBuffer,
    convertHeicBuffer: async () => {
      converted = true;
      return Buffer.from('converted');
    }
  });

  assert.equal(result, pngBuffer);
  assert.equal(converted, false);
});
