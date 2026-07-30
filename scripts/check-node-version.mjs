#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

const expected = fs.readFileSync('.nvmrc', 'utf8').trim().replace(/^v/i, '');
const actual = process.versions.node;

if (actual !== expected) {
  console.error(`Node.js ${expected} is required for verification, but ${actual} is active.`);
  console.error(`Switch Node versions first, or run: mise x node@${expected} -- npm run verify`);
  process.exitCode = 1;
} else {
  console.log(`Node.js version check passed: ${actual}`);
}
