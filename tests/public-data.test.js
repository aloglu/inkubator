const test = require('node:test');
const assert = require('node:assert/strict');

const { collectReferencedImageRelativePaths } = require('../lib/critical-persistence');
const {
  PUBLIC_RECENT_ACTIVITY_LIMIT,
  projectPublicData
} = require('../lib/public-data');

function fixture(overrides = {}) {
  return {
    pens: [{
      id: 'pen-visible',
      brand: 'Visible Pen Brand',
      model: 'Visible Pen Model',
      price: '123',
      notes: 'Public pen notes',
      image: 'pens/visible.webp',
      images: [{ id: 'pen-image', path: 'pens/visible.webp', rotation: 0, primary: true }]
    }],
    inks: [
      {
        id: 'ink-linked',
        brand: 'Linked Ink Brand',
        name: 'Linked Ink Name',
        line: 'Linked Line',
        price: '45',
        volume_ml: '50',
        notes: 'Private technical ink notes',
        color_base: '#123456',
        color_accent: '#654321',
        hex_colors: ['#123456', '#654321'],
        image: 'inks/linked.webp'
      },
      {
        id: 'ink-hidden-only',
        brand: 'Hidden Ink Brand',
        name: 'Hidden Ink Name',
        price: '99',
        image: 'inks/hidden-only.webp'
      }
    ],
    swatches: [
      {
        id: 'swatch-visible',
        ink_id: 'ink-linked',
        image: 'swatches/visible.webp',
        images: [{ id: 'swatch-image', path: 'swatches/visible.webp', rotation: 0, primary: true }],
        price: '67',
        swatch_paper: 'Visible Paper',
        swatch_notes: 'Visible swatch notes'
      },
      {
        id: 'swatch-with-missing-ink',
        ink_id: 'missing-ink',
        image: 'swatches/missing-ink.webp'
      }
    ],
    currently_inked: [{
      id: 'private-link-id',
      pen_id: 'pen-visible',
      ink_id: 'ink-linked',
      date_inked: 1_700_000_000_000,
      private_note: 'must not be public'
    }],
    activity_log: [
      {
        id: 'private-activity-id',
        timestamp: 1_700_000_000_006,
        action: 'updated',
        category: 'pen',
        entity_id: 'pen-visible',
        message: 'Changed price to 123 for Visible Pen Model.',
        metadata: { price: '123', pen_display_name: 'Visible Pen Brand Visible Pen Model' }
      },
      {
        timestamp: 1_700_000_000_005,
        action: 'updated',
        category: 'ink',
        entity_id: 'ink-linked',
        message: 'Changed private ink notes.',
        metadata: { ink_amount: '10', secret: 'hidden' }
      },
      {
        timestamp: 1_700_000_000_004,
        action: 'created',
        category: 'swatch',
        entity_id: 'swatch-visible',
        message: 'Added swatch on Visible Paper.',
        metadata: { swatch_paper: 'Visible Paper' }
      },
      {
        timestamp: 1_700_000_000_003,
        action: 'custom secret action',
        category: 'custom secret category',
        entity_id: 'secret-entity',
        message: 'Secret system details.',
        metadata: { secret: true }
      }
    ],
    preferences: {
      _inkubator_storage_revision: 'private-storage-token',
      show_activity_log: true,
      show_recent_activity: true,
      activity_log_verbosity: 'detailed',
      open_cards_in_edit_mode: false,
      confirm_destructive_actions: false,
      activity_retention_days: 0,
      activity_log_filters: { deletes: false },
      activity_log_categories: { pen: false },
      defaults: {
        currency: 'EUR',
        date_format: 'iso',
        pen_nib: 'Private Default',
        ink_type: 'Private Default'
      },
      import_export: { conflict_behavior: 'overwrite' },
      backup: { auto_frequency: 'daily', retention_count: 100 },
      showcase: {
        title: 'Public Collection',
        color_mode: 'dark',
        show_prices: false,
        show_pens: true,
        show_inks: true,
        show_swatches: true,
        show_activity_filters: true,
        default_sort: {
          pens: 'brand-asc',
          inks: 'name-asc',
          swatches: 'oldest'
        },
        show_insights: true,
        show_charts: true
      }
    },
    private_top_level: 'must not be public',
    ...overrides
  };
}

