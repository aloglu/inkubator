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

async function pruneBackupDirectories({ fs, root, retention }) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const directories = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const target = path.join(root, entry.name);
    const stat = await fs.stat(target);
    directories.push({ target, modified: stat.mtimeMs });
  }
  directories.sort((left, right) => right.modified - left.modified);
  const removed = [];
  for (const entry of directories.slice(Math.max(1, retention))) {
    await fs.rm(entry.target, { recursive: true, force: true });
    removed.push(entry.target);
  }
  return removed;
}

module.exports = {
  backupPolicy,
  pruneBackupDirectories,
  shouldCreateBackup
};
