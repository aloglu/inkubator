const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('DEB and RPM bundles declare native-dialog runtime dependencies', () => {
  const configPath = path.resolve(__dirname, '..', 'src-tauri', 'tauri.conf.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const expected = ['xdg-desktop-portal-gtk', 'zenity'];

  assert.deepEqual(config.bundle.linux.deb.depends, expected);
  assert.deepEqual(config.bundle.linux.rpm.depends, expected);
  assert.doesNotMatch(JSON.stringify(config.bundle.linux), /libayatana-appindicator/);
});
