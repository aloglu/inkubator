const path = require('node:path');

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000
};

function backupPolicy(preferences = {}) {
  const input = preferences && typeof preferences.backup === 'object' ? preferences.backup : {};
  const frequency = ['off', 'daily', 'weekly', 'monthly'].includes(input.auto_frequency)
    ? input.auto_frequency
    : 'daily';
  const retentionRaw = Number(input.retention_count);
  return {
    frequency,
    retention: Number.isFinite(retentionRaw)
      ? Math.min(365, Math.max(1, Math.round(retentionRaw)))
      : 30,
    keepReplacedImages: !!input.keep_replaced_images
  };
}

function shouldCreateBackup({ frequency, lastBackupAt = null, now = Date.now(), force = false }) {
  if (force) return true;
  const windowMs = FREQUENCY_MS[frequency];
  if (!windowMs) return false;
  if (!Number.isFinite(lastBackupAt)) return true;
  return now - lastBackupAt >= windowMs;
}

async function isCompleteBackupDirectory({ fs, folder }) {
  for (const name of ['data.json', 'preferences.json', 'manifest.json']) {
    const stat = await fs.stat(path.join(folder, name)).catch(() => null);
    if (!stat || !stat.isFile()) return false;
  }
  return true;
}

async function completeBackupDirectories({ fs, root }) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const directories = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const target = path.join(root, entry.name);
    if (!(await isCompleteBackupDirectory({ fs, folder: target }))) continue;
    const stat = await fs.stat(target);
    directories.push({ target, modified: stat.mtimeMs });
  }
  directories.sort((left, right) => right.modified - left.modified);
  return directories;
}

async function pruneBackupDirectories({ fs, root, retention }) {
  const directories = await completeBackupDirectories({ fs, root });
  const removed = [];
  for (const entry of directories.slice(Math.max(1, retention))) {
    await fs.rm(entry.target, { recursive: true, force: true });
    removed.push(entry.target);
  }
  return removed;
}

module.exports = {
  backupPolicy,
  completeBackupDirectories,
  isCompleteBackupDirectory,
  pruneBackupDirectories,
  shouldCreateBackup
};
