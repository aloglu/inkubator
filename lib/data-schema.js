const { randomUUID } = require('crypto');

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

let fallbackIdCounter = 0;

function makeFallbackId(prefix) {
    try {
        if (typeof randomUUID === 'function') {
            return `${prefix}_${randomUUID()}`;
        }
    } catch (_) {
        // Fall back to timestamp+counter below.
    }
    fallbackIdCounter += 1;
    return `${prefix}_${Date.now()}_${fallbackIdCounter}`;
}

function normalizePen(value) {
    const input = toObject(value);
    return {
        ...input,
        id: toStringOr(input.id, makeFallbackId('pen')),
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
    const normalized = {
        ...input,
        id: toStringOr(input.id, makeFallbackId('ink')),
        name: toStringOr(input.name),
        brand: toStringOr(input.brand),
        line: toStringOr(input.line),
        type: toStringOr(input.type, 'Bottled'),
        cl: toStringOr(input.cl),
        amount: typeof input.amount === 'string' || typeof input.amount === 'number' ? input.amount : '1',
        price: typeof input.price === 'string' || typeof input.price === 'number' ? input.price : '',
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
        image: toStringOr(input.image),
    };
    // Legacy swatch-on-ink fields are intentionally removed from persisted ink records.
    delete normalized.swatch_paper;
    delete normalized.swatch_nib;
    delete normalized.swatch_date;
    delete normalized.swatch_lighting;
    delete normalized.swatch_notes;
    delete normalized.is_swatch;
    delete normalized.is_orphan_swatch;
    return normalized;
}

function normalizeCurrentInked(value) {
    const input = toObject(value);
    return {
        ...input,
        id: toStringOr(input.id, makeFallbackId('ci')),
        pen_id: toStringOr(input.pen_id),
        ink_id: toStringOr(input.ink_id),
        date_inked: toNumberOr(input.date_inked, Date.now())
    };
}

function normalizeActivityEntry(value) {
    const input = toObject(value);
    return {
        id: toStringOr(input.id, makeFallbackId('act')),
        timestamp: toNumberOr(input.timestamp, Date.now()),
        action: toStringOr(input.action, 'updated'),
        category: toStringOr(input.category, 'system'),
        message: toStringOr(input.message, 'Activity recorded'),
        entity_id: toStringOr(input.entity_id),
        metadata: toObject(input.metadata)
    };
}

function normalizeSwatch(value) {
    const input = toObject(value);
    return {
        ...input,
        id: toStringOr(input.id, makeFallbackId('swatch')),
        ink_id: toStringOr(input.ink_id),
        image: toStringOr(input.image),
        swatch_paper: toStringOr(input.swatch_paper),
        swatch_nib: toStringOr(input.swatch_nib),
        swatch_date: toStringOr(input.swatch_date),
        swatch_lighting: toStringOr(input.swatch_lighting, 'Unknown'),
        swatch_notes: toStringOr(input.swatch_notes),
        created_at: toNumberOr(input.created_at, Date.now())
    };
}

function migrateLegacyInkSwatches(rawInks, normalizedInks, swatches) {
    const out = [...swatches];
    const seenKey = new Set(
        out
            .map(item => {
                const keyImage = toStringOr(item && item.image);
                const keyInk = toStringOr(item && item.ink_id);
                if (!keyImage) return '';
                return `${keyInk}|${keyImage}`;
            })
            .filter(Boolean)
    );

    normalizedInks.forEach((ink, index) => {
        const raw = toObject(toArray(rawInks)[index]);
        if (!ink || !raw.is_swatch || !raw.image) return;
        const dedupeKey = `${toStringOr(ink.id)}|${toStringOr(raw.image)}`;
        if (seenKey.has(dedupeKey)) return;
        out.push(normalizeSwatch({
            ink_id: toStringOr(ink.id),
            image: toStringOr(raw.image),
            swatch_paper: toStringOr(raw.swatch_paper),
            swatch_nib: toStringOr(raw.swatch_nib),
            swatch_date: toStringOr(raw.swatch_date),
            swatch_lighting: toStringOr(raw.swatch_lighting, 'Unknown'),
            swatch_notes: toStringOr(raw.swatch_notes)
        }));
        seenKey.add(dedupeKey);
    });

    return out;
}

function normalizePreferences(value) {
    const input = toObject(value);
    const allowedRetention = [0, 90, 180, 365];
    const allowedColorModes = ['light', 'dark', 'auto'];
    const allowedVerbosity = ['minimal', 'normal', 'detailed'];
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'TRY'];
    const allowedDateFormats = ['system', 'us', 'eu', 'iso'];
    const allowedInkTypes = ['Bottle', 'Sample', 'Cartridge'];
    const allowedPenStatus = ['clean', 'inked'];
    const allowedConflict = ['skip', 'overwrite', 'merge'];
    const allowedAutoBackupFrequencies = ['off', 'daily', 'weekly', 'monthly'];
    const allowedPensSort = ['newest', 'oldest', 'brand-asc', 'brand-desc', 'model-asc', 'model-desc'];
    const allowedInksSort = ['newest', 'oldest', 'brand-asc', 'brand-desc', 'name-asc', 'name-desc'];
    const allowedSwatchesSort = ['newest', 'oldest', 'brand-asc', 'brand-desc', 'name-asc', 'name-desc'];

    const retentionRaw = Number(input.activity_retention_days);
    const activityRetentionDays = allowedRetention.includes(retentionRaw) ? retentionRaw : 365;

    const colorModeRaw = String(input.color_mode || '').toLowerCase().trim();
    const colorMode = allowedColorModes.includes(colorModeRaw) ? colorModeRaw : 'auto';

    const verbosityRaw = String(input.activity_log_verbosity || '').toLowerCase().trim();
    const verbosity = allowedVerbosity.includes(verbosityRaw) ? verbosityRaw : 'normal';

    const showcaseInput = toObject(input.showcase);
    const showcaseSortInput = toObject(showcaseInput.default_sort);
    const defaultsInput = toObject(input.defaults);
    const importExportInput = toObject(input.import_export);
    const backupInput = toObject(input.backup);
    const categoriesInput = toObject(input.activity_log_categories);
    const filtersInput = toObject(input.activity_log_filters);

    const titleRaw = toStringOr(showcaseInput.title, 'Inkubator').trim();
    const showcaseTitle = titleRaw || 'Inkubator';
    const showcaseColorModeRaw = String(showcaseInput.color_mode || '').toLowerCase().trim();
    const showcaseColorMode = allowedColorModes.includes(showcaseColorModeRaw) ? showcaseColorModeRaw : 'auto';

    const currencyRaw = String(defaultsInput.currency || '').toUpperCase();
    const dateFormatRaw = String(defaultsInput.date_format || '').toLowerCase();
    const penStatusRaw = String(defaultsInput.pen_status || '').toLowerCase();
    const inkTypeRaw = String(defaultsInput.ink_type || '');

    const conflictBehaviorRaw = String(importExportInput.conflict_behavior || '').toLowerCase();
    const backupFrequencyRaw = String(backupInput.auto_frequency || '').toLowerCase();
    const backupRetentionRaw = Number(backupInput.retention_count);

    const pensSortRaw = String(showcaseSortInput.pens || '');
    const inksSortRaw = String(showcaseSortInput.inks || '');
    const swatchesSortRaw = String(showcaseSortInput.swatches || '');

    return {
        show_activity_log: toBool(input.show_activity_log, true),        
        show_recent_activity: toBool(input.show_recent_activity, true),        
        open_cards_in_edit_mode: toBool(input.open_cards_in_edit_mode, true),
        activity_retention_days: activityRetentionDays,
        color_mode: colorMode,
        confirm_destructive_actions: toBool(input.confirm_destructive_actions, true),
        activity_log_verbosity: verbosity,
        activity_log_filters: {
            pen_edits: toBool(filtersInput.pen_edits, true),
            ink_edits: toBool(filtersInput.ink_edits, true),
            swatches: toBool(filtersInput.swatches, true),
            deletes: toBool(filtersInput.deletes, true)
        },
        activity_log_categories: {
            pen: toBool(categoriesInput.pen, true),
            ink: toBool(categoriesInput.ink, true),
            swatch: toBool(categoriesInput.swatch, true)
        },
        defaults: {
            currency: allowedCurrencies.includes(currencyRaw) ? currencyRaw : 'USD',
            date_format: allowedDateFormats.includes(dateFormatRaw) ? dateFormatRaw : 'system',
            pen_nib: toStringOr(defaultsInput.pen_nib, 'M').trim() || 'M',
            pen_nib_material: toStringOr(defaultsInput.pen_nib_material, 'Steel').trim() || 'Steel',
            pen_status: allowedPenStatus.includes(penStatusRaw) ? penStatusRaw : 'clean',
            ink_type: allowedInkTypes.includes(inkTypeRaw) ? inkTypeRaw : 'Bottle'
        },
        import_export: {
            auto_validate_import: toBool(importExportInput.auto_validate_import, true),
            conflict_behavior: allowedConflict.includes(conflictBehaviorRaw) ? conflictBehaviorRaw : 'overwrite',
            include_optional_metadata: toBool(importExportInput.include_optional_metadata, true)
        },
        backup: {
            auto_frequency: allowedAutoBackupFrequencies.includes(backupFrequencyRaw) ? backupFrequencyRaw : 'daily',
            retention_count: Number.isFinite(backupRetentionRaw)
                ? Math.min(365, Math.max(1, Math.round(backupRetentionRaw)))
                : 30,
            include_images: toBool(backupInput.include_images, false)
        },
        showcase: {
            title: showcaseTitle,
            color_mode: showcaseColorMode,
            show_prices: toBool(showcaseInput.show_prices, true),
            show_pens: toBool(showcaseInput.show_pens, true),
            show_inks: toBool(showcaseInput.show_inks, true),
            show_swatches: toBool(showcaseInput.show_swatches, true),
            default_sort: {
                pens: allowedPensSort.includes(pensSortRaw) ? pensSortRaw : 'newest',
                inks: allowedInksSort.includes(inksSortRaw) ? inksSortRaw : 'newest',
                swatches: allowedSwatchesSort.includes(swatchesSortRaw) ? swatchesSortRaw : 'newest'
            },
            show_insights: toBool(showcaseInput.show_insights, true),
            show_charts: toBool(showcaseInput.show_charts, true)
        }
    };
}

function normalizeAppData(value) {
    const input = toObject(value);
    const rawInks = toArray(input.inks).map(toObject);
    const inks = rawInks.map(normalizeInk);
    const migratedSwatches = migrateLegacyInkSwatches(
        rawInks,
        inks,
        toArray(input.swatches).map(normalizeSwatch)
    );
    const inkIds = new Set(
        inks
            .map((ink) => toStringOr(ink && ink.id))
            .filter(Boolean)
    );
    const swatches = migratedSwatches.filter((swatch) => {
        if (!swatch || typeof swatch !== 'object') return false;
        if (!toStringOr(swatch.image)) return false;
        const inkId = toStringOr(swatch.ink_id);
        if (!inkId) return false;
        return inkIds.has(inkId);
    });
    return {
        pens: toArray(input.pens).map(normalizePen),
        inks,
        swatches,
        currently_inked: toArray(input.currently_inked).map(normalizeCurrentInked),
        activity_log: toArray(input.activity_log).map(normalizeActivityEntry),
        preferences: normalizePreferences(input.preferences)
    };
}

module.exports = {
    normalizeAppData
};
