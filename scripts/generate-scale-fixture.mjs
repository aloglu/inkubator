#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeAppData } = require('../lib/data-schema');

const outputRoot = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'inkubator-scale-fixture'));
const imageTotal = Number(process.argv[3] || 1000);
const allowedRoot = `${path.resolve(os.tmpdir())}${path.sep}`;

if (!outputRoot.startsWith(allowedRoot)) {
  throw new Error(`Scale fixtures must be written below ${path.resolve(os.tmpdir())}.`);
}
if (imageTotal !== 1000) {
  throw new Error('The current fixture shape is defined for exactly 1,000 images.');
}

const imagesRoot = path.join(outputRoot, 'images');
const thumbsRoot = path.join(imagesRoot, '.thumbs');
const basesRoot = path.join(outputRoot, '.fixture-bases');
const imageJobs = [];

function pad(value, width = 4) {
  return String(value).padStart(width, '0');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`));
    });
  });
}

async function mapConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function imageEntry(relativePath, index, primary) {
  return {
    id: `scale-image-${pad(index, 5)}`,
    path: relativePath,
    rotation: index % 17 === 0 ? 90 : 0,
    primary
  };
}

function queueImage(relativePath, index, kind) {
  imageJobs.push({ relativePath, index, kind });
}

const pens = [];
const inks = [];
const swatches = [];
let imageIndex = 0;

for (let index = 0; index < 240; index += 1) {
  const imageCount = index < 80 ? 1 : index < 160 ? 3 : 6;
  const primaryIndex = index % imageCount;
  const images = [];
  for (let galleryIndex = 0; galleryIndex < imageCount; galleryIndex += 1) {
    imageIndex += 1;
    const relativePath = `pens/pen-${pad(index + 1)}-${pad(galleryIndex + 1, 2)}.webp`;
    images.push(imageEntry(relativePath, imageIndex, galleryIndex === primaryIndex));
    queueImage(relativePath, imageIndex, 'pen');
  }
  const primary = images[primaryIndex];
  pens.push({
    id: `scale-pen-${pad(index + 1)}`,
    brand: `Scale Brand ${String(index % 12 + 1).padStart(2, '0')}`,
    model: `Pen ${pad(index + 1)}`,
    nib: ['EF', 'F', 'M', 'B'][index % 4],
    nib_material: index % 4 === 0 ? 'Gold' : 'Steel',
    material: ['Resin', 'Metal', 'Ebonite'][index % 3],
    filling_system: ['Cartridge, Converter', 'Piston', 'Vacuum'][index % 3],
    color: ['Green', 'Blue', 'Red', 'Black'][index % 4],
    hex_colors: ['#274c3f', '#b6a56b'],
    price: String(50 + index * 3),
    notes: 'Deterministic synthetic scale-test record.',
    image: primary.path,
    image_rotation: primary.rotation,
    images
  });
}

for (let index = 0; index < 100; index += 1) {
  inks.push({
    id: `scale-ink-${pad(index + 1)}`,
    name: `Ink ${pad(index + 1)}`,
    brand: `Scale Ink Brand ${String(index % 10 + 1).padStart(2, '0')}`,
    type: 'Bottle',
    volume_ml: '50',
    amount: '1',
    price: String(12 + index),
    color_base: `hsl(${index * 37 % 360} 58% 42%)`,
    color_accent: `hsl(${(index * 37 + 24) % 360} 68% 57%)`,
    shading: index % 2 ? 'Medium' : 'High',
    sheen: index % 5 === 0 ? 'High' : 'None',
    shimmer: 'None',
    flow: 'Average',
    lubrication: 'Medium'
  });

  const images = [];
  for (let galleryIndex = 0; galleryIndex < 2; galleryIndex += 1) {
    imageIndex += 1;
    const relativePath = `swatches/swatch-${pad(index + 1)}-${pad(galleryIndex + 1, 2)}.webp`;
    images.push(imageEntry(relativePath, imageIndex, galleryIndex === index % 2));
    queueImage(relativePath, imageIndex, 'swatch');
  }
  const primary = images.find((entry) => entry.primary);
  swatches.push({
    id: `scale-swatch-${pad(index + 1)}`,
    ink_id: inks[index].id,
    image: primary.path,
    images,
    swatch_paper: index % 2 ? 'Tomoe River' : 'Rhodia',
    swatch_nib: ['F', 'M', 'B'][index % 3],
    swatch_date: '2026-07-02',
    swatch_lighting: 'Daylight',
    swatch_notes: 'Deterministic synthetic scale-test swatch.',
    created_at: Date.UTC(2026, 0, 1) + index * 86400000
  });
}

if (imageIndex !== imageTotal) {
  throw new Error(`Fixture produced ${imageIndex} images instead of ${imageTotal}.`);
}

const currentlyInked = pens.slice(0, 80).map((pen, index) => ({
  id: `scale-current-${pad(index + 1)}`,
  pen_id: pen.id,
  ink_id: inks[index % inks.length].id,
  date_inked: Date.UTC(2026, 5, 1) + index * 3600000
}));

const activityLog = Array.from({ length: 500 }, (_, index) => ({
  id: `scale-activity-${pad(index + 1)}`,
  timestamp: Date.UTC(2026, 5, 1) + index * 60000,
  action: index % 3 === 0 ? 'created' : 'updated',
  category: index % 2 === 0 ? 'pen' : 'swatch',
  message: `Scale fixture activity ${index + 1}`,
  entity_id: index % 2 === 0 ? pens[index % pens.length].id : swatches[index % swatches.length].id,
  metadata: { fixture: true }
}));

const normalized = normalizeAppData({
  pens,
  inks,
  swatches,
  currently_inked: currentlyInked,
  activity_log: activityLog,
  preferences: {
    color_mode: 'light',
    showcase: { title: 'Inkubator Scale Fixture', color_mode: 'light' },
    backup: { auto_frequency: 'off', retention_count: 3, include_images: true }
  }
});
const { preferences, ...collection } = normalized;

await fs.rm(outputRoot, { recursive: true, force: true });
for (const folder of ['pens', 'inks', 'swatches']) {
  await fs.mkdir(path.join(imagesRoot, folder), { recursive: true });
  await fs.mkdir(path.join(thumbsRoot, folder), { recursive: true });
}
await fs.mkdir(basesRoot, { recursive: true });

const baseCount = 16;
await mapConcurrent(Array.from({ length: baseCount }, (_, index) => index), 4, async (index) => {
  const portrait = path.join(basesRoot, `portrait-${pad(index + 1, 2)}.webp`);
  const landscape = path.join(basesRoot, `landscape-${pad(index + 1, 2)}.webp`);
  await run('magick', ['-size', '900x1200', 'plasma:fractal', '-colorspace', 'sRGB', '-quality', '92', portrait]);
  await run('magick', ['-size', '1200x900', 'plasma:fractal', '-colorspace', 'sRGB', '-quality', '92', landscape]);
});

const startedAt = Date.now();
await mapConcurrent(imageJobs, Math.max(2, Math.min(8, os.cpus().length)), async (job) => {
  const isPen = job.kind === 'pen';
  const base = path.join(basesRoot, `${isPen ? 'portrait' : 'landscape'}-${pad(job.index % baseCount + 1, 2)}.webp`);
  const full = path.join(imagesRoot, job.relativePath);
  const thumb = path.join(thumbsRoot, job.relativePath);
  const hue = String(job.index * 17 % 200 + 75);
  const roll = isPen ? `+${job.index % 37}+${job.index % 53}` : `+${job.index % 61}+${job.index % 29}`;
  const overlay = isPen
    ? `roundrectangle 410,90 490,1110 34,34 rectangle 410,170 490,210`
    : `roundrectangle 70,70 1130,830 22,22 rectangle 110,120 1090,520`;
  await run('magick', [
    base,
    '-roll', roll,
    '-modulate', `96,${95 + job.index % 11},${hue}`,
    '-fill', isPen ? '#182a24cc' : '#f4f0e6bb',
    '-draw', overlay,
    '-quality', '88',
    '-write', full,
    '-resize', '480x480>',
    '-quality', '82',
    thumb
  ]);
});

await fs.writeFile(path.join(outputRoot, 'data.json'), `${JSON.stringify(collection, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, 'preferences.json'), `${JSON.stringify(preferences, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, 'fixture-summary.json'), `${JSON.stringify({
  image_count: imageIndex,
  pen_count: pens.length,
  ink_count: inks.length,
  swatch_count: swatches.length,
  activity_count: activityLog.length,
  generated_at: new Date().toISOString(),
  generation_ms: Date.now() - startedAt
}, null, 2)}\n`);
await fs.rm(basesRoot, { recursive: true, force: true });

console.log(JSON.stringify({ outputRoot, images: imageIndex, generationMs: Date.now() - startedAt }));
