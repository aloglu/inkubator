#!/usr/bin/env node

import fs from 'node:fs/promises';

const endpoint = process.argv[2];
const backupPath = process.argv[3];

if (!endpoint || !backupPath) {
  throw new Error('Usage: node scripts/measure-scale-import.mjs <endpoint> <backup.zip>');
}

const zip = await fs.readFile(backupPath);
const startedAt = performance.now();
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from('admin:test').toString('base64')}`,
    'Content-Type': 'application/zip',
    'X-Inkubator-Auto-Validate': '1'
  },
  body: zip
});
const responseBody = await response.text();
console.log(JSON.stringify({
  status: response.status,
  requestBytes: zip.length,
  durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
  response: responseBody.slice(0, 500)
}));
