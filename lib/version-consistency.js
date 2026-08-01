const fs = require('node:fs');
const path = require('node:path');

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function readJson(rootDir, relativePath) {
  const filePath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function requireVersion(value, label) {
  const version = String(value || '').trim();
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`${label} does not contain a valid semantic version.`);
  }
  return version;
}

function cargoPackageVersion(source) {
  const versions = [];
  let section = '';
  for (const line of String(source || '').split(/\r?\n/)) {
    const sectionMatch = line.trim().match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (section !== 'package') continue;
    const versionMatch = line.match(/^\s*version\s*=\s*"([^"]+)"\s*$/);
    if (versionMatch) versions.push(versionMatch[1]);
  }
  if (versions.length !== 1) {
    throw new Error('src-tauri/Cargo.toml must contain exactly one [package] version.');
  }
  return versions[0];
}

function cargoLockPackageVersion(source, packageName) {
  const matchingBlocks = String(source || '')
    .split(/(?=^\[\[package\]\]\s*$)/m)
    .filter((block) => new RegExp(`^name\\s*=\\s*"${packageName}"\\s*$`, 'm').test(block));
  if (matchingBlocks.length !== 1) {
    throw new Error(`src-tauri/Cargo.lock must contain exactly one ${packageName} package block.`);
  }
  const versions = [...matchingBlocks[0].matchAll(/^version\s*=\s*"([^"]+)"\s*$/gm)];
  if (versions.length !== 1) {
    throw new Error(`The ${packageName} Cargo.lock block must contain exactly one version.`);
  }
  return versions[0][1];
}

function normalizeExpectedVersion(rawVersion) {
  return requireVersion(String(rawVersion || '').trim().replace(/^v/i, ''), 'Expected version');
}

function readVersionEntries(rootDir) {
  const packageJson = readJson(rootDir, 'package.json');
  const packageLock = readJson(rootDir, 'package-lock.json');
  const cargoToml = readText(rootDir, 'src-tauri/Cargo.toml');
  const cargoLock = readText(rootDir, 'src-tauri/Cargo.lock');
  const tauriConfig = readJson(rootDir, 'src-tauri/tauri.conf.json');

  return [
    {
      label: 'package.json',
      value: requireVersion(packageJson.version, 'package.json#version')
    },
    {
      label: 'package-lock.json',
      value: requireVersion(packageLock.version, 'package-lock.json#version')
    },
    {
      label: 'package-lock.json root package',
      value: requireVersion(
        packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version,
        'package-lock.json#packages[""]#version'
      )
    },
    {
      label: 'src-tauri/Cargo.toml',
      value: requireVersion(cargoPackageVersion(cargoToml), 'src-tauri/Cargo.toml [package] version')
    },
    {
      label: 'src-tauri/Cargo.lock',
      value: requireVersion(
        cargoLockPackageVersion(cargoLock, 'inkubator'),
        'src-tauri/Cargo.lock inkubator version'
      )
    },
    {
      label: 'src-tauri/tauri.conf.json',
      value: requireVersion(tauriConfig.version, 'src-tauri/tauri.conf.json#version')
    }
  ];
}

function checkVersionConsistency(rootDir, expectedVersion = '') {
  const entries = readVersionEntries(rootDir);
  const expected = expectedVersion
    ? normalizeExpectedVersion(expectedVersion)
    : entries[0].value;
  return {
    expected,
    entries,
    mismatches: entries.filter((entry) => entry.value !== expected)
  };
}

module.exports = {
  cargoLockPackageVersion,
  cargoPackageVersion,
  checkVersionConsistency,
  normalizeExpectedVersion,
  readVersionEntries
};