test('public projection removes hidden prices and private manager settings without mutating source data', () => {
  const source = fixture();
  const before = structuredClone(source);

  const projected = projectPublicData(source);

  assert.deepEqual(source, before);
  assert.equal(projected.pens[0].price, undefined);
  assert.equal(projected.inks[0].price, undefined);
  assert.equal(projected.swatches[0].price, undefined);
  assert.equal(projected.pens[0].notes, 'Public pen notes');
  assert.equal(projected.inks[0].notes, 'Private technical ink notes');
  assert.deepEqual(projected.swatches.map((swatch) => swatch.id), ['swatch-visible']);
  assert.deepEqual(projected.currently_inked, [{
    id: 'public_inked_1',
    pen_id: 'pen-visible',
    ink_id: 'ink-linked',
    date_inked: 1_700_000_000_000
  }]);
  assert.equal(projected.private_top_level, undefined);
  assert.doesNotMatch(JSON.stringify(projected), /_inkubator_storage_revision|private-storage-token/);

  assert.equal(projected.activity_log[0].id, 'public_activity_1');
  assert.equal(projected.activity_log[0].message, 'pen: updated');
  assert.deepEqual(projected.activity_log[0].metadata, {});
  assert.equal(projected.activity_log[3].category, 'system');
  assert.equal(projected.activity_log[3].action, 'updated');
  assert.equal(projected.activity_log[3].entity_id, '');

  assert.deepEqual(projected.preferences, {
    show_activity_log: true,
    show_recent_activity: true,
    activity_log_verbosity: 'detailed',
    defaults: {
      date_format: 'iso'
    },
    showcase: {
      title: 'Public Collection',
      color_mode: 'dark',
      show_prices: false,
      show_pens: true,
      show_inks: true,
      show_swatches: true,
      show_activity_filters: true,
      default_sort: {
        pens: 'brand-asc',
        inks: 'name-asc',
        swatches: 'oldest'
      },
      show_insights: true,
      show_charts: true
    }
  });
});

test('hidden inks strictly omit dependent swatches, current links, relationship activity, and media', () => {
  const source = fixture();
  source.preferences.show_activity_log = false;
  source.preferences.show_recent_activity = true;
  source.preferences.showcase.show_inks = false;
  source.activity_log = [
    ...source.activity_log,
    {
      timestamp: 1_700_000_000_100,
      action: 'inked',
      category: 'pen',
      entity_id: 'pen-visible',
      message: 'Inked Visible Pen Model with Linked Ink Name.',
      metadata: { new_ink_name: 'Linked Ink Name' }
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      timestamp: 1_700_000_000_000 - index,
      action: 'updated',
      category: 'pen',
      entity_id: 'pen-visible',
      message: `Private pen message ${index}`,
      metadata: { secret: index }
    }))
  ].reverse();

  const projected = projectPublicData(source);

  assert.deepEqual(projected.inks, []);
  assert.deepEqual(projected.swatches, []);
  assert.deepEqual(projected.currently_inked, []);
  assert.equal(projected.preferences.showcase.show_swatches, false);
  assert.ok(projected.activity_log.every((entry) => entry.category !== 'ink'));
  assert.ok(projected.activity_log.every((entry) => entry.category !== 'swatch'));
  assert.ok(projected.activity_log.every((entry) => !['inked', 'reinked', 'cleaned'].includes(entry.action)));
  assert.equal(projected.activity_log.length, PUBLIC_RECENT_ACTIVITY_LIMIT);
  assert.ok(projected.activity_log.every((entry) => !entry.message.includes('Private')));
  assert.deepEqual(
    projected.activity_log.map((entry) => entry.timestamp),
    [...projected.activity_log.map((entry) => entry.timestamp)].sort((left, right) => right - left)
  );

  assert.deepEqual(collectReferencedImageRelativePaths(projected), ['pens/visible.webp']);
});

test('hidden collection sections and disabled activity are absent from public data', () => {
  const source = fixture();
  source.preferences.show_activity_log = false;
  source.preferences.show_recent_activity = false;
  source.preferences.showcase.show_pens = false;
  source.preferences.showcase.show_inks = false;
  source.preferences.showcase.show_swatches = false;

  const projected = projectPublicData(source);

  assert.deepEqual(projected.pens, []);
  assert.deepEqual(projected.inks, []);
  assert.deepEqual(projected.swatches, []);
  assert.deepEqual(projected.currently_inked, []);
  assert.deepEqual(projected.activity_log, []);
  assert.deepEqual(collectReferencedImageRelativePaths(projected), []);
});

