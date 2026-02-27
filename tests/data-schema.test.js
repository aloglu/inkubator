const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAppData } = require('../lib/data-schema');

test('normalizeAppData returns empty canonical shape for invalid input', () => {
    const data = normalizeAppData(null);
    assert.deepEqual(data, {
        pens: [],
        inks: [],
        swatches: [],
        currently_inked: [],
        activity_log: [],
        preferences: {
            show_activity_log: true,
            show_recent_activity: true,
            open_cards_in_edit_mode: true,
            activity_retention_days: 365,
            color_mode: 'auto',
            confirm_destructive_actions: true,
            activity_log_verbosity: 'normal',
            activity_log_filters: {
                pen_edits: true,
                ink_edits: true,
                swatches: true,
                deletes: true
            },
            activity_log_categories: {
                pen: true,
                ink: true,
                swatch: true
            },
            defaults: {
                currency: 'USD',
                date_format: 'system',
                pen_nib: '',
                pen_nib_material: '',
                pen_status: '',
                ink_type: ''
            },
            import_export: {
                auto_validate_import: true,
                conflict_behavior: 'overwrite',
                include_optional_metadata: true
            },
            backup: {
                auto_frequency: 'daily',
                retention_count: 30,
                include_images: true
            },
            showcase: {
                title: 'Inkubator',
                color_mode: 'auto',
                show_prices: true,
                show_pens: true,
                show_inks: true,
                show_swatches: true,
                show_activity_filters: true,
                default_sort: {
                    pens: 'newest',
                    inks: 'newest',
                    swatches: 'newest'
                },
                show_insights: true,
                show_charts: true
            }
        }
    });
});

test('normalizeAppData fills defaults while preserving existing values', () => {
    const data = normalizeAppData({
        pens: [{ id: 'p1', brand: 'Pilot', model: '823' }],
        inks: [{ id: 'i1', name: 'Kon-peki', brand: 'Iroshizuku', is_swatch: true }],
        swatches: [{ id: 's1', ink_id: 'i1', image: 'swatches/kon-peki.webp', swatch_paper: 'Tomoe River' }],
        currently_inked: [{ id: 'c1', pen_id: 'p1', ink_id: 'i1' }],
        activity_log: [{ id: 'a1', action: 'created', category: 'pen', message: 'Added pen.' }],
        preferences: {
            show_activity_log: false,
            show_recent_activity: false,
            activity_retention_days: 180,
            showcase: {
                color_mode: 'dark',
                default_sort: {
                    pens: 'brand-asc',
                    inks: 'name-desc',
                    swatches: 'oldest'
                },
                show_insights: false,
                show_charts: false
            }
        }
    });

    assert.equal(data.pens[0].id, 'p1');
    assert.equal(data.pens[0].brand, 'Pilot');
    assert.equal(data.pens[0].nib, 'M');
    assert.equal(data.pens[0].image, 'default_pen.png');

    assert.equal(data.inks[0].id, 'i1');
    assert.equal(data.inks[0].name, 'Kon-peki');
    assert.equal(data.inks[0].type, 'Bottled');
    assert.equal(Object.prototype.hasOwnProperty.call(data.inks[0], 'is_swatch'), false);
    assert.equal(data.swatches[0].id, 's1');
    assert.equal(data.swatches[0].ink_id, 'i1');
    assert.equal(data.swatches[0].swatch_paper, 'Tomoe River');

    assert.equal(data.currently_inked[0].id, 'c1');
    assert.equal(data.currently_inked[0].pen_id, 'p1');
    assert.equal(data.currently_inked[0].ink_id, 'i1');
    assert.equal(typeof data.currently_inked[0].date_inked, 'number');

    assert.equal(data.activity_log[0].id, 'a1');
    assert.equal(data.activity_log[0].category, 'pen');
    assert.equal(typeof data.activity_log[0].timestamp, 'number');
    assert.equal(data.preferences.show_activity_log, false);
    assert.equal(data.preferences.activity_retention_days, 180);
    assert.equal(data.preferences.showcase.color_mode, 'dark');
    assert.equal(data.preferences.showcase.default_sort.pens, 'brand-asc');
    assert.equal(data.preferences.showcase.default_sort.inks, 'name-desc');
    assert.equal(data.preferences.showcase.default_sort.swatches, 'oldest');
    assert.equal(data.preferences.showcase.show_insights, false);
    assert.equal(data.preferences.showcase.show_charts, false);
    assert.equal(data.preferences.showcase.show_activity_filters, true);
});

test('normalizeAppData sanitizes invalid showcase default sort values', () => {
    const data = normalizeAppData({
        preferences: {
            showcase: {
                default_sort: {
                    pens: 'invalid-pens-sort',
                    inks: 'invalid-inks-sort',
                    swatches: 'invalid-swatches-sort'
                }
            }
        }
    });

    assert.equal(data.preferences.showcase.default_sort.pens, 'newest');
    assert.equal(data.preferences.showcase.default_sort.inks, 'newest');
    assert.equal(data.preferences.showcase.default_sort.swatches, 'newest');
});

