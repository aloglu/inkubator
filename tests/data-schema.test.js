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
                include_images: true,
                keep_replaced_images: false
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
            backup: {
                keep_replaced_images: true
            },
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
    assert.equal(data.preferences.backup.keep_replaced_images, true);
    assert.equal(data.preferences.showcase.color_mode, 'dark');
    assert.equal(data.preferences.showcase.default_sort.pens, 'brand-asc');
    assert.equal(data.preferences.showcase.default_sort.inks, 'name-desc');
    assert.equal(data.preferences.showcase.default_sort.swatches, 'oldest');
    assert.equal(data.preferences.showcase.show_insights, false);
    assert.equal(data.preferences.showcase.show_charts, false);
    assert.equal(data.preferences.showcase.show_activity_filters, true);
});

test('normalizeAppData migrates legacy ink volume to canonical volume_ml without converting the value', () => {
    const data = normalizeAppData({
        inks: [
            { id: 'legacy-string', name: 'Legacy String', cl: '50' },
            { id: 'legacy-number', name: 'Legacy Number', cl: 30 },
            { id: 'transitional', name: 'Transitional', ml: '20', cl: '99' },
            { id: 'canonical', name: 'Canonical', volume_ml: '15', ml: '20', cl: '99' }
        ]
    });

    assert.equal(data.inks[0].volume_ml, '50');
    assert.equal(data.inks[1].volume_ml, 30);
    assert.equal(data.inks[2].volume_ml, '20');
    assert.equal(data.inks[3].volume_ml, '15');
    data.inks.forEach((ink) => {
        assert.equal(Object.prototype.hasOwnProperty.call(ink, 'cl'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(ink, 'ml'), false);
    });
});

test('normalizeAppData migrates pen image fields into ordered primary image entries', () => {
    const data = normalizeAppData({
        pens: [{
            id: 'p1',
            brand: 'Pilot',
            model: '823',
            image: 'pens/pilot-823.webp',
            image_rotation: 90
        }]
    });

    assert.equal(data.pens[0].image, 'pens/pilot-823.webp');
    assert.equal(data.pens[0].image_rotation, 90);
    assert.equal(data.pens[0].images.length, 1);
    assert.equal(data.pens[0].images[0].path, 'pens/pilot-823.webp');
    assert.equal(data.pens[0].images[0].rotation, 90);
    assert.equal(data.pens[0].images[0].primary, true);
});

test('normalizeAppData preserves one primary image from image arrays', () => {
    const data = normalizeAppData({
        pens: [{
            id: 'p1',
            brand: 'Pilot',
            model: '823',
            image: 'pens/legacy.webp',
            images: [
                { id: 'img1', path: 'pens/side.webp', primary: false },
                { id: 'img2', path: 'pens/front.webp', rotation: 180, primary: true },
                { id: 'img3', path: 'pens/detail.webp', primary: true }
            ]
        }]
    });

    assert.equal(data.pens[0].images.length, 4);
    assert.equal(data.pens[0].images.filter((entry) => entry.primary).length, 1);
    assert.deepEqual(data.pens[0].images.map((entry) => entry.path), [
        'pens/front.webp',
        'pens/side.webp',
        'pens/detail.webp',
        'pens/legacy.webp'
    ]);
    assert.deepEqual(data.pens[0].images.map((entry) => entry.primary), [true, false, false, false]);
    assert.equal(data.pens[0].image, 'pens/front.webp');
    assert.equal(data.pens[0].image_rotation, 180);
});

test('normalizeAppData moves a swatch primary image to the front', () => {
    const data = normalizeAppData({
        inks: [{ id: 'ink1', name: 'Blue' }],
        swatches: [{
            id: 'swatch1',
            ink_id: 'ink1',
            image: 'swatches/third.webp',
            images: [
                { id: 'img1', path: 'swatches/first.webp', primary: false },
                { id: 'img2', path: 'swatches/second.webp', primary: false },
                { id: 'img3', path: 'swatches/third.webp', primary: true }
            ]
        }]
    });

    assert.deepEqual(data.swatches[0].images.map((entry) => entry.path), [
        'swatches/third.webp',
        'swatches/first.webp',
        'swatches/second.webp'
    ]);
    assert.deepEqual(data.swatches[0].images.map((entry) => entry.primary), [true, false, false]);
    assert.equal(data.swatches[0].image, 'swatches/third.webp');
});

test('normalizeAppData promotes the remaining image when a primary image is removed', () => {
    const data = normalizeAppData({
        pens: [{
            id: 'p1',
            brand: 'Pilot',
            model: '823',
            image: 'default_pen.png',
            images: [
                { id: 'img2', path: 'pens/side.webp', rotation: 90, primary: false },
                { id: 'img3', path: 'pens/detail.webp', primary: false }
            ]
        }]
    });

    assert.equal(data.pens[0].images.length, 2);
    assert.equal(data.pens[0].images.filter((entry) => entry.primary).length, 1);
    assert.equal(data.pens[0].image, 'pens/side.webp');
    assert.equal(data.pens[0].image_rotation, 90);
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

test('normalizeAppData preserves explicitly selected user defaults', () => {
    const data = normalizeAppData({
        preferences: {
            defaults: {
                pen_nib: 'M',
                pen_nib_material: 'Steel',
                pen_status: 'clean',
                ink_type: 'Bottle'
            }
        }
    });

    assert.equal(data.preferences.defaults.pen_nib, 'M');
    assert.equal(data.preferences.defaults.pen_nib_material, 'Steel');
    assert.equal(data.preferences.defaults.pen_status, 'clean');
    assert.equal(data.preferences.defaults.ink_type, 'Bottle');
});

test('normalizeAppData accepts Other as a default ink type', () => {
    const data = normalizeAppData({
        preferences: {
            defaults: {
                ink_type: 'Other'
            }
        }
    });

    assert.equal(data.preferences.defaults.ink_type, 'Other');
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

test('normalizeAppData rejects imported color values that are not strict hex colors', () => {
    const data = normalizeAppData({
        pens: [{
            id: 'pen-color',
            hex_color: '#\"><img src=x onerror=alert(1)>',
            hex_colors: ['#123456', '#abc', '#\"><script>bad</script>', 'red']
        }],
        inks: [{
            id: 'ink-color',
            color_base: '#\"><img src=x onerror=alert(1)>',
            color_accent: 'rgb(1, 2, 3)',
            hex_colors: ['#654321', '#DEF', 'url(https://tracker.invalid)']
        }]
    });

    assert.equal(data.pens[0].hex_color, '#123456');
    assert.deepEqual(data.pens[0].hex_colors, ['#123456', '#abc']);
    assert.equal(data.inks[0].color_base, '#4a0e28');
    assert.equal(data.inks[0].color_accent, '#4a0e28');
    assert.deepEqual(data.inks[0].hex_colors, ['#654321', '#DEF']);
    assert.doesNotMatch(JSON.stringify(data), /onerror|script|tracker\.invalid/);
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
