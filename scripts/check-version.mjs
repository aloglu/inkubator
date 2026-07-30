#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { checkVersionConsistency } = require('../lib/version-consistency');

try {
  const result = checkVersionConsistency(process.cwd(), process.argv[2] || '');
  if (result.mismatches.length) {
    console.error(`Version consistency check failed. Expected ${result.expected}:`);
    result.mismatches.forEach((entry) => {
      console.error(`- ${entry.label}: ${entry.value}`);
    });
    console.error(`Run "npm run sync-version -- ${result.expected}" and review the resulting changes.`);
    process.exitCode = 1;
  } else {
    console.log(`Version consistency check passed: ${result.expected}`);
    result.entries.forEach((entry) => {
      console.log(`- ${entry.label}`);
    });
  }
} catch (error) {
  console.error(`Version consistency check failed: ${error.message}`);
  process.exitCode = 1;
}
