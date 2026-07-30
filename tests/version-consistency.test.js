const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  checkVersionConsistency
} = require('../lib/version-consistency');

async function writeFixture(rootDir, version = '1.2.3') {
  await fs.mkdir(path.join(rootDir, 'src-tauri'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'packaging', 'arch'), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, 'package.json'),
    JSON.stringify({ name: 'inkubator', version })
  );
  await fs.writeFile(
    path.join(rootDir, 'package-lock.json'),
    JSON.stringify({
      name: 'inkubator',
      version,
      packages: { '': { name: 'inkubator', version } }
    })
  );
  await fs.writeFile(
    path.join(rootDir, 'src-tauri', 'Cargo.toml'),
    `[package]\nname = "inkubator"\nversion = "${version}"\n\n[dependencies]\n`
  );
  await fs.writeFile(
    path.join(rootDir, 'src-tauri', 'Cargo.lock'),
    `version = 4\n\n[[package]]\nname = "inkubator"\nversion = "${version}"\n`
  );
  await fs.writeFile(
    path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
    JSON.stringify({ version })
  );
  await fs.writeFile(
    path.join(rootDir, 'packaging', 'arch', 'PKGBUILD'),
    `pkgname=inkubator\npkgver=${version}\npkgrel=1\n`
  );
}

test('repository release metadata is internally consistent', () => {
  const rootDir = path.resolve(__dirname, '..');
  const result = checkVersionConsistency(rootDir);
  assert.equal(result.entries.length, 7);
  assert.deepEqual(result.mismatches, []);
});

test('version checker reports changed and expected-version mismatches', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-version-check-'));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  await writeFixture(rootDir);

  assert.deepEqual(checkVersionConsistency(rootDir).mismatches, []);

  await fs.writeFile(
    path.join(rootDir, 'src-tauri', 'tauri.conf.json'),
    JSON.stringify({ version: '1.2.4' })
  );
  const mismatch = checkVersionConsistency(rootDir);
  assert.deepEqual(
    mismatch.mismatches.map((entry) => entry.label),
    ['src-tauri/tauri.conf.json']
  );

  const expectedMismatch = checkVersionConsistency(rootDir, 'v2.0.0');
  assert.equal(expectedMismatch.expected, '2.0.0');
  assert.equal(expectedMismatch.mismatches.length, 7);
});

test('version checker rejects missing release metadata', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-version-missing-'));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  await writeFixture(rootDir);
  await fs.writeFile(
    path.join(rootDir, 'src-tauri', 'Cargo.toml'),
    '[package]\nname = "inkubator"\n'
  );

  assert.throws(
    () => checkVersionConsistency(rootDir),
    /exactly one \[package\] version/
  );
});
