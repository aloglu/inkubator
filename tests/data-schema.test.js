const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAppData } = require('../lib/data-schema');

test('normalizeAppData returns empty canonical shape for invalid input', () => {
    const data = normalizeAppData(null);
    assert.deepEqual(data, {
        pens: [],
        inks: [],
        currently_inked: [],
        activity_log: [],
        preferences: {
            show_activity_log: true,
            show_recent_activity: true,
            activity_retention_days: 365
        }
    });
});

test('normalizeAppData fills defaults while preserving existing values', () => {
    const data = normalizeAppData({
        pens: [{ id: 'p1', brand: 'Pilot', model: '823' }],
        inks: [{ id: 'i1', name: 'Kon-peki', brand: 'Iroshizuku', is_swatch: true }],
        currently_inked: [{ id: 'c1', pen_id: 'p1', ink_id: 'i1' }],
        activity_log: [{ id: 'a1', action: 'created', category: 'pen', message: 'Added pen.' }],
        preferences: { show_activity_log: false, show_recent_activity: false, activity_retention_days: 180 }
    });

    assert.equal(data.pens[0].id, 'p1');
    assert.equal(data.pens[0].brand, 'Pilot');
    assert.equal(data.pens[0].nib, 'M');
    assert.equal(data.pens[0].image, 'default_pen.png');

    assert.equal(data.inks[0].id, 'i1');
    assert.equal(data.inks[0].name, 'Kon-peki');
    assert.equal(data.inks[0].type, 'Bottled');
    assert.equal(data.inks[0].is_swatch, true);

    assert.equal(data.currently_inked[0].id, 'c1');
    assert.equal(data.currently_inked[0].pen_id, 'p1');
    assert.equal(data.currently_inked[0].ink_id, 'i1');
    assert.equal(typeof data.currently_inked[0].date_inked, 'number');

    assert.equal(data.activity_log[0].id, 'a1');
    assert.equal(data.activity_log[0].category, 'pen');
    assert.equal(typeof data.activity_log[0].timestamp, 'number');
    assert.equal(data.preferences.show_activity_log, false);
    assert.equal(data.preferences.activity_retention_days, 180);
});

test('normalizeAppData sanitizes non-array/non-object fields', () => {
    const data = normalizeAppData({
        pens: [{ id: 123, hex_colors: 'red' }],
        inks: [{ id: {}, base_type: 'dye', paper_compatibility: null }],
        currently_inked: ['bad'],
        activity_log: ['bad'],
        preferences: { activity_retention_days: 999 }
    });

    assert.equal(typeof data.pens[0].id, 'string');
    assert.deepEqual(data.pens[0].hex_colors, []);
    assert.equal(typeof data.inks[0].id, 'string');
    assert.deepEqual(data.inks[0].base_type, []);
    assert.deepEqual(data.inks[0].paper_compatibility, []);
    assert.equal(data.currently_inked.length, 1);
    assert.equal(data.currently_inked[0].pen_id, '');
    assert.equal(data.currently_inked[0].ink_id, '');
    assert.equal(data.activity_log.length, 1);
    assert.equal(data.activity_log[0].category, 'system');
    assert.equal(data.preferences.activity_retention_days, 365);
});