test('public projection moves the primary image first while preserving remaining order', () => {
  const source = fixture();
  source.pens[0].image = 'pens/third.webp';
  source.pens[0].images = [
    { id: 'first', path: 'pens/first.webp', primary: false },
    { id: 'second', path: 'pens/second.webp', primary: false },
    { id: 'third', path: 'pens/third.webp', primary: true }
  ];

  const projected = projectPublicData(source);

  assert.deepEqual(projected.pens[0].images.map((entry) => entry.path), [
    'pens/third.webp',
    'pens/first.webp',
    'pens/second.webp'
  ]);
  assert.deepEqual(projected.pens[0].images.map((entry) => entry.primary), [true, false, false]);
  assert.equal(projected.pens[0].image, 'pens/third.webp');
});

test('public projection normalizes legacy gallery aliases and deduplicates managed paths', () => {
  const source = fixture();
  source.pens[0].image = '';
  source.pens[0].images = [
    'pens/string.webp',
    { id: 'legacy-image', image: 'pens/image.webp', rotation: 90 },
    { id: 'legacy-url', url: 'pens/url.webp', primary: true },
    { id: 'duplicate', path: 'pens/string.webp' },
    { url: 'https://tracker.test/private.webp' },
    { image: 'inks/wrong-section.webp' }
  ];
  source.pens.push({
    id: 'pen-direct-alias',
    image_url: 'images/pens/direct-alias.webp',
    images: []
  });

  const projected = projectPublicData(source);

  assert.deepEqual(projected.pens[0].images, [
    {
      id: 'legacy-url',
      path: 'pens/url.webp',
      rotation: 0,
      primary: true
    },
    {
      id: '',
      path: 'pens/string.webp',
      rotation: 0,
      primary: false
    },
    {
      id: 'legacy-image',
      path: 'pens/image.webp',
      rotation: 90,
      primary: false
    }
  ]);
  assert.equal(projected.pens[0].image, 'pens/url.webp');
  assert.equal(projected.pens[1].image, 'pens/direct-alias.webp');
  assert.deepEqual(projected.pens[1].images, []);
  assert.doesNotMatch(JSON.stringify(projected.pens), /tracker\.test|wrong-section/);
});

test('public projection strips external, cross-section, and non-raster media paths', () => {
  const source = fixture();
  source.pens[0].image = 'https://tracker.test/pen.webp';
  source.pens[0].image_url = 'https://tracker.test/alias.webp';
  source.pens[0].images = [
    { id: 'bad-external', path: 'https://tracker.test/gallery.webp', primary: true },
    { id: 'bad-section', path: 'inks/wrong.webp' },
    { id: 'bad-active', path: 'pens/payload.html' },
    { id: 'good', path: 'pens/safe.webp', rotation: 90 }
  ];
  source.inks[0].image = 'swatches/private-compatibility.webp';
  source.inks[0].images = [{ path: 'inks/payload.svg', primary: true }];
  source.swatches[0].image = 'file:///home/user/private.webp';
  source.swatches[0].images = [
    { id: 'good-swatch', path: 'images/swatches/safe.png', primary: true },
    { id: 'bad-data', path: 'data:image/png;base64,secret' }
  ];

  const projected = projectPublicData(source);
  const serialized = JSON.stringify(projected);

  assert.equal(projected.pens[0].image, 'pens/safe.webp');
  assert.deepEqual(projected.pens[0].images, [{
    id: 'good',
    path: 'pens/safe.webp',
    rotation: 90,
    primary: true
  }]);
  assert.equal(projected.inks[0].image, '');
  assert.deepEqual(projected.inks[0].images, []);
  assert.equal(projected.swatches[0].image, 'swatches/safe.png');
  assert.deepEqual(projected.swatches[0].images, [{
    id: 'good-swatch',
    path: 'swatches/safe.png',
    rotation: 0,
    primary: true
  }]);
  assert.doesNotMatch(
    serialized,
    /tracker\.test|private-compatibility|payload\.(?:html|svg)|file:|data:image/
  );
  assert.deepEqual(
    collectReferencedImageRelativePaths(projected),
    ['inks/hidden-only.webp', 'pens/safe.webp', 'swatches/safe.png']
  );
});
