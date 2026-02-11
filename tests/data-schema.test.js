const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAppData } = require('../lib/data-schema');

test('normalizeAppData returns empty canonical shape for invalid input', () => {
    const data = normalizeAppData(null);
    assert.deepEqual(data, {
        pens: [],
        inks: [],
        currently_inked: []
    });
});

test('normalizeAppData fills defaults while preserving existing values', () => {
    const data = normalizeAppData({
        pens: [{ id: 'p1', brand: 'Pilot', model: '823' }],
        inks: [{ id: 'i1', name: 'Kon-peki', brand: 'Iroshizuku', is_swatch: true }],
        currently_inked: [{ id: 'c1', pen_id: 'p1', ink_id: 'i1' }]
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
});

test('normalizeAppData sanitizes non-array/non-object fields', () => {
    const data = normalizeAppData({
        pens: [{ id: 123, hex_colors: 'red' }],
        inks: [{ id: {}, base_type: 'dye', paper_compatibility: null }],
        currently_inked: ['bad']
    });

    assert.equal(typeof data.pens[0].id, 'string');
    assert.deepEqual(data.pens[0].hex_colors, []);
    assert.equal(typeof data.inks[0].id, 'string');
    assert.deepEqual(data.inks[0].base_type, []);
    assert.deepEqual(data.inks[0].paper_compatibility, []);
    assert.equal(data.currently_inked.length, 1);
    assert.equal(data.currently_inked[0].pen_id, '');
    assert.equal(data.currently_inked[0].ink_id, '');
});
