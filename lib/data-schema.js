function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function toStringOr(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function toBool(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function toNumberOr(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value) {
    return toArray(value).filter(v => typeof v === 'string');
}

function normalizePen(value) {
    const input = toObject(value);
    return {
        ...input,
        id: toStringOr(input.id, `pen_${Date.now()}`),
        brand: toStringOr(input.brand),
        model: toStringOr(input.model),
        nib: toStringOr(input.nib, 'M'),
        nib_material: toStringOr(input.nib_material, 'Steel'),
        material: toStringOr(input.material, 'Standard'),
        filling_system: toStringOr(input.filling_system),
        color: toStringOr(input.color),
        hex_color: toStringOr(input.hex_color),
        hex_colors: normalizeStringArray(input.hex_colors),
        image_rotation: toNumberOr(input.image_rotation, 0),
        price: typeof input.price === 'string' || typeof input.price === 'number' ? input.price : '',
        notes: toStringOr(input.notes),
        image: toStringOr(input.image, 'default_pen.png')
    };
}

function normalizeInk(value) {
    const input = toObject(value);
    return {
        ...input,
        id: toStringOr(input.id, `ink_${Date.now()}`),
        name: toStringOr(input.name),
        brand: toStringOr(input.brand),
        line: toStringOr(input.line),
        type: toStringOr(input.type, 'Bottled'),
        cl: toStringOr(input.cl),
        amount: typeof input.amount === 'string' || typeof input.amount === 'number' ? input.amount : '1',
        color_base: toStringOr(input.color_base, '#4a0e28'),
        color_accent: toStringOr(input.color_accent, '#4a0e28'),
        hex_colors: normalizeStringArray(input.hex_colors),
        shading: toStringOr(input.shading, 'None'),
        sheen: toStringOr(input.sheen, 'None'),
        shimmer: toStringOr(input.shimmer, 'None'),
        flow: toStringOr(input.flow, 'Average'),
        lubrication: toStringOr(input.lubrication, 'Low'),
        dry_time: toStringOr(input.dry_time),
        base_type: normalizeStringArray(input.base_type),
        permanence: toStringOr(input.permanence, 'None'),
        paper_compatibility: normalizeStringArray(input.paper_compatibility),
        notes: toStringOr(input.notes),
        swatch_paper: toStringOr(input.swatch_paper),
        swatch_nib: toStringOr(input.swatch_nib),
        swatch_date: toStringOr(input.swatch_date),
        swatch_lighting: toStringOr(input.swatch_lighting, 'Unknown'),
        swatch_notes: toStringOr(input.swatch_notes),
        image: toStringOr(input.image),
        is_swatch: toBool(input.is_swatch, false)
    };
}

function normalizeCurrentInked(value) {
    const input = toObject(value);
    return {
        ...input,
        id: toStringOr(input.id, `ci_${Date.now()}`),
        pen_id: toStringOr(input.pen_id),
        ink_id: toStringOr(input.ink_id),
        date_inked: toNumberOr(input.date_inked, Date.now())
    };
}

function normalizeAppData(value) {
    const input = toObject(value);
    return {
        pens: toArray(input.pens).map(normalizePen),
        inks: toArray(input.inks).map(normalizeInk),
        currently_inked: toArray(input.currently_inked).map(normalizeCurrentInked)
    };
}

module.exports = {
    normalizeAppData
};
