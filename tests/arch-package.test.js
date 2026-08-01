const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
