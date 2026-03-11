function normalizeVersionForCompare(rawVersion) {
  const cleaned = String(rawVersion || '')
    .trim()
    .replace(/^v/i, '')
    .split('+')[0]
    .split('-')[0];
  const parts = cleaned.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) return null;
  return parts;
}

function compareVersions(currentVersion, latestVersion) {
  const current = normalizeVersionForCompare(currentVersion);
  const latest = normalizeVersionForCompare(latestVersion);
  if (!current || !latest) return 0;
  const maxLen = Math.max(current.length, latest.length);
  for (let i = 0; i < maxLen; i += 1) {
    const a = current[i] || 0;
    const b = latest[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function resolveReleaseVersion(release) {
  const tag = String(release?.tag_name || '').trim();
  if (tag) return tag.replace(/^v/i, '');
  const name = String(release?.name || '').trim();
  if (name) return name.replace(/^v/i, '');
  return '';
}

function getReleaseVersionState(currentVersion, latestVersion, latestTag = '', currentTag = '') {
  const latestVersionText = String(latestVersion || '').trim();
  if (latestVersionText) {
    const relation = compareVersions(currentVersion, latestVersionText);
    if (relation < 0) return 'update_available';
    if (relation > 0) return 'ahead_of_latest';
    return 'up_to_date';
  }

  const latestTagText = String(latestTag || '').trim();
  const currentTagText = String(currentTag || '').trim();
  if (latestTagText) {
    return latestTagText === currentTagText ? 'up_to_date' : 'update_available';
  }

  return 'unknown';
}

module.exports = {
  normalizeVersionForCompare,
  compareVersions,
  resolveReleaseVersion,
  getReleaseVersionState
};
