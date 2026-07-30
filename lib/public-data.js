const PUBLIC_RECENT_ACTIVITY_LIMIT = 5;

const PUBLIC_ACTIVITY_ACTIONS = new Set([
  'created',
  'updated',
  'deleted',
  'inked',
  'cleaned',
  'reinked'
]);
const PUBLIC_ACTIVITY_CATEGORIES = new Set(['pen', 'ink', 'swatch', 'system']);
const PUBLIC_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function cloneRecord(value) {
    const record = objectOrEmpty(value);
    return JSON.parse(JSON.stringify(record));
}

function publicManagedImagePath(value, section) {
  let normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return '';
  normalized = normalized.replace(/^images\//, '').replace(/^\/+/, '');
  if (
    !normalized
    || normalized.includes('\\')
    || /[?#\u0000-\u001f]/.test(normalized)
  ) {
    return '';
  }

  const parts = normalized.split('/');
  if (
    parts.length < 2
    || parts[0] !== section
    || parts.some((part) => !part || part === '.' || part === '..')
  ) {
    return '';
  }
  const filename = parts[parts.length - 1];
  const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  return PUBLIC_IMAGE_EXTENSIONS.has(extension) ? normalized : '';
}

function publicImageEntries(value, section) {
  const entries = [];
  const byPath = new Map();
  for (const entry of arrayOrEmpty(value)) {
    const input = typeof entry === 'string' ? { path: entry } : objectOrEmpty(entry);
    const imagePath = publicManagedImagePath(input.path || input.image || input.url, section);
    if (!imagePath) continue;
    const existing = byPath.get(imagePath);
    if (existing) {
      if (input.primary === true) existing.primary = true;
      continue;
    }
    const projected = {
      id: typeof input.id === 'string' ? input.id : '',
      path: imagePath,
      rotation: typeof input.rotation === 'number' && Number.isFinite(input.rotation)
        ? input.rotation
        : 0,
      primary: input.primary === true
    };
    entries.push(projected);
    byPath.set(imagePath, projected);
  }

  if (entries.length > 0) {
    const primaryIndex = entries.findIndex((entry) => entry.primary);
    const normalizedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
    entries.forEach((entry, index) => {
      entry.primary = index === normalizedPrimaryIndex;
    });
    if (normalizedPrimaryIndex > 0) {
      entries.unshift(entries.splice(normalizedPrimaryIndex, 1)[0]);
    }
  }
  return entries;
}

function sanitizePublicRecordMedia(record, section) {
  const projected = record;
  const images = publicImageEntries(projected.images, section);
  const legacyImage = publicManagedImagePath(
    projected.image || projected.image_url || projected.url,
    section
  );
  const primary = images.find((entry) => entry.primary) || images[0] || null;

  projected.images = images;
  projected.image = primary ? primary.path : legacyImage;
  projected.image_rotation = primary
    ? primary.rotation
    : (typeof projected.image_rotation === 'number' && Number.isFinite(projected.image_rotation)
      ? projected.image_rotation
      : 0);
  delete projected.image_url;
  delete projected.url;
  return projected;
}

function preferenceBoolean(value, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function safeEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function publicShowcasePreferences(preferences) {
  const showcase = objectOrEmpty(preferences.showcase);
  const sort = objectOrEmpty(showcase.default_sort);
  const title = typeof showcase.title === 'string' ? showcase.title.trim() : '';

  return {
    title: title || 'Inkubator',
    color_mode: safeEnum(showcase.color_mode, new Set(['light', 'dark', 'auto']), 'auto'),
    show_prices: preferenceBoolean(showcase.show_prices),
    show_pens: preferenceBoolean(showcase.show_pens),
    show_inks: preferenceBoolean(showcase.show_inks),
    show_swatches: preferenceBoolean(showcase.show_swatches),
    show_activity_filters: preferenceBoolean(showcase.show_activity_filters),
    default_sort: {
      pens: safeEnum(
        sort.pens,
        new Set(['newest', 'oldest', 'brand-asc', 'brand-desc', 'model-asc', 'model-desc']),
        'newest'
      ),
      inks: safeEnum(
        sort.inks,
        new Set(['newest', 'oldest', 'brand-asc', 'brand-desc', 'name-asc', 'name-desc']),
        'newest'
      ),
      swatches: safeEnum(
        sort.swatches,
        new Set(['newest', 'oldest', 'brand-asc', 'brand-desc', 'name-asc', 'name-desc']),
        'newest'
      )
    },
    show_insights: preferenceBoolean(showcase.show_insights),
    show_charts: preferenceBoolean(showcase.show_charts)
  };
}

function publicPreferences(preferences) {
  const input = objectOrEmpty(preferences);
  const showcase = publicShowcasePreferences(input);
  const defaults = objectOrEmpty(input.defaults);
  const publicDefaults = {
    date_format: safeEnum(defaults.date_format, new Set(['system', 'us', 'eu', 'iso']), 'system')
  };

  if (showcase.show_prices) {
    publicDefaults.currency = safeEnum(
      defaults.currency,
      new Set(['usd', 'eur', 'gbp', 'jpy', 'try']),
      'usd'
    ).toUpperCase();
  }

  return {
    show_activity_log: preferenceBoolean(input.show_activity_log),
    show_recent_activity: preferenceBoolean(input.show_recent_activity),
    activity_log_verbosity: safeEnum(
      input.activity_log_verbosity,
      new Set(['minimal', 'normal', 'detailed']),
      'normal'
    ),
    defaults: publicDefaults,
    showcase
  };
}

function projectCollectionRecords(records, include, showPrices, section) {
  if (!include) return [];
  return arrayOrEmpty(records).map((record) => {
    const projected = sanitizePublicRecordMedia(cloneRecord(record), section);
    if (!showPrices) delete projected.price;
    return projected;
  });
}

function recordIdSet(records) {
  return new Set(
    arrayOrEmpty(records)
      .map((record) => String(objectOrEmpty(record).id || ''))
      .filter(Boolean)
  );
}

function relevantCurrentInkLinks(records, penIds, inkIds) {
  return arrayOrEmpty(records)
    .map((record, index) => {
      const input = objectOrEmpty(record);
      const penId = String(input.pen_id || '');
      const inkId = String(input.ink_id || '');
      if (!penIds.has(penId) || !inkIds.has(inkId)) return null;
      const projected = {
        id: `public_inked_${index + 1}`,
        pen_id: penId,
        ink_id: inkId
      };
      if (typeof input.date_inked === 'number' && Number.isFinite(input.date_inked)) {
        projected.date_inked = input.date_inked;
      }
      return projected;
    })
    .filter(Boolean);
}

function sanitizePublicActivity(entries, visibility, entityIds) {
  if (!visibility.showActivityLog && !visibility.showRecentActivity) return [];

  const sanitized = [];
  for (const rawEntry of arrayOrEmpty(entries)) {
    const entry = objectOrEmpty(rawEntry);
    const rawCategory = String(entry.category || '').trim().toLowerCase();
    if (rawCategory === 'pen' && !visibility.showPens) continue;
    if (rawCategory === 'ink' && !visibility.showInks) continue;
    if (rawCategory === 'swatch' && !visibility.showSwatches) continue;

    const category = PUBLIC_ACTIVITY_CATEGORIES.has(rawCategory) ? rawCategory : 'system';
    const rawAction = String(entry.action || '').trim().toLowerCase();
    const action = PUBLIC_ACTIVITY_ACTIONS.has(rawAction) ? rawAction : 'updated';
    if (
      category === 'pen'
      && ['inked', 'reinked', 'cleaned'].includes(action)
      && !visibility.showPenInkRelationships
    ) {
      continue;
    }
    const projected = {
      id: `public_activity_${sanitized.length + 1}`,
      timestamp: typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
        ? entry.timestamp
        : 0,
      action,
      category,
      message: `${category}: ${action}`,
      entity_id: '',
      metadata: {}
    };

    const candidateEntityId = String(entry.entity_id || '');
    if (candidateEntityId && entityIds[category]?.has(candidateEntityId)) {
      projected.entity_id = candidateEntityId;
    }
    sanitized.push(projected);
  }

  sanitized.sort((left, right) => right.timestamp - left.timestamp);
  return visibility.showActivityLog
    ? sanitized
    : sanitized.slice(0, PUBLIC_RECENT_ACTIVITY_LIMIT);
}

function projectPublicData(input) {
  const source = objectOrEmpty(input);
  const preferences = publicPreferences(source.preferences);
  const showcase = preferences.showcase;
  if (!showcase.show_inks) showcase.show_swatches = false;

  const pens = projectCollectionRecords(source.pens, showcase.show_pens, showcase.show_prices, 'pens');
  const inks = projectCollectionRecords(source.inks, showcase.show_inks, showcase.show_prices, 'inks');
  const sourceInkIds = recordIdSet(source.inks);
  const swatches = projectCollectionRecords(
    source.swatches,
    showcase.show_swatches,
    showcase.show_prices,
    'swatches'
  ).filter((swatch) => sourceInkIds.has(String(objectOrEmpty(swatch).ink_id || '')));
  const penIds = recordIdSet(pens);
  const inkIds = recordIdSet(inks);
  const currentlyInked = showcase.show_pens
    ? relevantCurrentInkLinks(source.currently_inked, penIds, inkIds)
    : [];
  const activityLog = sanitizePublicActivity(
    source.activity_log,
    {
      showActivityLog: preferences.show_activity_log,
      showRecentActivity: preferences.show_recent_activity,
      showPens: showcase.show_pens,
      showInks: showcase.show_inks,
      showSwatches: showcase.show_swatches,
      showPenInkRelationships: showcase.show_inks
    },
    {
      pen: penIds,
      ink: showcase.show_inks ? inkIds : new Set(),
      swatch: recordIdSet(swatches)
    }
  );

  return {
    pens,
    inks,
    swatches,
    currently_inked: currentlyInked,
    activity_log: activityLog,
    preferences
  };
}

module.exports = {
  PUBLIC_RECENT_ACTIVITY_LIMIT,
  projectPublicData
};
