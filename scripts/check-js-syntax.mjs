#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const sourceRoots = ['app', 'lib', 'server', 'scripts', 'tests'];
const excludedPaths = new Set([
  path.normalize('app/assets/heic/libheif-bundle.js')
]);

function collectJavaScriptFiles(relativeDir, files = []) {
  const absoluteDir = path.join(rootDir, relativeDir);
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(relativePath, files);
    } else if (
      (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))
      && !excludedPaths.has(path.normalize(relativePath))
    ) {
      files.push(relativePath);
    }
  }
  return files;
}

const files = sourceRoots
  .flatMap((relativeDir) => collectJavaScriptFiles(relativeDir))
  .sort((left, right) => left.localeCompare(right));

for (const relativePath of files) {
  const result = spawnSync(process.execPath, ['--check', relativePath], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  if (result.error) {
    console.error(
      `Could not run JavaScript syntax check for ${relativePath}: ${result.error.message}`
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    console.error(`JavaScript syntax check failed: ${relativePath}`);
    process.exit(result.status || 1);
  }
}

console.log(`JavaScript syntax check passed: ${files.length} first-party files.`);
