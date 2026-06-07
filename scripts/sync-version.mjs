import fs from 'node:fs';
import path from 'node:path';

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: node scripts/sync-version.mjs <semver>');
  process.exit(1);
}

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`
  );
}

const packageJson = readJson('package.json');
packageJson.version = version;
writeJson('package.json', packageJson);

if (fs.existsSync(path.join(root, 'package-lock.json'))) {
  const packageLock = readJson('package-lock.json');
  packageLock.version = version;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = version;
  }
  writeJson('package-lock.json', packageLock);
}

const cargoTomlPath = path.join(root, 'src-tauri/Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(
  /^version = ".*"$/m,
  `version = "${version}"`
);
fs.writeFileSync(cargoTomlPath, cargoToml);

const cargoLockPath = path.join(root, 'src-tauri/Cargo.lock');
if (fs.existsSync(cargoLockPath)) {
  let cargoLock = fs.readFileSync(cargoLockPath, 'utf8');
  cargoLock = cargoLock.replace(
    /(name = "inkubator"\nversion = )".*"/,
    `$1"${version}"`
  );
  fs.writeFileSync(cargoLockPath, cargoLock);
}

const tauriConfig = readJson('src-tauri/tauri.conf.json');
tauriConfig.version = version;
writeJson('src-tauri/tauri.conf.json', tauriConfig);

const pkgbuildPath = path.join(root, 'packaging/arch/PKGBUILD');
if (fs.existsSync(pkgbuildPath)) {
  let pkgbuild = fs.readFileSync(pkgbuildPath, 'utf8');
  pkgbuild = pkgbuild
    .replace(/^pkgver=.*$/m, `pkgver=${version}`)
    .replace(/^pkgrel=.*$/m, 'pkgrel=1');
  fs.writeFileSync(pkgbuildPath, pkgbuild);
}
