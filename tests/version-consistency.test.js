const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  checkVersionConsistency
} = require('../lib/version-consistency');

async function writeFixture(rootDir, version = '1.2.3') {
  await fs.mkdir(path.join(rootDir, 'src-tauri'), { recursive: true });
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
}

test('repository release metadata is internally consistent', () => {
  const rootDir = path.resolve(__dirname, '..');
  const result = checkVersionConsistency(rootDir);
  assert.equal(result.entries.length, 6);
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
  assert.equal(expectedMismatch.mismatches.length, 6);
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

test('version synchronization leaves the published Arch recipe unchanged', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkubator-version-sync-'));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  await writeFixture(rootDir);

  const packagingDir = path.join(rootDir, 'packaging', 'arch');
  const pkgbuildPath = path.join(packagingDir, 'PKGBUILD');
  const publishedRecipe = [
    'pkgname=inkubator',
    'pkgver=1.1.0',
    'pkgrel=1',
    "sha256sums=('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')",
    ''
  ].join('\n');
  await fs.mkdir(packagingDir, { recursive: true });
  await fs.writeFile(pkgbuildPath, publishedRecipe);

  execFileSync(
    process.execPath,
    [path.resolve(__dirname, '..', 'scripts', 'sync-version.mjs'), '2.0.0'],
    { cwd: rootDir }
  );

  assert.equal(await fs.readFile(pkgbuildPath, 'utf8'), publishedRecipe);
  assert.deepEqual(checkVersionConsistency(rootDir, '2.0.0').mismatches, []);
});
