const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const pkgbuildPath = path.resolve(__dirname, '..', 'packaging', 'arch', 'PKGBUILD');

function exactlyOneMatch(source, pattern, label) {
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, `${label} must appear exactly once`);
  return matches[0][1];
}

test('Arch package recipe contains release-ready source metadata', () => {
  const source = fs.readFileSync(pkgbuildPath, 'utf8');
  const pkgver = exactlyOneMatch(source, /^pkgver=([^\s#]+)\s*$/gm, 'pkgver');
  const pkgrel = exactlyOneMatch(source, /^pkgrel=([^\s#]+)\s*$/gm, 'pkgrel');
  const sourceBlock = exactlyOneMatch(
    source,
    /^source=\(\s*\n([\s\S]*?)^\)\s*$/gm,
    'source'
  );
  const checksumBlock = exactlyOneMatch(
    source,
    /^sha256sums=\(\s*\n([\s\S]*?)^\)\s*$/gm,
    'sha256sums'
  );
  const sources = [...sourceBlock.matchAll(/^\s*["']([^"']+)["']\s*$/gm)];
  const checksums = [...checksumBlock.matchAll(/^\s*'([^']+)'\s*$/gm)];

  assert.match(pkgver, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
  assert.match(pkgrel, /^[1-9]\d*$/);
  assert.equal(checksums.length, sources.length);
  checksums.forEach(([, checksum]) => assert.match(checksum, /^[0-9a-f]{64}$/));
  assert.ok(
    sourceBlock.includes(
      '${pkgname}-${pkgver}.tar.gz::${url}/archive/refs/tags/v${pkgver}.tar.gz'
    ),
    'source must use the published GitHub tag matching pkgver'
  );
  assert.match(source, /^\s*'xdg-desktop-portal-gtk'\s*$/m);
  assert.match(source, /^\s*'zenity'\s*$/m);
  assert.doesNotMatch(source, /libayatana-appindicator/);
});

test('Node build requirements accept compatible Arch providers', () => {
  const source = fs.readFileSync(pkgbuildPath, 'utf8');
  const makedependsBlock = exactlyOneMatch(
    source,
    /^makedepends=\(\s*\n([\s\S]*?)^\)\s*$/gm,
    'makedepends'
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
  );
  const packageLock = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8')
  );
  const engine = packageJson.engines?.node || '';
  const minimumMajorMatch = engine.match(/^>=(\d+)$/);
  const nodeBuildDependencies = [
    ...makedependsBlock.matchAll(/^\s*'([^']*nodejs[^']*)'\s*$/gm)
  ].map(([, dependency]) => dependency);

  assert.ok(
    minimumMajorMatch,
    'Node compatibility must have a minimum version without an upper bound'
  );
  assert.equal(packageLock.packages?.['']?.engines?.node, engine);
  assert.deepEqual(
    nodeBuildDependencies,
    [`nodejs>=${minimumMajorMatch[1]}`]
  );
  assert.doesNotMatch(
    makedependsBlock,
    /^\s*'nodejs-lts-[^']+'\s*$/m,
    'Arch builds must not force a named Node LTS package'
  );
});