test('normalizeAppData sanitizes non-array/non-object fields', () => {
    const data = normalizeAppData({
        pens: [{ id: 123, hex_colors: 'red' }],
        inks: [{ id: {}, base_type: 'dye', paper_compatibility: null }],
        swatches: 'bad',
        currently_inked: ['bad'],
        activity_log: ['bad'],
        preferences: { activity_retention_days: 999 }
    });

    assert.equal(typeof data.pens[0].id, 'string');
    assert.deepEqual(data.pens[0].hex_colors, []);
    assert.equal(typeof data.inks[0].id, 'string');
    assert.deepEqual(data.inks[0].base_type, []);
    assert.deepEqual(data.inks[0].paper_compatibility, []);
    assert.deepEqual(data.swatches, []);
    assert.equal(data.currently_inked.length, 1);
    assert.equal(data.currently_inked[0].pen_id, '');
    assert.equal(data.currently_inked[0].ink_id, '');
    assert.equal(data.activity_log.length, 1);
    assert.equal(data.activity_log[0].category, 'system');
    assert.equal(data.preferences.activity_retention_days, 365);
    assert.equal(data.preferences.showcase.show_insights, true);
    assert.equal(data.preferences.showcase.show_charts, true);
    assert.equal(data.preferences.showcase.show_activity_filters, true);
});

test('normalizeAppData generates unique fallback IDs when IDs are missing', () => {
    const count = 40;
    const data = normalizeAppData({
        pens: Array.from({ length: count }, () => ({})),
        inks: Array.from({ length: count }, () => ({})),
        currently_inked: Array.from({ length: count }, () => ({})),
        activity_log: Array.from({ length: count }, () => ({}))
    });

    const uniqueCount = (items) => new Set(items.map(item => item.id)).size;

    assert.equal(uniqueCount(data.pens), count);
    assert.equal(uniqueCount(data.inks), count);
    assert.equal(uniqueCount(data.currently_inked), count);
    assert.equal(uniqueCount(data.activity_log), count);
});

test('normalizeAppData generates unique fallback IDs for swatches when linked ink exists', () => {
    const count = 40;
    const inks = Array.from({ length: count }, (_, i) => ({ id: `ink_${i}`, name: `Ink ${i}` }));
    const swatches = Array.from({ length: count }, (_, i) => ({ ink_id: `ink_${i}`, image: `swatches/${i}.webp` }));
    const data = normalizeAppData({ inks, swatches });
    const uniqueCount = (items) => new Set(items.map(item => item.id)).size;

    assert.equal(uniqueCount(data.swatches), count);
});

test('normalizeAppData migrates legacy ink swatch fields into swatches collection', () => {
    const data = normalizeAppData({
        inks: [{
            id: 'i_legacy',
            name: 'Legacy Ink',
            image: 'swatches/legacy.webp',
            is_swatch: true,
            swatch_paper: 'Rhodia',
            swatch_nib: 'F'
        }]
    });

    assert.equal(data.swatches.length, 1);
    assert.equal(data.swatches[0].ink_id, 'i_legacy');
    assert.equal(data.swatches[0].image, 'swatches/legacy.webp');
    assert.equal(data.swatches[0].swatch_paper, 'Rhodia');
    assert.equal(data.swatches[0].swatch_nib, 'F');
});

test('normalizeAppData drops swatches that are not linked to existing inks or missing image', () => {
    const data = normalizeAppData({
        inks: [{ id: 'i1', name: 'Kon-peki' }],
        swatches: [
            { id: 's_valid', ink_id: 'i1', image: 'swatches/kon-peki.webp' },
            { id: 's_missing_ink', ink_id: 'i_missing', image: 'swatches/nope.webp' },
            { id: 's_missing_image', ink_id: 'i1', image: '' }
        ]
    });

    assert.equal(data.swatches.length, 1);
    assert.equal(data.swatches[0].id, 's_valid');
    assert.equal(data.swatches[0].ink_id, 'i1');
});

test('normalizeAppData filters invalid currently_inked references while preserving blank placeholders', () => {
    const data = normalizeAppData({
        pens: [{ id: 'p1', brand: 'Pilot', model: '823' }],
        inks: [{ id: 'i1', name: 'Kon-peki', brand: 'Pilot' }],
        currently_inked: [
            { id: 'ci_ok', pen_id: 'p1', ink_id: 'i1' },
            { id: 'ci_missing_pen', pen_id: 'p_missing', ink_id: 'i1' },
            { id: 'ci_missing_ink', pen_id: 'p1', ink_id: 'i_missing' },
            { id: 'ci_half_blank', pen_id: 'p1', ink_id: '' },
            { id: 'ci_placeholder', pen_id: '', ink_id: '' }
        ]
    });

    assert.equal(data.currently_inked.length, 2);
    assert.deepEqual(
        data.currently_inked.map((entry) => entry.id),
        ['ci_ok', 'ci_placeholder']
    );
});
