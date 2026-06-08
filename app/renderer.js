// DOM Elements (Updated)
const viewDashboard = document.getElementById('view-dashboard');
const viewStats = document.getElementById('view-stats');
const viewSettings = document.getElementById('view-settings');
const viewPens = document.getElementById('view-pens');
const viewActivity = document.getElementById('view-activity');
const navDashboard = document.getElementById('nav-dashboard');
const navStats = document.getElementById('nav-stats');
const navSettings = document.getElementById('nav-settings');
const navPens = document.getElementById('nav-pens');
const navActivity = document.getElementById('nav-activity');
const navActivityDivider = document.getElementById('nav-activity-divider');
const pensGrid = document.getElementById('pens-grid');

const inkedGrid = document.getElementById('inked-grid');
const recentList = document.querySelector('.recent-list');
const statsSection = document.querySelector('.stats-grid');
const btnAddNew = document.getElementById('btn-add-ink');
const btnAddMenuWrapper = document.querySelector('.dropdown-wrapper');
const btnAddPenHeader = document.getElementById('btn-add-pen-header');
const btnAddInkHeader = document.getElementById('btn-add-ink-header');
const navInks = document.getElementById('nav-inks');
const navSwatches = document.getElementById('nav-swatches');
const modalSwatchDetail = document.getElementById('modal-swatch-detail');
const modalPenDetail = document.getElementById('modal-pen-detail');
const detailImageLightbox = document.getElementById('detail-image-lightbox');
const detailImageLightboxStage = document.getElementById('detail-image-lightbox-stage');
const detailImageLightboxWrap = document.getElementById('detail-image-lightbox-wrap');
const detailImageLightboxImg = document.getElementById('detail-image-lightbox-img');
const btnEditSwatchDetail = document.getElementById('btn-edit-swatch-detail');
const btnEditPenDetail = document.getElementById('btn-edit-pen-detail');
const backupActions = document.getElementById('backup-actions');
const backupStatus = document.getElementById('backup-status');
const btnExportBackup = document.getElementById('btn-export-backup');
const btnImportBackup = document.getElementById('btn-import-backup');
const btnExportShowcase = document.getElementById('btn-export-showcase');
const showcaseSettingsTitle = document.getElementById('showcase-settings-title');
const websiteColorModeField = document.getElementById('website-color-mode-field');
const appVersionText = document.getElementById('app-version-text');
const appUpdateStatusText = document.getElementById('app-update-status-text');
const btnCheckUpdates = document.getElementById('btn-check-updates');
const btnOpenReleases = document.getElementById('btn-open-releases');
const appLogoTitle = document.getElementById('app-logo-title');
const activityLogContainer = document.getElementById('activity-log-container');
const activityFilterToolbar = document.getElementById('activity-filter-toolbar');
const recentActivityList = document.getElementById('recent-activity-list');
const recentActivityCard = document.getElementById('recent-activity-card');
const toggleActivityVisible = document.getElementById('toggle-activity-visible');
const toggleShowcaseActivityFiltersVisible = document.getElementById('toggle-showcase-activity-filters-visible');
const toggleRecentActivityVisible = document.getElementById('toggle-recent-activity-visible');
const toggleShowcasePricesVisible = document.getElementById('toggle-showcase-prices-visible');
const toggleShowcasePensVisible = document.getElementById('toggle-showcase-pens-visible');
const toggleShowcaseInksVisible = document.getElementById('toggle-showcase-inks-visible');
const toggleShowcaseSwatchesVisible = document.getElementById('toggle-showcase-swatches-visible');
const toggleShowcaseInsightsVisible = document.getElementById('toggle-showcase-insights-visible');
const toggleShowcaseChartsVisible = document.getElementById('toggle-showcase-charts-visible');
const toggleOpenCardsEditMode = document.getElementById('toggle-open-cards-edit-mode');
const colorModeSelect = document.getElementById('color-mode-select');
const showcaseColorModeSelect = document.getElementById('showcase-color-mode-select');
const toggleConfirmDestructive = document.getElementById('toggle-confirm-destructive');
const activityLogVerbositySelect = document.getElementById('activity-log-verbosity-select');
const toggleLogPenEdits = document.getElementById('toggle-log-pen-edits');
const toggleLogInkEdits = document.getElementById('toggle-log-ink-edits');
const toggleLogSwatchEvents = document.getElementById('toggle-log-swatch-events');
const toggleLogDeleteEvents = document.getElementById('toggle-log-delete-events');
const showcaseTitleInput = document.getElementById('showcase-title-input');
const showcaseSortPensSelect = document.getElementById('showcase-sort-pens-select');
const showcaseSortInksSelect = document.getElementById('showcase-sort-inks-select');
const showcaseSortSwatchesSelect = document.getElementById('showcase-sort-swatches-select');
const activityRetentionSelect = document.getElementById('activity-retention-select');
const btnExportActivityCsv = document.getElementById('btn-export-activity-csv');
const btnExportActivityJson = document.getElementById('btn-export-activity-json');
const defaultCurrencySelect = document.getElementById('default-currency-select');
const defaultDateFormatSelect = document.getElementById('default-date-format-select');
const defaultPenNibInput = document.getElementById('default-pen-nib-input');
const defaultPenNibMaterialInput = document.getElementById('default-pen-nib-material-input');
const defaultPenStatusSelect = document.getElementById('default-pen-status-select');
const defaultInkTypeSelect = document.getElementById('default-ink-type-select');
const toggleImportAutoValidate = document.getElementById('toggle-import-auto-validate');
const toggleExportIncludeMetadata = document.getElementById('toggle-export-include-metadata');
const importConflictBehaviorSelect = document.getElementById('import-conflict-behavior-select');
const autoBackupFrequencySelect = document.getElementById('auto-backup-frequency-select');
const backupRetentionCountInput = document.getElementById('backup-retention-count-input');
const toggleBackupKeepReplacedImages = document.getElementById('toggle-backup-keep-replaced-images');
const backupSettingsEffective = document.getElementById('backup-settings-effective');
const inkPricePrefix = document.getElementById('ink-price-prefix');
const penPricePrefix = document.getElementById('pen-price-prefix');
const activityDatePickerToggle = document.getElementById('activity-date-picker-toggle');
const activityCalendarPopover = document.getElementById('activity-calendar-popover');
const activityCalendarPrev = document.getElementById('activity-calendar-prev');
const activityCalendarNext = document.getElementById('activity-calendar-next');
const activityCalendarMonthLabel = document.getElementById('activity-calendar-month-label');
const activityCalendarGrid = document.getElementById('activity-calendar-grid');
const activityCalendarClear = document.getElementById('activity-calendar-clear');
const activityCalendarToday = document.getElementById('activity-calendar-today');
const swatchDatePickerToggle = document.getElementById('swatch-date-picker-toggle');
const swatchDatePickerWrap = document.querySelector('.swatch-date-picker-wrap');
const swatchCalendarPopover = document.getElementById('swatch-calendar-popover');
const swatchCalendarPrev = document.getElementById('swatch-calendar-prev');
const swatchCalendarNext = document.getElementById('swatch-calendar-next');
const swatchCalendarMonthLabel = document.getElementById('swatch-calendar-month-label');
const swatchCalendarGrid = document.getElementById('swatch-calendar-grid');
const swatchCalendarClear = document.getElementById('swatch-calendar-clear');
const swatchCalendarToday = document.getElementById('swatch-calendar-today');
const activityDeleteOlderSelect = document.getElementById('activity-delete-older-select');
const btnDeleteOlderActivity = document.getElementById('btn-delete-older-activity');
const btnClearAllActivity = document.getElementById('btn-clear-all-activity');
const activityPagination = document.getElementById('activity-pagination');
const activityPageSizeSelect = document.getElementById('activity-page-size');
const activityPagePrevBtn = document.getElementById('activity-page-prev');
const activityPageNextBtn = document.getElementById('activity-page-next');
const activityPageStatus = document.getElementById('activity-page-status');
const activityFilterTypeSelect = document.getElementById('activity-filter-type');
const activityFilterActionSelect = document.getElementById('activity-filter-action');
const activityFilterSearchInput = document.getElementById('activity-filter-search');
const activityFilterDateFromWrap = document.getElementById('activity-filter-date-from-wrap');
const activityFilterDateToWrap = document.getElementById('activity-filter-date-to-wrap');
const activityFilterDateFromInput = document.getElementById('activity-filter-date-from');
const activityFilterDateToInput = document.getElementById('activity-filter-date-to');
const activityFilterDateFromToggle = document.getElementById('activity-filter-date-from-toggle');
const activityFilterDateFromPopover = document.getElementById('activity-filter-date-from-popover');
const activityFilterDateFromPrev = document.getElementById('activity-filter-date-from-prev');
const activityFilterDateFromNext = document.getElementById('activity-filter-date-from-next');
const activityFilterDateFromMonthLabel = document.getElementById('activity-filter-date-from-month-label');
const activityFilterDateFromGrid = document.getElementById('activity-filter-date-from-grid');
const activityFilterDateFromClear = document.getElementById('activity-filter-date-from-clear');
const activityFilterDateFromToday = document.getElementById('activity-filter-date-from-today');
const activityFilterDateToToggle = document.getElementById('activity-filter-date-to-toggle');
const activityFilterDateToPopover = document.getElementById('activity-filter-date-to-popover');
const activityFilterDateToPrev = document.getElementById('activity-filter-date-to-prev');
const activityFilterDateToNext = document.getElementById('activity-filter-date-to-next');
const activityFilterDateToMonthLabel = document.getElementById('activity-filter-date-to-month-label');
const activityFilterDateToGrid = document.getElementById('activity-filter-date-to-grid');
const activityFilterDateToClear = document.getElementById('activity-filter-date-to-clear');
const activityFilterDateToToday = document.getElementById('activity-filter-date-to-today');
const btnActivityFiltersReset = document.getElementById('btn-activity-filters-reset');
const collectionInsightsCard = document.getElementById('collection-insights-card');
const collectionChartsCard = document.getElementById('collection-charts-card');
const collectionInsightsList = document.getElementById('collection-insights-list');
const chartColorDistribution = document.getElementById('chart-color-distribution');
const chartInkColorDistribution = document.getElementById('chart-ink-color-distribution');
const chartActivityTrend = document.getElementById('chart-activity-trend');
const chartMonthlyGrowth = document.getElementById('chart-monthly-growth');
const chartTopPenBrands = document.getElementById('chart-top-pen-brands');
const chartTopInkBrands = document.getElementById('chart-top-ink-brands');
const chartPenSpendBrands = document.getElementById('chart-pen-spend-brands');
const chartInkSpendBrands = document.getElementById('chart-ink-spend-brands');
const groupedSpectrumList = document.getElementById('grouped-spectrum-list');
// State
const desktopAPI = window.inkubatorAPI || null;
let isManagerApp = false;
let isDockerMode = false;
let managerImagesBaseUrl = '';
let imageAssetVersion = Date.now();
let managedImageDataUrlCache = new Map();
let latestReleaseStatus = null;
let localAppInfo = null;
const MAX_ACTIVITY_ENTRIES = 5000;
const DASHBOARD_RECENT_LIMIT = 5;
let activityCurrentPage = 1;
let activityPageSize = 20;
let activityDateFilter = '';
let activityTypeFilter = 'all';
let activityActionFilter = 'all';
let activitySearchFilter = '';
let activityDateFromFilter = '';
let activityDateToFilter = '';
let activityCalendarViewDate = new Date();
let activityFilterDateFromCalendarViewDate = new Date();
let activityFilterDateToCalendarViewDate = new Date();
let swatchCalendarViewDate = new Date();
const detailImageLightboxState = {
    open: false,
    scale: 1,
    baseWidth: 0,
    baseHeight: 0,
    source: '',
    alt: '',
    touchStartX: 0,
    touchStartY: 0,
    touchStartTs: 0,
    touchMoved: false,
    startScrollLeft: 0,
    startScrollTop: 0,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchOriginRatioX: 0.5,
    pinchOriginRatioY: 0.5,
    pinchActive: false,
    suppressClick: false,
    reopenBlockedUntil: 0
};
let appData = {
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
};

let activeInksFilters = {
    brand: [],
    line: [],
    type: [],
    color: [],
    properties: [],
    flow: [],
    lubrication: [],
    dryTime: [],
    baseType: [],
    permanence: [],
    paper: [],
    volume: []
};
let activeInksSort = 'newest';
let activePensFilters = {
    brand: [],
    nib: [],
    nib_material: [],
    material: [],
    filling_system: [],
    color: [],
    status: []
};
let activePensSort = 'newest';
let activeSwatchesFilters = {
    brand: [],
    type: [],
    color: [],
    flow: [],
    lubrication: [],
    dryTime: [],
    baseType: [],
    permanence: [],
    lighting: [],
    nib: [],
    paper: []
};
let activeSwatchesSort = 'newest';
let searchPensQuery = '';
let searchInksQuery = '';
let searchSwatchesQuery = '';
let currentSwatchDetailInkId = null;
let currentSwatchDetailSwatchId = null;
let currentSwatchDetailSourceView = 'swatches';
let currentPenDetailPenId = null;
let currentPenDetailSourceView = 'pens';
const systemColorSchemeQuery = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
let systemColorSchemeListenerBound = false;
const ENABLE_DEMO_ACTIVITY_SEED = false;
const renderScheduler = (window.PenStationRenderScheduler && window.PenStationRenderScheduler.createRenderScheduler)
    ? window.PenStationRenderScheduler.createRenderScheduler()
    : { schedule: (fn) => fn() };
const DEFAULT_SHOWCASE_TITLE = 'Inkubator';

// Autocomplete Data Cache
let autocompleteData = {
    'ink-brand-input': [],
    'ink-name-input': [],
    'ink-line-input': [],
    'ink-cl-input': [],
    'ink-dry-time': [],
    'pen-brand-input': [],
    'pen-model-input': [],
    'pen-nib-input': [],
    'pen-nib-material-input': [],
    'pen-material-input': [],
    'pen-filling-system-input': [],
    'pen-color-input': []
};

// Keep raw runtime errors out of normal user/showcase flows.
window.onerror = function (message, source, lineno, colno, error) {
    console.error("Global Error:", error);
    try {
        if (localStorage.getItem('inkubatorDebugErrors') === '1') {
            alert(`JS Error: ${message}\nAt: ${source}:${lineno}:${colno}`);
        }
    } catch (_error) {
        // Ignore storage access failures in privacy-restricted contexts.
    }
};

function scheduleRender(fn) {
    renderScheduler.schedule(fn);
}

function normalizeCsvValues(value) {
    if (typeof value !== 'string') return [];
    return value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function normalizeInkType(value) {
    if (value === 'Bottled') return 'Bottle';
    return value;
}

function valueMatchesFilter(value, selectedFilters) {
    if (!Array.isArray(selectedFilters) || selectedFilters.length === 0) return true;
    const values = normalizeCsvValues(value);
    if (values.length === 0) return false;
    return selectedFilters.some(filterValue => values.includes(filterValue));
}

function collectUniqueFromCsv(items, key) {
    const out = new Set();
    (items || []).forEach(item => {
        normalizeCsvValues(item && item[key]).forEach(token => out.add(token));
    });
    return [...out].sort();
}

function isOrphanSwatchInk(ink) {
    return !!(ink && ink.is_orphan_swatch);
}

function getLibraryInks() {
    return (appData.inks || []).filter(ink => !isOrphanSwatchInk(ink));
}

function getAllSwatches() {
    return Array.isArray(appData.swatches) ? appData.swatches : [];
}

function getInkById(inkId) {
    if (!inkId) return null;
    return (appData.inks || []).find(ink => ink && ink.id === inkId) || null;
}

function getSwatchesForInk(inkId) {
    if (!inkId) return [];
    return getAllSwatches().filter((swatch) => swatch && swatch.ink_id === inkId);
}

function getSwatchById(swatchId) {
    if (!swatchId) return null;
    return getAllSwatches().find((swatch) => swatch && swatch.id === swatchId) || null;
}

function getSwatchTimestamp(swatch) {
    if (!swatch || typeof swatch !== 'object') return 0;
    const createdAt = Number(swatch.created_at);
    if (Number.isFinite(createdAt) && createdAt > 0) return createdAt;
    const dateRaw = swatch.swatch_date ? Date.parse(swatch.swatch_date) : NaN;
    if (Number.isFinite(dateRaw) && dateRaw > 0) return dateRaw;
    return 0;
}

function getLatestSwatchForInk(inkId) {
    const linked = getSwatchesForInk(inkId);
    if (linked.length === 0) return null;
    return [...linked].sort((a, b) => getSwatchTimestamp(b) - getSwatchTimestamp(a))[0] || null;
}

function normalizeShowcaseTitle(value) {
    if (typeof value !== 'string') return DEFAULT_SHOWCASE_TITLE;
    const trimmed = value.trim();
    return trimmed || DEFAULT_SHOWCASE_TITLE;
}

function ensureAppDataDefaults(data) {
    const safe = data && typeof data === 'object' ? data : {};
    safe.pens = Array.isArray(safe.pens) ? safe.pens : [];
    safe.inks = Array.isArray(safe.inks) ? safe.inks : [];
    safe.swatches = Array.isArray(safe.swatches) ? safe.swatches : [];
    if (safe.swatches.length === 0) {
        safe.swatches = safe.inks
            .filter((ink) => ink && ink.is_swatch && ink.image)
            .map((ink) => ({
                id: makeClientId('swatch'),
                ink_id: ink.id || '',
                image: ink.image || '',
                swatch_paper: ink.swatch_paper || '',
                swatch_nib: ink.swatch_nib || '',
                swatch_date: ink.swatch_date || '',
                swatch_lighting: ink.swatch_lighting || 'Unknown',
                swatch_notes: ink.swatch_notes || '',
                created_at: Date.now()
            }));
    }
    safe.currently_inked = Array.isArray(safe.currently_inked) ? safe.currently_inked : [];
    safe.activity_log = Array.isArray(safe.activity_log) ? safe.activity_log : [];
    const incomingPrefs = (safe.preferences && typeof safe.preferences === 'object') ? safe.preferences : {};
    const incomingShowcase = (incomingPrefs.showcase && typeof incomingPrefs.showcase === 'object')
        ? incomingPrefs.showcase
        : {};
    const incomingDefaults = (incomingPrefs.defaults && typeof incomingPrefs.defaults === 'object')
        ? incomingPrefs.defaults
        : {};
    const incomingImportExport = (incomingPrefs.import_export && typeof incomingPrefs.import_export === 'object')
        ? incomingPrefs.import_export
        : {};
    const incomingBackup = (incomingPrefs.backup && typeof incomingPrefs.backup === 'object')
        ? incomingPrefs.backup
        : {};
    const incomingShowcaseSort = (incomingShowcase.default_sort && typeof incomingShowcase.default_sort === 'object')
        ? incomingShowcase.default_sort
        : {};
    const incomingPenNibRaw = typeof incomingDefaults.pen_nib === 'string' ? incomingDefaults.pen_nib.trim() : '';
    const incomingPenNibMaterialRaw = typeof incomingDefaults.pen_nib_material === 'string'
        ? incomingDefaults.pen_nib_material.trim()
        : '';
    const incomingPenStatusRaw = String(incomingDefaults.pen_status || '').toLowerCase();
    const incomingInkTypeRaw = String(incomingDefaults.ink_type || '');
    // Migrate legacy seeded defaults to empty so Settings starts blank unless user explicitly sets values.
    const migratedPenNib = incomingPenNibRaw === 'M' ? '' : incomingPenNibRaw;
    const migratedPenNibMaterial = incomingPenNibMaterialRaw === 'Steel' ? '' : incomingPenNibMaterialRaw;
    const migratedPenStatus = incomingPenStatusRaw === 'clean' ? '' : incomingPenStatusRaw;
    const migratedInkType = incomingInkTypeRaw === 'Bottle' ? '' : incomingInkTypeRaw;
    const allowedRetention = [0, 90, 180, 365];
    const incomingRetention = Number(incomingPrefs.activity_retention_days);
    const allowedColorModes = ['light', 'dark', 'auto'];
    const allowedVerbosity = ['minimal', 'normal', 'detailed'];
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'TRY'];
    const allowedDateFormats = ['system', 'us', 'eu', 'iso'];
    const allowedInkTypes = ['', 'Bottle', 'Sample', 'Cartridge'];
    const allowedPenStatus = ['', 'clean', 'inked'];
    const allowedConflict = ['skip', 'overwrite', 'merge'];
    const allowedAutoBackupFrequencies = ['off', 'daily', 'weekly', 'monthly'];
    const allowedPensSort = ['newest', 'oldest', 'brand-asc', 'brand-desc', 'model-asc', 'model-desc'];
    const allowedInksSort = ['newest', 'oldest', 'brand-asc', 'brand-desc', 'name-asc', 'name-desc'];
    const allowedSwatchesSort = ['newest', 'oldest', 'brand-asc', 'brand-desc', 'name-asc', 'name-desc'];
    const incomingColorMode = typeof incomingPrefs.color_mode === 'string'
        ? incomingPrefs.color_mode.toLowerCase().trim()
        : 'auto';
    const incomingShowcaseColorMode = typeof incomingShowcase.color_mode === 'string'
        ? incomingShowcase.color_mode.toLowerCase().trim()
        : 'auto';
    const incomingVerbosity = typeof incomingPrefs.activity_log_verbosity === 'string'
        ? incomingPrefs.activity_log_verbosity.toLowerCase().trim()
        : 'normal';
    const incomingLogCategories = (incomingPrefs.activity_log_categories && typeof incomingPrefs.activity_log_categories === 'object')
        ? incomingPrefs.activity_log_categories
        : {};
    const incomingLogFilters = (incomingPrefs.activity_log_filters && typeof incomingPrefs.activity_log_filters === 'object')
        ? incomingPrefs.activity_log_filters
        : {};
    const parsedBackupRetention = Number(incomingBackup.retention_count);
    safe.preferences = {
        show_activity_log: typeof incomingPrefs.show_activity_log === 'boolean' ? incomingPrefs.show_activity_log : true,
        show_recent_activity: typeof incomingPrefs.show_recent_activity === 'boolean' ? incomingPrefs.show_recent_activity : true,
        open_cards_in_edit_mode: typeof incomingPrefs.open_cards_in_edit_mode === 'boolean'
            ? incomingPrefs.open_cards_in_edit_mode
            : true,
        activity_retention_days: allowedRetention.includes(incomingRetention) ? incomingRetention : 365,
        color_mode: allowedColorModes.includes(incomingColorMode) ? incomingColorMode : 'auto',
        confirm_destructive_actions: typeof incomingPrefs.confirm_destructive_actions === 'boolean'
            ? incomingPrefs.confirm_destructive_actions
            : true,
        activity_log_verbosity: allowedVerbosity.includes(incomingVerbosity) ? incomingVerbosity : 'normal',
        activity_log_filters: {
            pen_edits: typeof incomingLogFilters.pen_edits === 'boolean' ? incomingLogFilters.pen_edits : true,
            ink_edits: typeof incomingLogFilters.ink_edits === 'boolean' ? incomingLogFilters.ink_edits : true,
            swatches: typeof incomingLogFilters.swatches === 'boolean' ? incomingLogFilters.swatches : true,
            deletes: typeof incomingLogFilters.deletes === 'boolean' ? incomingLogFilters.deletes : true
        },
        activity_log_categories: {
            pen: typeof incomingLogCategories.pen === 'boolean' ? incomingLogCategories.pen : true,
            ink: typeof incomingLogCategories.ink === 'boolean' ? incomingLogCategories.ink : true,
            swatch: typeof incomingLogCategories.swatch === 'boolean' ? incomingLogCategories.swatch : true
        },
        defaults: {
            currency: allowedCurrencies.includes(String(incomingDefaults.currency || '').toUpperCase())
                ? String(incomingDefaults.currency).toUpperCase()
                : 'USD',
            date_format: allowedDateFormats.includes(String(incomingDefaults.date_format || '').toLowerCase())
                ? String(incomingDefaults.date_format).toLowerCase()
                : 'system',
            pen_nib: migratedPenNib,
            pen_nib_material: migratedPenNibMaterial,
            pen_status: allowedPenStatus.includes(migratedPenStatus)
                ? migratedPenStatus
                : '',
            ink_type: allowedInkTypes.includes(migratedInkType)
                ? migratedInkType
                : ''
        },
        import_export: {
            auto_validate_import: typeof incomingImportExport.auto_validate_import === 'boolean'
                ? incomingImportExport.auto_validate_import
                : true,
            conflict_behavior: allowedConflict.includes(String(incomingImportExport.conflict_behavior || '').toLowerCase())
                ? String(incomingImportExport.conflict_behavior).toLowerCase()
                : 'overwrite',
            include_optional_metadata: typeof incomingImportExport.include_optional_metadata === 'boolean'
                ? incomingImportExport.include_optional_metadata
                : true
        },
        backup: {
            auto_frequency: allowedAutoBackupFrequencies.includes(String(incomingBackup.auto_frequency || '').toLowerCase())
                ? String(incomingBackup.auto_frequency).toLowerCase()
                : 'daily',
            retention_count: Number.isFinite(parsedBackupRetention) && parsedBackupRetention >= 1
                ? Math.min(365, Math.round(parsedBackupRetention))
                : 30,
            include_images: typeof incomingBackup.include_images === 'boolean' ? incomingBackup.include_images : true,
            keep_replaced_images: typeof incomingBackup.keep_replaced_images === 'boolean'
                ? incomingBackup.keep_replaced_images
                : false
        },
        showcase: {
            title: normalizeShowcaseTitle(incomingShowcase.title),
            color_mode: allowedColorModes.includes(incomingShowcaseColorMode) ? incomingShowcaseColorMode : 'auto',
            show_prices: typeof incomingShowcase.show_prices === 'boolean' ? incomingShowcase.show_prices : true,
            show_pens: typeof incomingShowcase.show_pens === 'boolean' ? incomingShowcase.show_pens : true,
            show_inks: typeof incomingShowcase.show_inks === 'boolean' ? incomingShowcase.show_inks : true,
            show_swatches: typeof incomingShowcase.show_swatches === 'boolean' ? incomingShowcase.show_swatches : true,
            show_activity_filters: typeof incomingShowcase.show_activity_filters === 'boolean'
                ? incomingShowcase.show_activity_filters
                : true,
            default_sort: {
                pens: allowedPensSort.includes(String(incomingShowcaseSort.pens || '')) ? String(incomingShowcaseSort.pens) : 'newest',
                inks: allowedInksSort.includes(String(incomingShowcaseSort.inks || '')) ? String(incomingShowcaseSort.inks) : 'newest',
                swatches: allowedSwatchesSort.includes(String(incomingShowcaseSort.swatches || '')) ? String(incomingShowcaseSort.swatches) : 'newest'
            },
            show_insights: typeof incomingShowcase.show_insights === 'boolean' ? incomingShowcase.show_insights : true,
            show_charts: typeof incomingShowcase.show_charts === 'boolean' ? incomingShowcase.show_charts : true
        }
    };
    return safe;
}

function getPreferences() {
    return ensureAppDataDefaults(appData).preferences;
}

function getShowcasePreferences() {
    return getPreferences().showcase || {};
}

function getShowcaseTitle() {
    return normalizeShowcaseTitle(getShowcasePreferences().title);
}

function getDefaultsPreferences() {
    return getPreferences().defaults || {};
}

function getImportExportPreferences() {
    return getPreferences().import_export || {};
}

function getBackupPreferences() {
    return getPreferences().backup || {};
}

function shouldOpenCardsInEditMode() {
    const prefs = getPreferences();
    return typeof prefs.open_cards_in_edit_mode === 'boolean'
        ? prefs.open_cards_in_edit_mode
        : true;
}

function formatAutoBackupFrequencyLabel(value) {
    const key = String(value || '').toLowerCase();
    if (key === 'off') return 'Off';
    if (key === 'daily') return 'Daily';
    if (key === 'weekly') return 'Weekly';
    if (key === 'monthly') return 'Monthly';
    return 'Daily';
}

function refreshBackupEffectiveStatus() {
    if (!backupSettingsEffective) return;
    const backupPrefs = getBackupPreferences();
    const frequencyRaw = autoBackupFrequencySelect ? autoBackupFrequencySelect.value : backupPrefs.auto_frequency;
    const retentionRaw = backupRetentionCountInput ? backupRetentionCountInput.value : backupPrefs.retention_count;
    const keepReplacedImages = toggleBackupKeepReplacedImages
        ? !!toggleBackupKeepReplacedImages.checked
        : !!backupPrefs.keep_replaced_images;
    const frequencyLabel = formatAutoBackupFrequencyLabel(frequencyRaw);
    const retention = Math.max(1, Number(retentionRaw) || 30);
    backupSettingsEffective.textContent = `Effective: ${frequencyLabel} auto-backups, keep last ${retention}. Current referenced images are always backed up. Replaced photos ${keepReplacedImages ? 'are kept in backups.' : 'are discarded when replaced.'}`;
}

function getDefaultDateFormat() {
    return String(getDefaultsPreferences().date_format || 'system').toLowerCase();
}

function getDefaultCurrency() {
    return String(getDefaultsPreferences().currency || 'USD').toUpperCase();
}

function getShowcaseSortPreferences() {
    const sort = getShowcasePreferences().default_sort || {};
    return {
        pens: String(sort.pens || 'newest'),
        inks: String(sort.inks || 'newest'),
        swatches: String(sort.swatches || 'newest')
    };
}

function getActivityLogCategoryPreferences() {
    const prefs = getPreferences();
    const categories = (prefs.activity_log_categories && typeof prefs.activity_log_categories === 'object')
        ? prefs.activity_log_categories
        : {};
    return {
        pen: typeof categories.pen === 'boolean' ? categories.pen : true,
        ink: typeof categories.ink === 'boolean' ? categories.ink : true,
        swatch: typeof categories.swatch === 'boolean' ? categories.swatch : true
    };
}

function getActivityLogFilterPreferences() {
    const prefs = getPreferences();
    const filters = (prefs.activity_log_filters && typeof prefs.activity_log_filters === 'object')
        ? prefs.activity_log_filters
        : {};
    return {
        pen_edits: typeof filters.pen_edits === 'boolean' ? filters.pen_edits : true,
        ink_edits: typeof filters.ink_edits === 'boolean' ? filters.ink_edits : true,
        swatches: typeof filters.swatches === 'boolean' ? filters.swatches : true,
        deletes: typeof filters.deletes === 'boolean' ? filters.deletes : true
    };
}

function getActivityLogVerbosity() {
    const verbosity = String(getPreferences().activity_log_verbosity || 'normal').toLowerCase();
    return ['minimal', 'normal', 'detailed'].includes(verbosity) ? verbosity : 'normal';
}

function shouldLogActivityCategory(category) {
    const normalized = String(category || '').toLowerCase();
    const categories = getActivityLogCategoryPreferences();
    if (Object.prototype.hasOwnProperty.call(categories, normalized)) {
        return !!categories[normalized];
    }
    return true;
}

function shouldLogActivityEvent(action, category) {
    if (!shouldLogActivityCategory(category)) return false;
    const filters = getActivityLogFilterPreferences();
    const normalizedAction = String(action || '').toLowerCase();
    const normalizedCategory = String(category || '').toLowerCase();
    if (normalizedAction === 'deleted' && !filters.deletes) return false;
    if (normalizedCategory === 'swatch' && !filters.swatches) return false;
    if (normalizedCategory === 'pen' && normalizedAction === 'updated' && !filters.pen_edits) return false;
    if (normalizedCategory === 'ink' && normalizedAction === 'updated' && !filters.ink_edits) return false;
    return true;
}

function shouldHideActivityInShowcase() {
    return !isManagerApp && !getPreferences().show_activity_log;
}

function shouldHideActivityFiltersInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_activity_filters;
}

function shouldHideRecentActivityInShowcase() {
    return !isManagerApp && !getPreferences().show_recent_activity;
}

function shouldHidePensInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_pens;
}

function shouldHideInksInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_inks;
}

function shouldHideSwatchesInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_swatches;
}

function shouldHideInsightsInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_insights;
}

function shouldHideChartsInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_charts;
}

function shouldHideSettingsInShowcase() {
    return !isManagerApp;
}

function shouldHidePricesInShowcase() {
    return !isManagerApp && !getShowcasePreferences().show_prices;
}

function applyShowcaseTitleUi() {
    applyShowcaseTitlePreview(getShowcaseTitle());
}

function applyShowcaseTitlePreview(rawValue) {
    const title = normalizeShowcaseTitle(rawValue);
    if (appLogoTitle) appLogoTitle.textContent = title;
    if (!isManagerApp) {
        document.title = title;
    }
}

function getEffectiveColorMode() {
    const prefs = getPreferences();
    const showcasePrefs = getShowcasePreferences();
    const mode = isManagerApp
        ? String(prefs.color_mode || 'auto').toLowerCase()
        : String(showcasePrefs.color_mode || 'auto').toLowerCase();
    if (mode === 'light' || mode === 'dark') return mode;
    if (systemColorSchemeQuery && systemColorSchemeQuery.matches) return 'dark';
    return 'light';
}

function bindSystemColorModeListener() {
    if (!systemColorSchemeQuery || systemColorSchemeListenerBound) return;
    const onChange = () => {
        const prefs = getPreferences();
        const showcasePrefs = getShowcasePreferences();
        const appMode = String(prefs.color_mode || 'auto').toLowerCase();
        const showcaseMode = String(showcasePrefs.color_mode || 'auto').toLowerCase();
        if ((isManagerApp && appMode === 'auto') || (!isManagerApp && showcaseMode === 'auto')) {
            applyInterfacePreferences();
        }
    };
    if (typeof systemColorSchemeQuery.addEventListener === 'function') {
        systemColorSchemeQuery.addEventListener('change', onChange);
    } else if (typeof systemColorSchemeQuery.addListener === 'function') {
        systemColorSchemeQuery.addListener(onChange);
    }
    systemColorSchemeListenerBound = true;
}

function applyInterfacePreferences() {
    if (!document || !document.body) return;
    // Cleanup legacy display classes/scale from removed settings.
    document.body.classList.remove('density-compact');
    document.body.classList.remove('card-size-large');
    document.body.style.removeProperty('--ui-scale');
    const effectiveMode = getEffectiveColorMode();
    document.body.classList.toggle('theme-dark', effectiveMode === 'dark');
    document.body.classList.toggle('theme-light', effectiveMode === 'light');
    document.body.setAttribute('data-theme', effectiveMode);
    if (isManagerApp) {
        try {
            localStorage.setItem('inkubatorColorMode', String(getPreferences().color_mode || 'auto').toLowerCase());
        } catch (_error) {
            // Ignore storage failures; the loaded preferences remain authoritative.
        }
    }
}

function getPenDetailDefaultVisualBackground() {
    if (document && document.body && document.body.classList.contains('theme-dark')) {
        return 'linear-gradient(135deg, #263445 0%, #161e28 100%)';
    }
    return 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
}

function formatDateByPreference(date, options = {}) {
    const d = (date instanceof Date) ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    const mode = getDefaultDateFormat();
    if (mode === 'iso') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        if (options.monthShort || options.monthYear) {
            return `${y}-${m}`;
        }
        if (options.time) {
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${y}-${m}-${day} ${hh}:${mm}`;
        }
        return `${y}-${m}-${day}`;
    }
    const locale = mode === 'us' ? 'en-US' : mode === 'eu' ? 'en-GB' : undefined;
    if (options.time) {
        return d.toLocaleString(locale, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    if (options.monthYear) {
        return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    if (options.monthShort) {
        return d.toLocaleDateString(locale, { month: 'short' });
    }
    if (options.weekday) {
        return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return d.toLocaleDateString(locale);
}

function applyShowcaseSectionVisibility() {
    if (navPens) navPens.style.display = shouldHidePensInShowcase() ? 'none' : '';
    if (navInks) navInks.style.display = shouldHideInksInShowcase() ? 'none' : '';
    if (navSwatches) navSwatches.style.display = shouldHideSwatchesInShowcase() ? 'none' : '';
    const recentPensCard = document.getElementById('recent-pens-card');
    const recentInksCard = document.getElementById('recent-inks-card');
    const recentSwatchesCard = document.getElementById('recent-swatches-card');
    if (recentPensCard) recentPensCard.style.display = shouldHidePensInShowcase() ? 'none' : '';
    if (recentInksCard) recentInksCard.style.display = shouldHideInksInShowcase() ? 'none' : '';
    if (recentSwatchesCard) recentSwatchesCard.style.display = shouldHideSwatchesInShowcase() ? 'none' : '';
}

function applyShowcaseSortDefaults() {
    if (isManagerApp) return;
    const sortPrefs = getShowcaseSortPreferences();
    activePensSort = sortPrefs.pens;
    activeInksSort = sortPrefs.inks;
    activeSwatchesSort = sortPrefs.swatches;
}

function resolveImageSource(imagePath) {
    if (!imagePath || typeof imagePath !== 'string') return '';
    if (
        imagePath.startsWith('data:') ||
        imagePath.startsWith('blob:') ||
        imagePath.startsWith('http://') ||
        imagePath.startsWith('https://') ||
        imagePath.startsWith('file://')
    ) {
        return imagePath;
    }
    const normalized = imagePath.startsWith('images/')
        ? imagePath.slice('images/'.length)
        : imagePath.replace(/^\/+/, '');
    if (isManagerApp && managedImageDataUrlCache.has(normalized)) {
        return managedImageDataUrlCache.get(normalized);
    }
    if (isManagerApp && managerImagesBaseUrl) {
        const base = managerImagesBaseUrl.replace(/[\\/]+$/, '');
        const fullPath = `${base}/${normalized}`;
        const assetUrl = desktopAPI && typeof desktopAPI.toAssetUrl === 'function'
            ? desktopAPI.toAssetUrl(fullPath)
            : fullPath;
        const separator = assetUrl.includes('?') ? '&' : '?';
        return `${assetUrl}${separator}v=${imageAssetVersion}`;
    }
    return `images/${normalized}`;
}

function collectManagedImageReferences(data = appData) {
    const out = new Set();
    const addImage = (imagePath) => {
        if (!imagePath || typeof imagePath !== 'string') return;
        if (
            imagePath.includes('default_') ||
            imagePath.startsWith('data:') ||
            imagePath.startsWith('blob:') ||
            imagePath.startsWith('http://') ||
            imagePath.startsWith('https://') ||
            imagePath.startsWith('file://')
        ) {
            return;
        }
        const normalized = imagePath.startsWith('images/')
            ? imagePath.slice('images/'.length)
            : imagePath.replace(/^\/+/, '');
        if (normalized) out.add(normalized);
    };

    (Array.isArray(data.pens) ? data.pens : []).forEach(item => addImage(item && item.image));
    (Array.isArray(data.inks) ? data.inks : []).forEach(item => addImage(item && item.image));
    (Array.isArray(data.swatches) ? data.swatches : []).forEach(item => addImage(item && item.image));
    return [...out];
}

async function refreshManagedImageCache() {
    if (!isManagerApp || !desktopAPI || typeof desktopAPI.getImageDataUrls !== 'function') {
        managedImageDataUrlCache = new Map();
        return;
    }

    const paths = collectManagedImageReferences(appData);
    if (paths.length === 0) {
        managedImageDataUrlCache = new Map();
        return;
    }

    try {
        const result = await desktopAPI.getImageDataUrls(paths);
        managedImageDataUrlCache = new Map(Object.entries(result || {}));
        imageAssetVersion = Date.now();
    } catch (error) {
        console.warn('Managed image cache refresh failed.', error);
        managedImageDataUrlCache = new Map();
    }
}

function toFileUrl(localPath) {
    if (!localPath || typeof localPath !== 'string') return '';
    if (localPath.startsWith('file://')) return localPath;
    const normalized = localPath.replace(/\\/g, '/');
    const url = new URL('file:///');
    url.pathname = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return url.href;
}

const convertedHeicImageCache = new Map();
const convertedRemoteHeicImageCache = new Map();

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function isHeicImagePath(path) {
    if (window.inkubatorHeic && typeof window.inkubatorHeic.hasHeicExtension === 'function') {
        return window.inkubatorHeic.hasHeicExtension(path);
    }
    return /\.(heic|heif)$/i.test(String(path || '').split(/[?#]/)[0]);
}

function isManagerSelectedUploadPath(path) {
    return typeof path === 'string' && path.startsWith('docker-upload:');
}

async function getConvertedHeicImage(localPath) {
    if (!isManagerApp || !desktopAPI || !isHeicImagePath(localPath)) return null;
    if (convertedHeicImageCache.has(localPath)) return convertedHeicImageCache.get(localPath);
    if (!window.inkubatorHeic || typeof window.inkubatorHeic.convertBytesToPng !== 'function') {
        throw new Error('HEIC/HEIF support is not available in this build.');
    }
    if (typeof desktopAPI.readSelectedImageBytes !== 'function') {
        throw new Error('This app build cannot read selected HEIC/HEIF files.');
    }

    const selected = await desktopAPI.readSelectedImageBytes(localPath);
    const sourceBytes = base64ToBytes(selected && selected.base64);
    const pngBytes = await window.inkubatorHeic.convertBytesToPng(sourceBytes);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const converted = {
        bytesBase64: bytesToBase64(pngBytes),
        objectUrl: URL.createObjectURL(blob),
        sourceHint: `${localPath}.png`
    };
    convertedHeicImageCache.set(localPath, converted);
    return converted;
}

async function getConvertedRemoteHeicImage(url) {
    if (!isManagerApp || !desktopAPI || !isHeicImagePath(url)) return null;
    if (convertedRemoteHeicImageCache.has(url)) return convertedRemoteHeicImageCache.get(url);
    if (!window.inkubatorHeic || typeof window.inkubatorHeic.convertBytesToPng !== 'function') {
        throw new Error('HEIC/HEIF support is not available in this build.');
    }
    if (typeof desktopAPI.readRemoteImageBytes !== 'function') {
        throw new Error('This app build cannot read remote HEIC/HEIF images.');
    }

    const remote = await desktopAPI.readRemoteImageBytes(url);
    const sourceBytes = base64ToBytes(remote && remote.base64);
    const pngBytes = await window.inkubatorHeic.convertBytesToPng(sourceBytes);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const sourceHint = `${(remote && (remote.sourceHint || remote.sourceUrl)) || url}.png`;
    const converted = {
        bytesBase64: bytesToBase64(pngBytes),
        objectUrl: URL.createObjectURL(blob),
        sourceHint
    };
    convertedRemoteHeicImageCache.set(url, converted);
    return converted;
}

async function saveManagedImage(sourcePath, imageType, metadata) {
    if (isManagerApp && desktopAPI && isHeicImagePath(sourcePath)) {
        const converted = await getConvertedHeicImage(sourcePath);
        if (converted && typeof desktopAPI.saveImageBytes === 'function') {
            return desktopAPI.saveImageBytes(converted.bytesBase64, imageType, metadata, converted.sourceHint);
        }
    }
    return desktopAPI.saveImage(sourcePath, imageType, metadata);
}

async function saveRemoteImageUrl(url, imageType, metadata) {
    if (isManagerApp && desktopAPI && isHeicImagePath(url)) {
        const converted = await getConvertedRemoteHeicImage(url);
        if (converted && typeof desktopAPI.saveImageBytes === 'function') {
            const filename = await desktopAPI.saveImageBytes(converted.bytesBase64, imageType, metadata, converted.sourceHint);
            return { success: !!filename, filename };
        }
    }
    return desktopAPI.saveImageUrl(url, imageType, metadata);
}

async function getLocalImagePreviewSource(localPath) {
    if (!localPath || typeof localPath !== 'string') return '';
    if (!isManagerApp || !desktopAPI || typeof desktopAPI.getImagePreviewUrl !== 'function') {
        return toFileUrl(localPath);
    }
    try {
        if (isHeicImagePath(localPath)) {
            const converted = await getConvertedHeicImage(localPath);
            if (converted && converted.objectUrl) return converted.objectUrl;
        }
        return await desktopAPI.getImagePreviewUrl(localPath);
    } catch (error) {
        console.warn('Image preview generation failed, using direct file URL.', error);
        return toFileUrl(localPath);
    }
}

function canUseDetailImageLightbox() {
    if (isManagerApp || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 1024px)').matches;
}

function blockDetailImageLightboxReopen(durationMs = 420) {
    detailImageLightboxState.reopenBlockedUntil = Date.now() + Math.max(0, durationMs);
}

function isDetailImageLightboxReopenBlocked() {
    return Date.now() < Number(detailImageLightboxState.reopenBlockedUntil || 0);
}

function isDetailImageLightboxOpen() {
    return !!(detailImageLightboxState.open && detailImageLightbox && getComputedStyle(detailImageLightbox).display !== 'none');
}

function getDetailImageLightboxScaledSize(scale = detailImageLightboxState.scale) {
    const stageWidth = detailImageLightboxStage ? (detailImageLightboxStage.clientWidth || window.innerWidth || 0) : (window.innerWidth || 0);
    const stageHeight = detailImageLightboxStage ? (detailImageLightboxStage.clientHeight || window.innerHeight || 0) : (window.innerHeight || 0);
    const imageWidth = Math.max(1, Math.round(detailImageLightboxState.baseWidth * scale));
    const imageHeight = Math.max(1, Math.round(detailImageLightboxState.baseHeight * scale));
    return {
        imageWidth,
        imageHeight,
        wrapWidth: Math.max(stageWidth, imageWidth),
        wrapHeight: Math.max(stageHeight, imageHeight)
    };
}

function applyDetailImageLightboxZoom() {
    if (!detailImageLightboxWrap || !detailImageLightboxImg) return;
    const { imageWidth, imageHeight, wrapWidth, wrapHeight } = getDetailImageLightboxScaledSize();
    detailImageLightboxWrap.style.width = `${wrapWidth}px`;
    detailImageLightboxWrap.style.height = `${wrapHeight}px`;
    detailImageLightboxImg.style.width = `${imageWidth}px`;
    detailImageLightboxImg.style.height = `${imageHeight}px`;
}

function fitDetailImageLightboxToViewport() {
    if (!detailImageLightboxImg || !detailImageLightboxStage) return;
    const naturalWidth = detailImageLightboxImg.naturalWidth || 0;
    const naturalHeight = detailImageLightboxImg.naturalHeight || 0;
    if (!naturalWidth || !naturalHeight) return;

    const stageWidth = detailImageLightboxStage.clientWidth || window.innerWidth || naturalWidth;
    const stageHeight = detailImageLightboxStage.clientHeight || window.innerHeight || naturalHeight;
    const padding = 48;
    const maxWidth = Math.max(120, stageWidth - padding);
    const maxHeight = Math.max(120, stageHeight - padding);
    const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);

    detailImageLightboxState.baseWidth = Math.max(1, Math.round(naturalWidth * fitScale));
    detailImageLightboxState.baseHeight = Math.max(1, Math.round(naturalHeight * fitScale));
    detailImageLightboxState.scale = 1;
    applyDetailImageLightboxZoom();
    if (detailImageLightboxStage) {
        detailImageLightboxStage.scrollLeft = 0;
        detailImageLightboxStage.scrollTop = 0;
    }
}

function closeDetailImageLightbox() {
    if (!detailImageLightbox) return;
    blockDetailImageLightboxReopen();
    detailImageLightboxState.open = false;
    detailImageLightboxState.scale = 1;
    detailImageLightboxState.baseWidth = 0;
    detailImageLightboxState.baseHeight = 0;
    detailImageLightboxState.source = '';
    detailImageLightboxState.alt = '';
    detailImageLightboxState.touchMoved = false;
    detailImageLightboxState.pinchActive = false;
    detailImageLightboxState.suppressClick = false;
    detailImageLightbox.style.display = 'none';
    detailImageLightbox.setAttribute('aria-hidden', 'true');
    if (detailImageLightboxImg) {
        detailImageLightboxImg.onload = null;
        detailImageLightboxImg.onerror = null;
        detailImageLightboxImg.removeAttribute('src');
        detailImageLightboxImg.alt = '';
        detailImageLightboxImg.style.width = '';
        detailImageLightboxImg.style.height = '';
    }
    if (detailImageLightboxWrap) {
        detailImageLightboxWrap.style.width = '';
        detailImageLightboxWrap.style.height = '';
    }
    if (detailImageLightboxStage) {
        detailImageLightboxStage.scrollLeft = 0;
        detailImageLightboxStage.scrollTop = 0;
    }
}

function openDetailImageLightbox(source, alt = 'Image preview') {
    if (!source || !detailImageLightbox || !detailImageLightboxImg || !detailImageLightboxStage) return;
    detailImageLightboxState.open = true;
    detailImageLightboxState.source = source;
    detailImageLightboxState.alt = alt;
    detailImageLightboxState.scale = 1;
    detailImageLightboxState.pinchActive = false;
    detailImageLightboxState.touchMoved = false;
    detailImageLightboxState.suppressClick = false;
    detailImageLightbox.style.display = 'flex';
    detailImageLightbox.setAttribute('aria-hidden', 'false');
    detailImageLightboxImg.alt = alt;
    detailImageLightboxImg.onload = () => {
        fitDetailImageLightboxToViewport();
        detailImageLightboxImg.onload = null;
    };
    detailImageLightboxImg.onerror = () => {
        closeDetailImageLightbox();
    };
    detailImageLightboxImg.src = source;
}

function configureDetailImageLightboxTrigger(imageEl, source, alt) {
    if (!imageEl) return;
    const enabled = !!source && canUseDetailImageLightbox();
    imageEl.dataset.lightboxSrc = enabled ? source : '';
    imageEl.dataset.lightboxAlt = enabled ? String(alt || 'Image preview') : '';
    imageEl.classList.toggle('detail-image-fullscreen-trigger', enabled);
    if (enabled) {
        imageEl.setAttribute('role', 'button');
        imageEl.setAttribute('tabindex', '0');
        imageEl.setAttribute('aria-label', `Open ${String(alt || 'image').trim() || 'image'} full screen`);
    } else {
        imageEl.removeAttribute('role');
        imageEl.removeAttribute('tabindex');
        imageEl.removeAttribute('aria-label');
    }
}

function handleDetailImageLightboxTrigger(event) {
    const imageEl = event && event.currentTarget ? event.currentTarget : null;
    if (!imageEl) return;
    const source = String(imageEl.dataset.lightboxSrc || '').trim();
    if (!source || !canUseDetailImageLightbox() || isDetailImageLightboxReopenBlocked()) return;
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    openDetailImageLightbox(source, imageEl.dataset.lightboxAlt || 'Image preview');
}

function isManagedImagePathForDeletion(imagePath) {
    if (typeof imagePath !== 'string' || !imagePath) return false;
    if (imagePath.includes('default_')) return false;
    if (
        imagePath.startsWith('data:') ||
        imagePath.startsWith('blob:') ||
        imagePath.startsWith('http://') ||
        imagePath.startsWith('https://')
    ) {
        return false;
    }
    return true;
}

async function disposeReplacedManagedImage(imagePath) {
    if (!isManagedImagePathForDeletion(imagePath)) return;
    if (!isManagerApp || !desktopAPI) return;
    if (typeof desktopAPI.disposeReplacedImage === 'function') {
        await desktopAPI.disposeReplacedImage(imagePath);
        return;
    }
    if (typeof desktopAPI.deleteImage === 'function') {
        await desktopAPI.deleteImage(imagePath);
    }
}

function getActivityRetentionDays() {
    const retention = Number(getPreferences().activity_retention_days);
    return [0, 90, 180, 365].includes(retention) ? retention : 365;
}

function applyActivityRetention() {
    const retentionDays = getActivityRetentionDays();
    if (retentionDays === 0) return false;
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const before = (appData.activity_log || []).length;
    appData.activity_log = (appData.activity_log || []).filter(entry => (entry.timestamp || 0) >= cutoff);
    return before !== appData.activity_log.length;
}

function findPenById(penId) {
    return (appData.pens || []).find(p => p.id === penId) || null;
}

function findInkById(inkId) {
    return (appData.inks || []).find(i => i.id === inkId) || null;
}

function formatPenName(pen) {
    if (!pen) return 'Unknown pen';
    const name = [pen.brand || '', pen.model || ''].join(' ').trim();
    return name || 'Unnamed pen';
}

function normalizePenIdentityKey(penLike) {
    if (!penLike || typeof penLike !== 'object') return '';
    const brand = String(penLike.brand || penLike.pen_brand || '').trim().toLowerCase();
    const model = String(penLike.model || penLike.pen_model || '').trim().toLowerCase();
    if (!brand && !model) return '';
    return `${brand}::${model}`;
}

function getPenDuplicateNameCounts() {
    const counts = new Map();
    (appData.pens || []).forEach((pen) => {
        const key = normalizePenIdentityKey(pen);
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
}

function normalizePenColorLabel(value) {
    return String(value || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ');
}

function getPenColorLabel(penLike) {
    if (!penLike || typeof penLike !== 'object') return '';
    return normalizePenColorLabel(penLike.color || penLike.pen_color || '');
}

function isValidHexColor(value) {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

function getPenColorHex(penLike) {
    if (!penLike || typeof penLike !== 'object') return '';
    const palette = Array.isArray(penLike.hex_colors) ? penLike.hex_colors : [];
    const first = String(palette[0] || penLike.hex_color || '').trim();
    if (isValidHexColor(first)) return first;

    const metaPalette = Array.isArray(penLike.pen_hex_colors) ? penLike.pen_hex_colors : [];
    const metaFirst = String(metaPalette[0] || penLike.pen_color_hex || '').trim();
    if (isValidHexColor(metaFirst)) return metaFirst;
    return '';
}

function buildPenActivityMetadata(pen, extraMetadata = {}) {
    const metadata = (extraMetadata && typeof extraMetadata === 'object')
        ? { ...extraMetadata }
        : {};
    if (!pen || typeof pen !== 'object') return metadata;

    const displayName = formatPenName(pen);
    const brand = String(pen.brand || '').trim();
    const model = String(pen.model || '').trim();
    const nameKey = normalizePenIdentityKey(pen);
    const colorLabel = getPenColorLabel(pen);
    const colorHex = getPenColorHex(pen);
    const duplicateCounts = getPenDuplicateNameCounts();
    const nib = String(pen.nib || '').trim();
    const nibMaterial = String(pen.nib_material || '').trim();
    const fillingSystem = String(pen.filling_system || '').trim();

    if (displayName && displayName !== 'Unnamed pen') metadata.pen_display_name = displayName;
    if (brand) metadata.pen_brand = brand;
    if (model) metadata.pen_model = model;
    if (nameKey) {
        metadata.pen_name_key = nameKey;
        metadata.pen_duplicate_count_at_log = Math.max(1, duplicateCounts.get(nameKey) || 1);
    }
    if (colorLabel) metadata.pen_color = colorLabel;
    if (colorHex) metadata.pen_color_hex = colorHex;
    if (nib) metadata.pen_nib = nib;
    if (nibMaterial) metadata.pen_nib_material = nibMaterial;
    if (fillingSystem) metadata.pen_filling_system = fillingSystem;
    return metadata;
}

function buildInkActivityMetadata(ink, extraMetadata = {}) {
    const metadata = (extraMetadata && typeof extraMetadata === 'object')
        ? { ...extraMetadata }
        : {};
    if (!ink || typeof ink !== 'object') return metadata;

    const displayName = formatInkName(ink);
    const type = String(ink.type || '').trim();
    const amount = String(ink.amount || '').trim();
    const colorCount = Array.isArray(ink.hex_colors)
        ? ink.hex_colors.map((value) => String(value || '').trim()).filter(Boolean).length
        : 0;

    if (displayName && displayName !== 'Unnamed ink') metadata.ink_display_name = displayName;
    if (type) metadata.ink_type = type;
    if (amount) metadata.ink_amount = amount;
    if (colorCount > 0) metadata.ink_color_count = colorCount;
    return metadata;
}

function buildSwatchActivityMetadata(swatch, linkedInk = null, extraMetadata = {}) {
    const metadata = (extraMetadata && typeof extraMetadata === 'object')
        ? { ...extraMetadata }
        : {};
    const inkDisplayName = linkedInk ? formatInkName(linkedInk) : '';

    if (inkDisplayName && inkDisplayName !== 'Unnamed ink') {
        metadata.swatch_ink_display_name = inkDisplayName;
    }
    if (!swatch || typeof swatch !== 'object') return metadata;

    const paper = String(swatch.swatch_paper || '').trim();
    const nib = String(swatch.swatch_nib || '').trim();
    const lighting = String(swatch.swatch_lighting || '').trim();

    if (paper) metadata.swatch_paper = paper;
    if (nib) metadata.swatch_nib = nib;
    if (lighting) metadata.swatch_lighting = lighting;
    return metadata;
}

function getActivityPenSource(entry) {
    if (!entry || String(entry.category || '').toLowerCase() !== 'pen') return null;
    const metadata = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
    const currentPen = entry.entity_id ? findPenById(entry.entity_id) : null;
    if (metadata.pen_display_name || metadata.pen_name_key || metadata.pen_brand || metadata.pen_model) {
        return metadata;
    }
    return currentPen || metadata;
}

function getActivityPenDifferentiator(entry, penDuplicateCounts = null) {
    if (!entry || String(entry.category || '').toLowerCase() !== 'pen') return null;

    const metadata = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
    const source = getActivityPenSource(entry);
    const currentPen = entry.entity_id ? findPenById(entry.entity_id) : null;
    const identityKey = String(
        metadata.pen_name_key
        || (currentPen ? normalizePenIdentityKey(currentPen) : '')
        || normalizePenIdentityKey(source)
    );
    if (!identityKey) return null;

    const counts = penDuplicateCounts || getPenDuplicateNameCounts();
    const currentCount = counts.get(identityKey) || 0;
    const historicalCount = Number(metadata.pen_duplicate_count_at_log) || 0;
    if (Math.max(currentCount, historicalCount) <= 1) return null;

    const colorLabel = getPenColorLabel(source);
    if (!colorLabel) return null;

    const brand = String(source.brand || source.pen_brand || '').trim();
    const model = String(source.model || source.pen_model || '').trim();
    return {
        colorLabel,
        colorHex: getPenColorHex(source),
        searchText: [brand, model, colorLabel].filter(Boolean).join(' ')
    };
}

function getActivityPenDisplayName(entry) {
    const source = getActivityPenSource(entry);
    if (!source) return '';
    if (source.pen_display_name) return String(source.pen_display_name).trim();
    return formatPenName({
        brand: source.brand || source.pen_brand || '',
        model: source.model || source.pen_model || ''
    });
}

function stripActivityMetadataSuffix(message) {
    return String(message || '')
        .replace(/\s*\[meta:[^\]]*\]\s*$/i, '')
        .trim();
}

function stripActivityTerminalPeriod(message) {
    return String(message || '').trim().replace(/\.$/, '').trim();
}

function splitActivityMessageSummaryAndDetail(message) {
    const normalized = stripActivityTerminalPeriod(stripActivityMetadataSuffix(message));
    if (!normalized) {
        return { summary: '', detail: '' };
    }

    const match = normalized.match(/^(.*?)(?:\s+\(([^()]*)\))$/);
    if (!match) {
        return { summary: normalized, detail: '' };
    }

    return {
        summary: String(match[1] || '').trim(),
        detail: String(match[2] || '').trim()
    };
}

function formatInkName(ink) {
    if (!ink) return 'Unknown ink';
    const name = [ink.brand || '', ink.name || ''].join(' ').trim();
    return name || 'Unnamed ink';
}

function getActivityInkSource(entry) {
    if (!entry) return null;
    const metadata = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
    const currentInk = entry.entity_id ? findInkById(entry.entity_id) : null;
    if (metadata.ink_display_name || metadata.ink_type || metadata.ink_amount || metadata.ink_color_count) return metadata;
    if (currentInk) return currentInk;
    return null;
}

function getActivityInkDisplayName(entry) {
    const source = getActivityInkSource(entry);
    if (!source) return '';
    if (source.ink_display_name) return String(source.ink_display_name).trim();
    return formatInkName(source);
}

function getActivitySwatchLinkedInkDisplayName(entry) {
    if (!entry || String(entry.category || '').toLowerCase() !== 'swatch') return '';
    const metadata = (entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
    if (metadata.swatch_ink_display_name) return String(metadata.swatch_ink_display_name).trim();

    const swatch = entry.entity_id ? getSwatchById(entry.entity_id) : null;
    if (swatch) {
        const linkedInk = getInkById(swatch.ink_id);
        if (linkedInk) return formatInkName(linkedInk);
    }

    const ink = entry.entity_id ? findInkById(entry.entity_id) : null;
    return ink ? formatInkName(ink) : '';
}

function getActivityPenInkNames(entry) {
    const metadata = (entry && entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};
    const previousInkName = String(metadata.previous_ink_name || '').trim();
    const newInkName = String(metadata.new_ink_name || '').trim();
    const previousInk = metadata.previous_ink_id ? findInkById(metadata.previous_ink_id) : null;
    const newInk = metadata.new_ink_id ? findInkById(metadata.new_ink_id) : null;

    let currentInkName = '';
    if (entry && entry.entity_id) {
        const currentLink = (appData.currently_inked || []).find((item) => item.pen_id === entry.entity_id);
        if (currentLink) {
            const ink = findInkById(currentLink.ink_id);
            if (ink) currentInkName = formatInkName(ink);
        }
    }

    return {
        previousInkName: previousInkName || (previousInk ? formatInkName(previousInk) : ''),
        newInkName: newInkName || (newInk ? formatInkName(newInk) : currentInkName)
    };
}

function formatMinimalActivityMessage(entry) {
    const category = String(entry?.category || 'system').toLowerCase() || 'system';
    const action = String(entry?.action || 'updated').toLowerCase() || 'updated';
    return `${category}: ${action}`;
}

function isStoredMinimalActivityMessage(message, entry) {
    return String(message || '').trim().toLowerCase() === formatMinimalActivityMessage(entry);
}

function buildActivityFallbackMessage(entry) {
    if (!entry || typeof entry !== 'object') return 'Activity recorded';

    const category = String(entry.category || '').toLowerCase();
    const action = String(entry.action || '').toLowerCase();
    const penName = getActivityPenDisplayName(entry);
    const inkName = getActivityInkDisplayName(entry);
    const swatchInkName = getActivitySwatchLinkedInkDisplayName(entry);
    const { previousInkName, newInkName } = getActivityPenInkNames(entry);

    if (category === 'pen') {
        if (action === 'created' && penName) return `Added pen: ${penName}`;
        if (action === 'updated' && penName) return `Updated pen: ${penName}`;
        if (action === 'deleted' && penName) return `Deleted pen: ${penName}`;
        if (action === 'inked' && penName) return newInkName ? `Inked ${penName} with ${newInkName}` : `Inked ${penName}`;
        if (action === 'cleaned' && penName) return `Emptied ${penName}`;
        if (action === 'reinked' && penName) return newInkName ? `Changed ink in ${penName} to ${newInkName}` : `Changed ink in ${penName}`;
    }

    if (category === 'ink') {
        if (action === 'created' && inkName) return `Added ink: ${inkName}`;
        if (action === 'updated' && inkName) return `Updated ink: ${inkName}`;
        if (action === 'deleted' && inkName) return `Deleted ink: ${inkName}`;
    }

    if (category === 'swatch') {
        if (action === 'created' && swatchInkName) return `Added swatch for ${swatchInkName}`;
        if (action === 'updated' && swatchInkName) return `Updated swatch for ${swatchInkName}`;
        if (action === 'deleted' && swatchInkName) return `Deleted swatch for ${swatchInkName}`;
    }

    return stripActivityTerminalPeriod(stripActivityMetadataSuffix(entry.message || 'Activity recorded')) || 'Activity recorded';
}

function resolveActivityNormalMessage(entry) {
    const stored = stripActivityTerminalPeriod(stripActivityMetadataSuffix(entry?.message || ''));
    if (!stored) return buildActivityFallbackMessage(entry);
    if (isStoredMinimalActivityMessage(stored, entry)) {
        return buildActivityFallbackMessage(entry);
    }
    return stored;
}

function pushUniqueActivityDetail(details, value) {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (details.some((item) => item.toLowerCase() === key)) return;
    details.push(normalized);
}

function buildDetailedActivityText(entry, penDiff, messageParts) {
    const details = [];
    const category = String(entry?.category || '').toLowerCase();
    const action = String(entry?.action || '').toLowerCase();
    const parsedDetail = String(messageParts?.detail || '').trim();
    const metadata = (entry && entry.metadata && typeof entry.metadata === 'object') ? entry.metadata : {};

    if (parsedDetail && action === 'updated') {
        pushUniqueActivityDetail(details, `Changed: ${parsedDetail}`);
    }

    if (category === 'pen') {
        const source = getActivityPenSource(entry) || metadata;
        const colorLabel = penDiff?.colorLabel || getPenColorLabel(source);
        const nib = String(source.nib || source.pen_nib || metadata.pen_nib || '').trim();
        const nibMaterial = String(source.nib_material || source.pen_nib_material || metadata.pen_nib_material || '').trim();
        const fillingSystem = String(source.filling_system || source.pen_filling_system || metadata.pen_filling_system || '').trim();
        const { previousInkName, newInkName } = getActivityPenInkNames(entry);

        if (action === 'inked' && newInkName) {
            pushUniqueActivityDetail(details, `Ink: ${newInkName}`);
        } else if (action === 'reinked') {
            if (previousInkName) pushUniqueActivityDetail(details, `Previous ink: ${previousInkName}`);
            if (newInkName) pushUniqueActivityDetail(details, `New ink: ${newInkName}`);
        } else if (action === 'cleaned' && previousInkName) {
            pushUniqueActivityDetail(details, `Removed ink: ${previousInkName}`);
        }

        if (colorLabel) pushUniqueActivityDetail(details, `Color: ${colorLabel}`);
        if (nib) {
            pushUniqueActivityDetail(details, nibMaterial ? `Nib: ${nib} (${nibMaterial})` : `Nib: ${nib}`);
        }
        if (fillingSystem) pushUniqueActivityDetail(details, `Fill: ${fillingSystem}`);
    } else if (category === 'ink') {
        const source = getActivityInkSource(entry) || metadata;
        const type = String(source.type || source.ink_type || metadata.ink_type || '').trim();
        const amount = String(source.amount || source.ink_amount || metadata.ink_amount || '').trim();
        const colorCount = Array.isArray(source.hex_colors)
            ? source.hex_colors.map((value) => String(value || '').trim()).filter(Boolean).length
            : Number(source.ink_color_count || metadata.ink_color_count || 0);

        if (type) pushUniqueActivityDetail(details, `Type: ${type}`);
        if (amount) pushUniqueActivityDetail(details, `Amount: ${amount}`);
        if (colorCount > 0) pushUniqueActivityDetail(details, `Colors: ${colorCount}`);
    } else if (category === 'swatch') {
        const swatch = entry?.entity_id ? getSwatchById(entry.entity_id) : null;
        const paper = String((swatch && swatch.swatch_paper) || metadata.swatch_paper || '').trim();
        const nib = String((swatch && swatch.swatch_nib) || metadata.swatch_nib || '').trim();
        const lighting = String((swatch && swatch.swatch_lighting) || metadata.swatch_lighting || '').trim();
        const count = Number(metadata.swatch_count || 0);

        if (count > 0) pushUniqueActivityDetail(details, `Count: ${count}`);
        if (paper) pushUniqueActivityDetail(details, `Paper: ${paper}`);
        if (nib) pushUniqueActivityDetail(details, `Nib: ${nib}`);
        if (lighting) pushUniqueActivityDetail(details, `Lighting: ${lighting}`);
    }

    if (parsedDetail && details.length === 0) {
        pushUniqueActivityDetail(details, parsedDetail);
    }

    return details.join(' • ');
}

function injectActivityPenDot(message, entry, penDiff) {
    const safeMessage = escapeHtml(message);
    if (!penDiff) return safeMessage;

    const penName = getActivityPenDisplayName(entry);
    const safePenName = escapeHtml(penName);
    if (!safePenName || !safeMessage.includes(safePenName)) return safeMessage;

    const dotStyle = penDiff.colorHex
        ? ` style="--activity-pen-diff-color: ${penDiff.colorHex};"`
        : '';
    const dotLabel = escapeHtml(penDiff.colorLabel || 'Pen color');
    const penDot = `<span class="activity-pen-inline-dot"${dotStyle} role="img" aria-label="${dotLabel}" title="${dotLabel}"></span>`;
    return safeMessage.replace(safePenName, `${safePenName}${penDot}`);
}

function renderActivityMessage(entry, penDiff) {
    const verbosity = getActivityLogVerbosity();

    if (verbosity === 'minimal') {
        return injectActivityPenDot(formatMinimalActivityMessage(entry), entry, penDiff);
    }

    const normalMessage = resolveActivityNormalMessage(entry);
    if (verbosity !== 'detailed') {
        return injectActivityPenDot(normalMessage, entry, penDiff);
    }

    const messageParts = splitActivityMessageSummaryAndDetail(normalMessage);
    const primaryMessage = messageParts.summary || normalMessage || 'Activity recorded';
    const detailText = buildDetailedActivityText(entry, penDiff, messageParts);
    const primaryHtml = injectActivityPenDot(primaryMessage, entry, penDiff);
    if (!detailText) return primaryHtml;

    return `<span class="activity-logbook-message-primary">${primaryHtml}</span><span class="activity-logbook-message-detail">${escapeHtml(detailText)}</span>`;
}

function cloneEntityForDiff(entity, arrayKeys = []) {
    if (!entity || typeof entity !== 'object') return {};
    const clone = { ...entity };
    arrayKeys.forEach((key) => {
        clone[key] = Array.isArray(entity[key]) ? [...entity[key]] : [];
    });
    return clone;
}

function normalizeDiffScalar(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeDiffArray(value) {
    if (!Array.isArray(value)) return '';
    return value
        .map(item => normalizeDiffScalar(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .join('|');
}

function getChangedFieldLabels(before, after, fields) {
    if (!before || !after || !Array.isArray(fields)) return [];
    const changed = [];
    fields.forEach((field) => {
        const key = field.key;
        const label = field.label || key;
        const mode = field.mode || 'scalar';
        const beforeValue = mode === 'array'
            ? normalizeDiffArray(before[key])
            : normalizeDiffScalar(before[key]);
        const afterValue = mode === 'array'
            ? normalizeDiffArray(after[key])
            : normalizeDiffScalar(after[key]);
        if (beforeValue !== afterValue) {
            changed.push(label);
        }
    });
    return changed;
}

function formatChangedFieldsCompact(labels, maxVisible = 4) {
    if (!Array.isArray(labels) || labels.length === 0) return '';
    if (labels.length <= maxVisible) return labels.join(', ');
    const head = labels.slice(0, maxVisible).join(', ');
    return `${head} (+${labels.length - maxVisible} more)`;
}

function formatActivityDateLabel(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (timestamp >= startOfDay) return 'Today';
    if (timestamp >= (startOfDay - oneDay)) return 'Yesterday';
    return formatDateByPreference(d, { weekday: true });
}

function formatActivityTimestamp(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return 'Unknown time';
    return formatDateByPreference(d, { time: true });
}

function toIsoLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseIsoLocalDate(iso) {
    if (typeof iso !== 'string' || !iso) return null;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function closeActivityCalendar() {
    if (!activityCalendarPopover) return;
    activityCalendarPopover.classList.remove('open');
    if (activityDatePickerToggle) {
        activityDatePickerToggle.classList.remove('open');
        activityDatePickerToggle.blur();
    }
}

function openActivityCalendar() {
    if (!activityCalendarPopover) return;
    const selected = parseIsoLocalDate(activityDateFilter);
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    activityCalendarViewDate = selected && selected <= todayMidnight ? selected : today;
    renderActivityCalendar();
    activityCalendarPopover.classList.add('open');
    if (activityDatePickerToggle) activityDatePickerToggle.classList.add('open');
}

function renderActivityCalendar() {
    if (!activityCalendarGrid || !activityCalendarMonthLabel) return;
    const year = activityCalendarViewDate.getFullYear();
    const month = activityCalendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const selectedIso = activityDateFilter || '';
    const todayIso = toIsoLocalDate(new Date());
    const todayDate = new Date();
    const todayMidnight = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const todayMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).getTime();
    const viewMonthStart = new Date(year, month, 1).getTime();
    const eventDateSet = new Set((appData.activity_log || []).map(entry => {
        const ts = typeof entry.timestamp === 'number' ? entry.timestamp : 0;
        return toIsoLocalDate(new Date(ts));
    }));

    activityCalendarMonthLabel.textContent = formatDateByPreference(firstDay, { monthYear: true });
    if (activityCalendarNext) {
        activityCalendarNext.disabled = viewMonthStart >= todayMonthStart;
    }

    const cells = [];
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
        const dayNum = prevMonthDays - i;
        const date = new Date(year, month - 1, dayNum);
        cells.push({ date, muted: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        cells.push({ date, muted: false });
    }
    while (cells.length % 7 !== 0) {
        const dayNum = cells.length - (startWeekday + daysInMonth) + 1;
        const date = new Date(year, month + 1, dayNum);
        cells.push({ date, muted: true });
    }

    activityCalendarGrid.innerHTML = cells.map(({ date, muted }) => {
        const iso = toIsoLocalDate(date);
        const isFuture = date > todayMidnight;
        const cls = [
            'activity-calendar-day',
            muted ? 'muted' : '',
            isFuture ? 'future' : '',
            iso === todayIso ? 'today' : '',
            eventDateSet.has(iso) ? 'has-events' : '',
            iso === selectedIso ? 'selected' : ''
        ].filter(Boolean).join(' ');
        return `<button class="${cls}" data-calendar-date="${iso}" type="button" ${isFuture ? 'disabled' : ''}>${date.getDate()}</button>`;
    }).join('');
}

function setActivityFilterDateInputValue(which, iso = '') {
    if (which === 'from') {
        if (activityFilterDateFromInput) activityFilterDateFromInput.value = iso || '';
        if (activityFilterDateFromToggle) activityFilterDateFromToggle.classList.toggle('active', !!iso);
        return;
    }
    if (which === 'to') {
        if (activityFilterDateToInput) activityFilterDateToInput.value = iso || '';
        if (activityFilterDateToToggle) activityFilterDateToToggle.classList.toggle('active', !!iso);
    }
}

function closeActivityFilterDateCalendar(which) {
    if (which === 'from') {
        if (activityFilterDateFromPopover) activityFilterDateFromPopover.classList.remove('open');
        if (activityFilterDateFromToggle) {
            activityFilterDateFromToggle.classList.remove('open');
            activityFilterDateFromToggle.blur();
        }
        return;
    }
    if (which === 'to') {
        if (activityFilterDateToPopover) activityFilterDateToPopover.classList.remove('open');
        if (activityFilterDateToToggle) {
            activityFilterDateToToggle.classList.remove('open');
            activityFilterDateToToggle.blur();
        }
    }
}

function closeActivityFilterDateCalendars() {
    closeActivityFilterDateCalendar('from');
    closeActivityFilterDateCalendar('to');
}

function openActivityFilterDateCalendar(which) {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (which === 'from') {
        if (!activityFilterDateFromPopover) return;
        const selected = parseIsoLocalDate(activityDateFromFilter);
        activityFilterDateFromCalendarViewDate = selected && selected <= todayMidnight ? selected : today;
        renderActivityFilterDateCalendar('from');
        closeActivityFilterDateCalendar('to');
        closeActivityCalendar();
        activityFilterDateFromPopover.classList.add('open');
        if (activityFilterDateFromToggle) activityFilterDateFromToggle.classList.add('open');
        return;
    }
    if (which === 'to') {
        if (!activityFilterDateToPopover) return;
        const selected = parseIsoLocalDate(activityDateToFilter);
        activityFilterDateToCalendarViewDate = selected && selected <= todayMidnight ? selected : today;
        renderActivityFilterDateCalendar('to');
        closeActivityFilterDateCalendar('from');
        closeActivityCalendar();
        activityFilterDateToPopover.classList.add('open');
        if (activityFilterDateToToggle) activityFilterDateToToggle.classList.add('open');
    }
}

function renderActivityFilterDateCalendar(which) {
    const isFrom = which === 'from';
    const grid = isFrom ? activityFilterDateFromGrid : activityFilterDateToGrid;
    const monthLabel = isFrom ? activityFilterDateFromMonthLabel : activityFilterDateToMonthLabel;
    const currentIso = isFrom ? activityDateFromFilter : activityDateToFilter;
    const viewDate = isFrom ? activityFilterDateFromCalendarViewDate : activityFilterDateToCalendarViewDate;
    const nextBtn = isFrom ? activityFilterDateFromNext : activityFilterDateToNext;

    if (!grid || !monthLabel || !viewDate) return;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const todayIso = toIsoLocalDate(new Date());
    const todayDate = new Date();
    const todayMidnight = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const todayMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).getTime();
    const viewMonthStart = new Date(year, month, 1).getTime();
    const eventDateSet = new Set((appData.activity_log || []).map(entry => {
        const ts = typeof entry.timestamp === 'number' ? entry.timestamp : 0;
        return toIsoLocalDate(new Date(ts));
    }));

    monthLabel.textContent = formatDateByPreference(firstDay, { monthYear: true });
    if (nextBtn) {
        nextBtn.disabled = viewMonthStart >= todayMonthStart;
    }

    const cells = [];
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
        const dayNum = prevMonthDays - i;
        const date = new Date(year, month - 1, dayNum);
        cells.push({ date, muted: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        cells.push({ date, muted: false });
    }
    while (cells.length % 7 !== 0) {
        const dayNum = cells.length - (startWeekday + daysInMonth) + 1;
        const date = new Date(year, month + 1, dayNum);
        cells.push({ date, muted: true });
    }

    const attr = isFrom ? 'data-activity-filter-date-from' : 'data-activity-filter-date-to';
    grid.innerHTML = cells.map(({ date, muted }) => {
        const iso = toIsoLocalDate(date);
        const isFuture = date > todayMidnight;
        const cls = [
            'activity-calendar-day',
            muted ? 'muted' : '',
            isFuture ? 'future' : '',
            iso === todayIso ? 'today' : '',
            eventDateSet.has(iso) ? 'has-events' : '',
            iso === currentIso ? 'selected' : ''
        ].filter(Boolean).join(' ');
        return `<button class="${cls}" ${attr}="${iso}" type="button" ${isFuture ? 'disabled' : ''}>${date.getDate()}</button>`;
    }).join('');
}

function setSwatchDateInputValue(iso = '') {
    const input = document.getElementById('swatch-date-input');
    if (input) input.value = iso || '';
    if (swatchDatePickerToggle) {
        swatchDatePickerToggle.classList.toggle('active', !!iso);
    }
}

function closeSwatchCalendar() {
    if (!swatchCalendarPopover) return;
    swatchCalendarPopover.classList.remove('open');
    if (swatchDatePickerToggle) {
        swatchDatePickerToggle.classList.remove('open');
        swatchDatePickerToggle.blur();
    }
}

function openSwatchCalendar() {
    if (!swatchCalendarPopover) return;
    const selected = parseIsoLocalDate(document.getElementById('swatch-date-input')?.value || '');
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    swatchCalendarViewDate = selected && selected <= todayMidnight ? selected : today;
    renderSwatchCalendar();
    swatchCalendarPopover.classList.add('open');
    if (swatchDatePickerToggle) swatchDatePickerToggle.classList.add('open');
}

function renderSwatchCalendar() {
    if (!swatchCalendarGrid || !swatchCalendarMonthLabel) return;
    const year = swatchCalendarViewDate.getFullYear();
    const month = swatchCalendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const selectedIso = document.getElementById('swatch-date-input')?.value || '';
    const todayIso = toIsoLocalDate(new Date());
    const todayDate = new Date();
    const todayMidnight = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const todayMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).getTime();
    const viewMonthStart = new Date(year, month, 1).getTime();
    const eventDateSet = new Set((getAllSwatches() || []).map((swatch) => {
        const iso = String(swatch && swatch.swatch_date ? swatch.swatch_date : '').trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
    }).filter(Boolean));

    swatchCalendarMonthLabel.textContent = formatDateByPreference(firstDay, { monthYear: true });
    if (swatchCalendarNext) {
        swatchCalendarNext.disabled = viewMonthStart >= todayMonthStart;
    }

    const cells = [];
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
        const dayNum = prevMonthDays - i;
        const date = new Date(year, month - 1, dayNum);
        cells.push({ date, muted: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        cells.push({ date, muted: false });
    }
    while (cells.length % 7 !== 0) {
        const dayNum = cells.length - (startWeekday + daysInMonth) + 1;
        const date = new Date(year, month + 1, dayNum);
        cells.push({ date, muted: true });
    }

    swatchCalendarGrid.innerHTML = cells.map(({ date, muted }) => {
        const iso = toIsoLocalDate(date);
        const isFuture = date > todayMidnight;
        const cls = [
            'activity-calendar-day',
            muted ? 'muted' : '',
            isFuture ? 'future' : '',
            iso === todayIso ? 'today' : '',
            eventDateSet.has(iso) ? 'has-events' : '',
            iso === selectedIso ? 'selected' : ''
        ].filter(Boolean).join(' ');
        return `<button class="${cls}" data-swatch-calendar-date="${iso}" type="button" ${isFuture ? 'disabled' : ''}>${date.getDate()}</button>`;
    }).join('');
}

function getRecentActivityIcon(entry) {
    const action = (entry && entry.action ? entry.action : '').toLowerCase();
    const category = (entry && entry.category ? entry.category : '').toLowerCase();

    if (action === 'inked') return { icon: 'ph-drop', bg: '#e9f4ff', border: '#c8ddf5', color: '#2f6ea7' };
    if (action === 'reinked') return { icon: 'ph-arrows-clockwise', bg: '#eef6ff', border: '#d0e3fa', color: '#436d9f' };
    if (action === 'cleaned') return { icon: 'ph-broom', bg: '#f3f4f6', border: '#dde1e7', color: '#5f6772' };
    if (action === 'deleted') return { icon: 'ph-trash', bg: '#fff1f1', border: '#f2d6d6', color: '#b45858' };

    if (category === 'pen') return { icon: 'ph-pen-nib', bg: '#fff6e8', border: '#f1e0be', color: '#8a6a28' };
    if (category === 'ink') return { icon: 'ph-drop-half-bottom', bg: '#ecf9f2', border: '#cae9d9', color: '#2f7d57' };
    if (category === 'swatch') return { icon: 'ph-palette', bg: '#f4efff', border: '#ddd1f5', color: '#6a56a1' };

    if (action === 'created') return { icon: 'ph-plus-circle', bg: '#ecf9f2', border: '#cae9d9', color: '#2f7d57' };
    if (action === 'updated') return { icon: 'ph-pencil-simple-line', bg: '#eef6ff', border: '#d0e3fa', color: '#436d9f' };

    return { icon: 'ph-clock-counter-clockwise', bg: '#f2f5f7', border: '#d7e0e7', color: '#52687a' };
}

function logActivity(action, category, message, options = {}) {
    if (!shouldLogActivityEvent(action, category)) return;
    const entry = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: typeof options.timestamp === 'number' ? options.timestamp : Date.now(),
        action: action || 'updated',
        category: category || 'system',
        message: message || 'Activity recorded',
        entity_id: options.entityId || '',
        metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {}
    };
    appData.activity_log = [entry, ...(appData.activity_log || [])].slice(0, MAX_ACTIVITY_ENTRIES);
    applyActivityRetention();
}

function getRandomItem(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)] || null;
}

function maybeSeedDemoActivityLogs() {
    if (!ENABLE_DEMO_ACTIVITY_SEED) return false;
    const existingCount = (appData.activity_log || []).length;
    if (existingCount >= 20) return false;

    const pens = appData.pens || [];
    const inks = getLibraryInks();
    const now = Date.now();
    const templates = [
        () => {
            const pen = getRandomItem(pens);
            return { action: 'created', category: 'pen', message: `Added pen: ${formatPenName(pen)}.` };
        },
        () => {
            const ink = getRandomItem(inks);
            return { action: 'created', category: 'ink', message: `Added ink: ${formatInkName(ink)}.` };
        },
        () => {
            const pen = getRandomItem(pens);
            const ink = getRandomItem(inks);
            return { action: 'inked', category: 'pen', message: `Inked ${formatPenName(pen)} with ${formatInkName(ink)}.` };
        },
        () => {
            const pen = getRandomItem(pens);
            const ink = getRandomItem(inks);
            return { action: 'reinked', category: 'pen', message: `Changed ink in ${formatPenName(pen)} to ${formatInkName(ink)}.` };
        },
        () => {
            const pen = getRandomItem(pens);
            return { action: 'cleaned', category: 'pen', message: `Emptied ${formatPenName(pen)} and cleaned it.` };
        },
        () => {
            const ink = getRandomItem(inks);
            return { action: 'created', category: 'swatch', message: `Added swatch for ${formatInkName(ink)}.` };
        },
        () => {
            const ink = getRandomItem(inks);
            return { action: 'updated', category: 'ink', message: `Updated notes for ${formatInkName(ink)}.` };
        },
        () => {
            const pen = getRandomItem(pens);
            return { action: 'updated', category: 'pen', message: `Updated details for ${formatPenName(pen)}.` };
        }
    ];

    const totalToSeed = 24;
    for (let i = 0; i < totalToSeed; i += 1) {
        const templateFn = templates[i % templates.length];
        const payload = templateFn();
        const ts = now - (i * 1000 * 60 * 90) - Math.floor(Math.random() * 1000 * 60 * 30);
        logActivity(payload.action, payload.category, payload.message, {
            timestamp: ts,
            metadata: { demo: true }
        });
    }
    return true;
}

function scheduleUiRefresh(options = {}) {
    const {
        dashboard = false,
        stats = false,
        recent = false,
        pens = false,
        inks = false,
        swatches = false,
        activity = false,
        autocomplete = false
    } = options;

    if (dashboard) scheduleRender(renderDashboard);
    if (stats) scheduleRender(renderStatsPage);
    if (recent) scheduleRender(renderRecentInks);
    if (pens) scheduleRender(renderPens);
    if (inks) scheduleRender(renderInks);
    if (swatches) scheduleRender(renderSwatches);
    if (activity) scheduleRender(renderActivityLogView);
    if (autocomplete) scheduleRender(updateAutocompleteLists);
}

async function persistDataAndRefresh(options = {}) {
    const {
        refresh = {},
        onSuccess = null,
        onErrorMessage = 'Failed to save data!'
    } = options;

    if (!isManagerApp) {
        alert("Saving is disabled in Showcase mode.");
        return false;
    }

    const result = await desktopAPI.saveData(appData);
    if (result && result.success) {
        await refreshManagedImageCache();
        if (result.warning) {
            showAppNotice(result.message || 'Saved with warnings.', 'warning');
        }
        if (typeof onSuccess === 'function') {
            try {
                await onSuccess();
            } catch (error) {
                console.warn('Post-save UI cleanup failed after data was saved.', error);
                showAppNotice('Saved, but a cleanup step failed. The view was refreshed.', 'warning');
            }
        }
        scheduleUiRefresh(refresh);
        if (localStorage.getItem('lastView') === 'stats') {
            scheduleRender(renderStatsPage);
        }
        refreshBackupStatus();
        return true;
    }

    alert(onErrorMessage);
    return false;
}

function formatBackupStatusDate(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return formatDateByPreference(d, { time: true });
}

function formatAutomatedBackupStatus(iso) {
    if (!iso) return 'No automated snapshots yet.';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Automated backup time unavailable.';

    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) {
        return `Last automated backup was taken on ${formatBackupStatusDate(iso)}.`;
    }

    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) {
        const value = Math.max(1, diffMinutes);
        return `Last automated backup was taken ${value} minute${value === 1 ? '' : 's'} ago.`;
    }

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) {
        return `Last automated backup was taken ${diffHours} hour${diffHours === 1 ? '' : 's'} ago.`;
    }

    return `Last automated backup was taken on ${formatBackupStatusDate(iso)}.`;
}

async function refreshBackupStatus() {
    if (!isManagerApp || !desktopAPI || typeof desktopAPI.backupStatus !== 'function') {
        return;
    }
    if (!backupStatus) return;
    try {
        const result = await desktopAPI.backupStatus();
        if (!result || !result.success) {
            backupStatus.textContent = 'Automated backup status unavailable.';
            return;
        }
        if (!result.latest) {
            backupStatus.textContent = 'No automated snapshots yet.';
            return;
        }
        backupStatus.textContent = formatAutomatedBackupStatus(result.latest.updated_at);
    } catch (error) {
        backupStatus.textContent = 'Automated backup status unavailable.';
    }
}

// Initialize
// Initialize
async function init() {
    try {
        if (desktopAPI) {
            isManagerApp = true;
            isDockerMode = typeof desktopAPI.isDockerMode === 'function' && !!desktopAPI.isDockerMode();
            console.log("%c Mode: Manager App ", "background: #2c3e50; color: #fff; font-weight: bold;");
            if (typeof desktopAPI.getAppInfo === 'function') {
                try {
                    const info = await desktopAPI.getAppInfo();
                    if (info && typeof info === 'object') {
                        localAppInfo = info;
                        latestReleaseStatus = info;
                    }
                } catch (error) {
                    console.warn('App version info unavailable.', error);
                }
            }
            if (typeof desktopAPI.getImagesBaseUrl === 'function') {
                const baseUrl = await desktopAPI.getImagesBaseUrl();
                if (baseUrl) {
                    managerImagesBaseUrl = baseUrl;
                    imageAssetVersion = Date.now();
                }
            }
            const data = await desktopAPI.loadData();
            if (data) {
                appData = ensureAppDataDefaults(data);
            }
        } else {
            isManagerApp = false;
            console.log("Mode: Web (Showcase)");
            // Strictly hide all management UI in web mode
            const managerUI = [
                document.querySelector('.dropdown-wrapper'), // Dashboard Add Menu
                document.getElementById('btn-add-pen-header'),
                document.getElementById('btn-add-ink-header'),
                document.getElementById('btn-add-swatch-header'),
                document.getElementById('btn-add-menu'),
                document.getElementById('backup-actions'),
                document.querySelector('.activity-admin-panel')
            ];
            managerUI.forEach(el => { if (el) el.style.display = 'none'; });

            if (window.__INKUBATOR_DATA__ && typeof window.__INKUBATOR_DATA__ === 'object') {
                appData = ensureAppDataDefaults(window.__INKUBATOR_DATA__);
            } else {
                try {
                    const response = await fetch('./data.json');
                    if (response.ok) appData = ensureAppDataDefaults(await response.json());
                } catch (e) { console.warn("Using defaults"); }
            }
        }

        updateAutocompleteLists();
        setupCustomControls();
        const storedActivityPageSize = Number(localStorage.getItem('activityPageSize'));
        if ([10, 20, 30, 50].includes(storedActivityPageSize)) {
            activityPageSize = storedActivityPageSize;
        }
        if (activityPageSizeSelect) {
            activityPageSizeSelect.value = String(activityPageSize);
        }
        if (isManagerApp && !isDockerMode) {
            await refreshManagedImageCache();
        }
        if (isManagerApp) {
            refreshBackupStatus();
        }
        const retentionPrunedOnLoad = applyActivityRetention();
        const seededDemoActivity = maybeSeedDemoActivityLogs();
        if ((seededDemoActivity || retentionPrunedOnLoad) && isManagerApp && desktopAPI && typeof desktopAPI.saveData === 'function') {
            await desktopAPI.saveData(appData);
        }
        bindSystemColorModeListener();
        applyShowcaseTitleUi();
        applyInterfacePreferences();
        applyShowcaseSortDefaults();
        applyShowcaseSectionVisibility();

        // Persistence + route: showcase and Docker admin preserve refresh routes; desktop app starts at Dashboard.
        const shouldPreserveRoute = !isManagerApp || isDockerMode;
        const lastView = !isManagerApp ? (localStorage.getItem('lastView') || 'dashboard') : 'dashboard';
        const routeView = shouldPreserveRoute ? resolveRouteViewFromLocation() : '';
        const initialView = !isManagerApp
            ? normalizeRouteViewName(routeView || lastView)
            : normalizeRouteViewName(routeView || 'dashboard');
        switchView(
            ((initialView === 'activity' && shouldHideActivityInShowcase()) || (initialView === 'settings' && shouldHideSettingsInShowcase()))
                ? 'dashboard'
                : initialView,
            { replaceRoute: shouldPreserveRoute }
        );

        // Render only the restored view during startup. Heavy inactive views render on demand.
        renderForView(initialView);

        if (shouldPreserveRoute) {
            window.addEventListener('popstate', () => {
                const view = resolveRouteViewFromLocation();
                switchView(view, { updateRoute: false });
                renderForView(view);
            });
        }
        document.body.classList.remove('app-booting');

    } catch (e) {
        console.error("Failed to load data:", e);
        document.body.classList.remove('app-booting');
        // Fallback for local file:// testing where fetch might fail
        if (!desktopAPI && window.location.protocol === 'file:') {
            alert("Note: To view your changes in a browser locally, you need a local server due to security settings. The desktop app is your local viewer.");
        }
    }
}


// Navigation Logic
const VIEW_ROUTE_KEYS = new Set(['dashboard', 'pens', 'inks', 'swatches', 'stats', 'activity', 'settings']);

function normalizeRouteViewName(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return 'dashboard';
    return VIEW_ROUTE_KEYS.has(value) ? value : 'dashboard';
}

function normalizeBasePath(pathname) {
    const path = String(pathname || '/').replace(/\/+/g, '/');
    if (!path || path === '/') return '';
    let trimmed = path.replace(/\/$/, '');
    const parts = trimmed.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const prev = parts.length > 1 ? parts[parts.length - 2] : '';

    if (last === 'index.html') {
        if (VIEW_ROUTE_KEYS.has(prev)) {
            parts.pop();
            parts.pop();
        } else {
            parts.pop();
        }
    } else if (VIEW_ROUTE_KEYS.has(last)) {
        parts.pop();
    }

    const out = `/${parts.join('/')}`.replace(/\/+/g, '/');
    return out === '/' ? '' : out.replace(/\/$/, '');
}

function resolveRouteViewFromLocation() {
    if (typeof window === 'undefined' || !window.location) return 'dashboard';
    const hash = String(window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
    if (VIEW_ROUTE_KEYS.has(hash)) return hash;

    const params = new URLSearchParams(window.location.search || '');
    const queryView = String(params.get('view') || '').trim().toLowerCase();
    if (VIEW_ROUTE_KEYS.has(queryView)) return queryView;

    const pathname = String(window.location.pathname || '/');
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'dashboard';
    const last = segments[segments.length - 1].toLowerCase();
    if (last === 'index.html' && segments.length > 1) {
        const prev = segments[segments.length - 2].toLowerCase();
        if (VIEW_ROUTE_KEYS.has(prev)) return prev;
        return 'dashboard';
    }
    if (VIEW_ROUTE_KEYS.has(last)) return last;
    return 'dashboard';
}

function syncShowcaseRoute(viewName, { replace = false } = {}) {
    if ((isManagerApp && !isDockerMode) || typeof window === 'undefined' || !window.history || !window.location) return;
    const protocol = String(window.location.protocol || '').toLowerCase();

    const normalizedView = normalizeRouteViewName(viewName);
    if (protocol === 'file:') {
        const targetHash = normalizedView === 'dashboard' ? '' : `#/${normalizedView}`;
        const currentHash = String(window.location.hash || '');
        if (currentHash === targetHash) return;
        const base = String(window.location.pathname || '');
        const target = `${base}${window.location.search || ''}${targetHash}`;
        if (replace) {
            window.history.replaceState({ view: normalizedView }, '', target);
        } else {
            window.history.pushState({ view: normalizedView }, '', target);
        }
        return;
    }
    if (!/^https?:$/i.test(protocol)) return;

    const basePath = normalizeBasePath(window.location.pathname);
    const targetPath = normalizedView === 'dashboard'
        ? `${basePath || ''}/`
        : `${basePath || ''}/${normalizedView}`;
    const normalizedTarget = targetPath.replace(/\/+/g, '/');
    const currentPath = String(window.location.pathname || '/').replace(/\/+/g, '/');
    if (currentPath === normalizedTarget) return;

    if (replace) {
        window.history.replaceState({ view: normalizedView }, '', normalizedTarget);
    } else {
        window.history.pushState({ view: normalizedView }, '', normalizedTarget);
    }
}

function renderForView(viewName) {
    const normalized = normalizeRouteViewName(viewName);
    if (normalized === 'dashboard') {
        renderDashboard();
        return;
    }
    if (normalized === 'stats') {
        renderStatsPage();
        return;
    }
    if (normalized === 'settings') {
        renderSettingsView();
        return;
    }
    if (normalized === 'pens') {
        renderPens();
        return;
    }
    if (normalized === 'inks') {
        renderInks();
        return;
    }
    if (normalized === 'swatches') {
        renderSwatches();
        return;
    }
    if (normalized === 'activity') {
        renderActivityLogView();
    }
}

function switchView(viewName, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const shouldUpdateRoute = opts.updateRoute !== false;
    const shouldReplaceRoute = opts.replaceRoute === true;
    hideSettingsTooltip();
    if (viewName === 'settings' && shouldHideSettingsInShowcase()) {
        viewName = 'dashboard';
    }
    if (viewName === 'activity' && shouldHideActivityInShowcase()) {
        viewName = 'dashboard';
    }
    if (viewName === 'pens' && shouldHidePensInShowcase()) {
        viewName = 'dashboard';
    }
    if (viewName === 'inks' && shouldHideInksInShowcase()) {
        viewName = 'dashboard';
    }
    if (viewName === 'swatches' && shouldHideSwatchesInShowcase()) {
        viewName = 'dashboard';
    }

    // Hide all first
    if (viewDashboard) viewDashboard.style.display = 'none';
    if (viewStats) viewStats.style.display = 'none';
    if (viewSettings) viewSettings.style.display = 'none';
    if (viewPens) viewPens.style.display = 'none';
    if (viewActivity) viewActivity.style.display = 'none';
    const viewInks = document.getElementById('view-inks');
    const viewSwatches = document.getElementById('view-swatches');
    if (viewInks) viewInks.style.display = 'none';
    if (viewSwatches) viewSwatches.style.display = 'none';

    // Deactivate Navs
    if (navDashboard) navDashboard.classList.remove('active');
    if (navStats) navStats.classList.remove('active');
    if (navSettings) navSettings.classList.remove('active');
    if (navPens) navPens.classList.remove('active');
    if (navActivity) navActivity.classList.remove('active');
    const navInks = document.getElementById('nav-inks');
    const navSwatches = document.getElementById('nav-swatches');
    if (navInks) navInks.classList.remove('active');
    if (navSwatches) navSwatches.classList.remove('active');

    // Show selected
    if (viewName === 'dashboard') {
        if (viewDashboard) viewDashboard.style.display = 'block';
        if (navDashboard) navDashboard.classList.add('active');
    } else if (viewName === 'stats') {
        if (viewStats) viewStats.style.display = 'block';
        if (navStats) navStats.classList.add('active');
    } else if (viewName === 'settings') {
        if (viewSettings) viewSettings.style.display = 'block';
        if (navSettings) navSettings.classList.add('active');
    } else if (viewName === 'pens') {
        if (viewPens) viewPens.style.display = 'block';
        if (navPens) navPens.classList.add('active');
    } else if (viewName === 'inks') {
        if (viewInks) viewInks.style.display = 'block';
        if (navInks) navInks.classList.add('active');
    } else if (viewName === 'swatches') {
        if (viewSwatches) viewSwatches.style.display = 'block';
        if (navSwatches) navSwatches.classList.add('active');
    } else if (viewName === 'activity') {
        if (viewActivity) viewActivity.style.display = 'block';
        if (navActivity) navActivity.classList.add('active');
    }

    const hideActivityNav = shouldHideActivityInShowcase();
    const hideSettingsNav = shouldHideSettingsInShowcase();
    if (navSettings) navSettings.style.display = hideSettingsNav ? 'none' : '';
    if (navActivity) navActivity.style.display = hideActivityNav ? 'none' : '';
    if (navActivityDivider) navActivityDivider.style.display = hideActivityNav ? 'none' : '';
    applyShowcaseSectionVisibility();

    // Preserve refreshed section only for the static showcase website.
    if (!isManagerApp) {
        localStorage.setItem('lastView', viewName);
    }
    if (shouldUpdateRoute) {
        syncShowcaseRoute(viewName, { replace: shouldReplaceRoute });
    }
}

// Render Functions
function renderDashboard() {
    try {
        renderStats();
        renderInkedPens();
        renderRecentInks();
        renderRecentPens();
        renderRecentSwatches();
        renderRecentActivity();
    } catch (e) {
        console.error("Dashboard Render Failed:", e);
    }
}

function renderStatsPage() {
    try {
        renderStats();
        renderCollectionInsights();
        renderCollectionCharts();
    } catch (e) {
        console.error("Stats Page Render Failed:", e);
    }
}

function renderStats() {
    // ... (Existing implementation)
    const inkedCount = appData.currently_inked.length;
    const pensCount = (appData.pens || []).length;
    const inks = getLibraryInks();
    const bottleCount = inks.length;
    const swatchesCount = getAllSwatches().length;
    const totalInkSpend = inks.reduce((sum, ink) => {
        const price = parsePriceNumber(ink && ink.price);
        const amount = parseAmountNumber(ink && ink.amount, 1);
        if (!Number.isFinite(price) || price <= 0) return sum;
        return sum + (price * amount);
    }, 0);

    const numInked = document.getElementById('stat-inked');
    const numBottles = document.getElementById('stat-bottles');
    const numSwatches = document.getElementById('stat-swatches');
    const bottleDetail = document.getElementById('stat-inks-bottle-detail');
    const spendDetail = document.getElementById('stat-inks-spend-detail');

    if (numInked) numInked.textContent = pensCount;
    if (numBottles) numBottles.textContent = bottleCount;
    if (numSwatches) numSwatches.textContent = swatchesCount;
    if (bottleDetail) bottleDetail.textContent = `${bottleCount} bottle${bottleCount === 1 ? '' : 's'}`;
    if (spendDetail) {
        spendDetail.textContent = shouldHidePricesInShowcase() ? '' : `Total: ${formatMoney(totalInkSpend)}`;
    }

    const inkedSummary = document.getElementById('currently-inked-summary');
    if (inkedSummary) {
        const noun = inkedCount === 1 ? 'pen is' : 'pens are';
        inkedSummary.innerHTML = `<span style="font-weight: 800;">${inkedCount}</span> ${noun} currently inked`;
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsSingleQuoted(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function formatDays(value) {
    if (!Number.isFinite(value) || value <= 0) return '0d';
    if (value < 1) return '<1d';
    return `${Math.round(value)}d`;
}

function formatMoney(value) {
    if (!Number.isFinite(value) || value <= 0) return 'N/A';
    return value.toLocaleString(undefined, {
        style: 'currency',
        currency: getDefaultCurrency(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function getCurrencySymbol(currencyCode) {
    try {
        const parts = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).formatToParts(0);
        const currencyPart = parts.find((part) => part.type === 'currency');
        return (currencyPart && currencyPart.value) ? currencyPart.value : currencyCode;
    } catch (_error) {
        return currencyCode;
    }
}

function updateInkPricePrefix() {
    const symbol = getCurrencySymbol(getDefaultCurrency());
    if (inkPricePrefix) inkPricePrefix.textContent = symbol;
    if (penPricePrefix) penPricePrefix.textContent = symbol;
}

function parseLocalizedNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return NaN;
    let cleaned = value.trim().replace(/\s+/g, '').replace(/[^0-9.,-]/g, '');
    if (!cleaned) return NaN;
    const isNegative = cleaned.startsWith('-');
    cleaned = cleaned.replace(/-/g, '');
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
        const decimalSep = lastComma > lastDot ? ',' : '.';
        const thousandsSep = decimalSep === ',' ? '.' : ',';
        cleaned = cleaned.replace(new RegExp(`\\${thousandsSep}`, 'g'), '').replace(decimalSep, '.');
    } else {
        const sep = lastComma !== -1 ? ',' : (lastDot !== -1 ? '.' : '');
        if (sep) {
            const parts = cleaned.split(sep);
            const tail = parts[parts.length - 1] || '';
            const looksLikeThousands = parts.length > 1 && tail.length === 3 && parts.slice(0, -1).every(part => part.length > 0 && part.length <= 3);
            cleaned = looksLikeThousands ? parts.join('') : parts.join('.');
        }
    }
    if (isNegative) cleaned = `-${cleaned}`;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parsePriceNumber(value) {
    return parseLocalizedNumber(value);
}

function parseAmountNumber(value, fallback = 1) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value >= 0 ? value : fallback;
    }
    const parsed = parseLocalizedNumber(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed >= 0 ? parsed : fallback;
}

function median(values) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function countBy(items, key) {
    const out = Object.create(null);
    (items || []).forEach((item) => {
        const label = String((item && item[key]) || '').trim();
        if (!label) return;
        out[label] = (out[label] || 0) + 1;
    });
    return out;
}

function topLabel(countMap, fallback = 'N/A') {
    const keys = Object.keys(countMap || {});
    if (keys.length === 0) return fallback;
    const winner = keys.sort((a, b) => countMap[b] - countMap[a])[0];
    return `${winner} (${countMap[winner]})`;
}

function topMoneyLabel(amountMap, fallback = 'N/A') {
    const keys = Object.keys(amountMap || {});
    if (keys.length === 0) return fallback;
    const winner = keys.sort((a, b) => amountMap[b] - amountMap[a])[0];
    return `${winner} (${formatMoney(amountMap[winner])})`;
}

function extractIdTimestamp(id) {
    if (typeof id !== 'string') return 0;
    const match = id.match(/_(\d{10,14})/);
    if (!match) return 0;
    const raw = Number(match[1]);
    if (!Number.isFinite(raw)) return 0;
    return raw < 1e12 ? raw * 1000 : raw;
}

function latestTimestampFromCollection(items) {
    let latest = 0;
    (items || []).forEach((item) => {
        const idTs = extractIdTimestamp(item && item.id);
        const createdAt = Number(item && item.created_at);
        const genericTs = Number(item && item.timestamp);
        const dateInkedTs = Number(item && item.date_inked);
        latest = Math.max(
            latest,
            idTs,
            Number.isFinite(createdAt) ? createdAt : 0,
            Number.isFinite(genericTs) ? genericTs : 0,
            Number.isFinite(dateInkedTs) ? dateInkedTs : 0
        );
    });
    return latest;
}

function formatUpdatedAt(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return 'Never';
    return formatDateByPreference(new Date(ts));
}

function isCompletenessFieldFilled(value, mode = 'text') {
    if (mode === 'number') {
        const n = typeof value === 'number' ? value : Number(String(value || '').trim());
        return Number.isFinite(n) && n > 0;
    }
    return String(value || '').trim().length > 0;
}

function toMonthKey(date) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthShort(key) {
    if (typeof key !== 'string' || key.length !== 7) return key || '';
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    if (Number.isNaN(d.getTime())) return key;
    return formatDateByPreference(d, { monthShort: true });
}

function buildMiniBarChart(rows, options = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return `<div class="empty-state" style="padding: 8px 0;">No data available yet.</div>`;
    }
    const max = Math.max(1, ...rows.map(row => Number(row.value) || 0));
    const percentFn = typeof options.percentFn === 'function'
        ? options.percentFn
        : ((value) => `${Math.round((value / max) * 100)}%`);
    const fillFn = typeof options.fillFn === 'function'
        ? options.fillFn
        : (() => 'linear-gradient(90deg, #5c7ea6 0%, #2f5f8f 100%)');
    return `<div class="mini-chart-list">${rows.map((row, index) => {
        const value = Number(row.value) || 0;
        const width = value <= 0 ? 0 : Math.max(6, Math.round((value / max) * 100));
        const label = escapeHtml(row.label);
        const valueText = escapeHtml(percentFn(value, row));
        const fill = escapeHtml(fillFn(row, index));
        return `
            <div class="mini-chart-row">
                <div class="mini-chart-label">${label}</div>
                <div class="mini-chart-track"><div class="mini-chart-fill" style="width:${width}%; background:${fill};"></div></div>
                <div class="mini-chart-value">${valueText}</div>
            </div>
        `;
    }).join('')}</div>`;
}

function getPenColorDistributionRows() {
    const grouped = Object.create(null);
    (appData.pens || []).forEach((pen) => {
        const palette = Array.isArray(pen && pen.hex_colors) ? pen.hex_colors : [];
        const primary = String(palette[0] || (pen && pen.hex_color) || '').trim();
        if (!primary) return;
        const cat = getInkColorCategory(primary);
        grouped[cat] = (grouped[cat] || 0) + 1;
    });
    return Object.keys(grouped)
        .map((key) => ({ label: key, value: grouped[key] }))
        .sort((a, b) => b.value - a.value);
}

function getInkColorDistributionRows() {
    const inks = getLibraryInks();
    const grouped = Object.create(null);
    inks.forEach((ink) => {
        const cat = getInkColorCategory((ink && ink.color_base) || '#000000');
        grouped[cat] = (grouped[cat] || 0) + 1;
    });
    return Object.keys(grouped)
        .map((key) => ({ label: key, value: grouped[key] }))
        .sort((a, b) => b.value - a.value);
}

function renderGroupedInkSpectrum() {
    if (!groupedSpectrumList) return;
    const inks = getLibraryInks()
        .filter(ink => ink && typeof ink.color_base === 'string' && ink.color_base.trim())
        .map((ink) => {
            const color = ink.color_base.trim();
            const sortName = String(ink.name || '').trim();
            const sortBrand = String(ink.brand || '').trim();
            return {
                name: formatInkName(ink),
                color,
                sortName,
                sortBrand
            };
        })
        .sort((a, b) => {
            const byName = a.sortName.localeCompare(b.sortName, undefined, { sensitivity: 'base' });
            if (byName !== 0) return byName;
            const byBrand = a.sortBrand.localeCompare(b.sortBrand, undefined, { sensitivity: 'base' });
            if (byBrand !== 0) return byBrand;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

    if (!inks.length) {
        groupedSpectrumList.innerHTML = `<div class="empty-state" style="padding: 8px 0;">No ink colors yet.</div>`;
        return;
    }

    const n = inks.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const gridStyle = `--spectrum-cols:${cols};`;
    groupedSpectrumList.innerHTML = `
        <div class="ink-spectrum-grid" style="${gridStyle}" aria-label="Ink spectrum grid">
            ${inks.map((item) => `
                <span class="ink-spectrum-cell" style="--cell-color:${escapeHtml(item.color)}; background:${escapeHtml(item.color)};" title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
                    <span class="ink-spectrum-cell-label">${escapeHtml(item.name)}</span>
                </span>
            `).join('')}
        </div>
    `;

    const grid = groupedSpectrumList.querySelector('.ink-spectrum-grid');
    if (!grid) return;

    const EXIT_MS = 170;
    const exitTimers = new WeakMap();
    let activeCell = null;

    const clearExitState = (cell) => {
        const timer = exitTimers.get(cell);
        if (timer) {
            clearTimeout(timer);
            exitTimers.delete(cell);
        }
        cell.classList.remove('is-exiting');
    };

    const markExiting = (cell) => {
        if (!cell) return;
        cell.classList.remove('is-active');
        clearExitState(cell);
        cell.classList.add('is-exiting');
        const timer = setTimeout(() => {
            cell.classList.remove('is-exiting');
            exitTimers.delete(cell);
        }, EXIT_MS);
        exitTimers.set(cell, timer);
    };

    grid.addEventListener('pointerover', (event) => {
        const cell = event.target.closest('.ink-spectrum-cell');
        if (!cell || !grid.contains(cell)) return;
        if (activeCell && activeCell !== cell) {
            markExiting(activeCell);
        }
        clearExitState(cell);
        cell.classList.add('is-active');
        activeCell = cell;
    });

    grid.addEventListener('pointerleave', () => {
        if (!activeCell) return;
        markExiting(activeCell);
        activeCell = null;
    });
}

function getActivityTrendRows() {
    const now = new Date();
    const keys = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(toMonthKey(d));
    }
    const counts = Object.create(null);
    keys.forEach((k) => { counts[k] = 0; });
    (appData.activity_log || []).forEach((entry) => {
        const ts = typeof entry.timestamp === 'number' ? entry.timestamp : 0;
        const key = toMonthKey(ts);
        if (key && Object.prototype.hasOwnProperty.call(counts, key)) {
            counts[key] += 1;
        }
    });
    return keys.map(key => ({
        label: formatMonthShort(key),
        value: counts[key] || 0
    }));
}

function getMonthlyGrowthRows() {
    const now = new Date();
    const keys = [];
    for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(toMonthKey(d));
    }
    const counts = Object.create(null);
    keys.forEach((k) => { counts[k] = 0; });
    (appData.activity_log || []).forEach((entry) => {
        if (entry.action !== 'created') return;
        if (!['pen', 'ink', 'swatch'].includes(entry.category)) return;
        const key = toMonthKey(entry.timestamp || 0);
        if (key && Object.prototype.hasOwnProperty.call(counts, key)) {
            counts[key] += 1;
        }
    });
    return keys.map(key => ({
        label: formatMonthShort(key),
        value: counts[key] || 0
    }));
}

function getTopPenBrandRows() {
    const counts = countBy(appData.pens || [], 'brand');
    return Object.keys(counts)
        .map((brand) => ({ label: brand, value: counts[brand] }))
        .sort((a, b) => b.value - a.value);
}

function getTopInkBrandRows() {
    const counts = countBy(getLibraryInks(), 'brand');
    return Object.keys(counts)
        .map((brand) => ({ label: brand, value: counts[brand] }))
        .sort((a, b) => b.value - a.value);
}

function getPenSpendByBrandRows() {
    const spendByBrand = Object.create(null);
    (appData.pens || []).forEach((pen) => {
        const price = parsePriceNumber(pen && pen.price);
        if (!Number.isFinite(price) || price <= 0) return;
        const brand = String((pen && pen.brand) || '').trim() || 'Unknown';
        spendByBrand[brand] = (spendByBrand[brand] || 0) + price;
    });
    return Object.keys(spendByBrand)
        .map((brand) => ({ label: brand, value: spendByBrand[brand] }))
        .sort((a, b) => b.value - a.value);
}

function getInkSpendByBrandRows() {
    const spendByBrand = Object.create(null);
    getLibraryInks().forEach((ink) => {
        const unitPrice = parsePriceNumber(ink && ink.price);
        const amount = parseAmountNumber(ink && ink.amount, 1);
        const total = unitPrice * amount;
        if (!Number.isFinite(total) || total <= 0) return;
        const brand = String((ink && ink.brand) || '').trim() || 'Unknown';
        spendByBrand[brand] = (spendByBrand[brand] || 0) + total;
    });
    return Object.keys(spendByBrand)
        .map((brand) => ({ label: brand, value: spendByBrand[brand] }))
        .sort((a, b) => b.value - a.value);
}

function computeCollectionInsights() {
    const pens = appData.pens || [];
    const inks = getLibraryInks();
    const swatches = getAllSwatches();
    const active = appData.currently_inked || [];
    const inksPerPen = pens.length ? (inks.length / pens.length) : 0;
    const activeRatio = pens.length ? Math.round((active.length / pens.length) * 100) : 0;
    const last30Cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const last7Cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const last90Cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const recentActivity = (appData.activity_log || []).filter(entry => (entry.timestamp || 0) >= last30Cutoff);
    const createdRecent = recentActivity.filter(entry => entry.action === 'created').length;
    const inkedDays = active.map((item) => {
            const ts = Number(item.date_inked) || Date.now();
            return (Date.now() - ts) / (24 * 60 * 60 * 1000);
        });
    const avgInkedDays = inkedDays.length ? inkedDays.reduce((sum, days) => sum + days, 0) / inkedDays.length : 0;
    const medianInkedDays = median(inkedDays);
    const staleInkedPens = inkedDays.filter(days => days > 30).length;
    const swatchedInkIds = new Set(swatches.map((s) => s.ink_id).filter(Boolean));
    const swatchCoverage = inks.length ? Math.round((swatchedInkIds.size / inks.length) * 100) : 0;
    const missingSwatchInks = inks
        .filter((ink) => ink && !swatchedInkIds.has(ink.id))
        .map((ink) => formatInkName(ink));
    const inkActions30 = (appData.activity_log || []).filter(entry =>
        ['inked', 'reinked'].includes(entry.action) && (entry.timestamp || 0) >= last30Cutoff
    ).length;
    const inkActions90 = (appData.activity_log || []).filter(entry =>
        ['inked', 'reinked'].includes(entry.action) && (entry.timestamp || 0) >= last90Cutoff
    ).length;
    const actions7 = (appData.activity_log || []).filter(entry => (entry.timestamp || 0) >= last7Cutoff).length;
    const actions30 = recentActivity.length;
    const activePensDetailed = active
        .map((item) => findPenById(item.pen_id))
        .filter(Boolean);
    const staleInkedPensDetailed = active
        .filter((item) => {
            const ts = Number(item && item.date_inked) || Date.now();
            const days = (Date.now() - ts) / (24 * 60 * 60 * 1000);
            return days > 30;
        })
        .map((item) => findPenById(item.pen_id))
        .filter(Boolean);

    const penBrandCounts = countBy(pens, 'brand');
    const inkBrandCounts = countBy(inks, 'brand');

    const everInked = new Set((active || []).map(item => item.pen_id));
    (appData.activity_log || []).forEach((entry) => {
        if (entry && entry.category === 'pen' && ['inked', 'reinked', 'cleaned'].includes(entry.action) && entry.entity_id) {
            everInked.add(entry.entity_id);
        }
    });
    const underusedPensDetailed = pens.filter(pen => !everInked.has(pen.id));
    const underusedPens = underusedPensDetailed.length;

    const buildPenActionSummary = (cutoff) => {
        const counts = Object.create(null);
        (appData.activity_log || []).forEach((entry) => {
            if (!entry || !['inked', 'reinked'].includes(entry.action)) return;
            if ((entry.timestamp || 0) < cutoff) return;
            if (!entry.entity_id) return;
            counts[entry.entity_id] = (counts[entry.entity_id] || 0) + 1;
        });
        return Object.keys(counts)
            .map((penId) => {
                const pen = findPenById(penId);
                const name = pen ? formatPenName(pen) : `Unknown pen (${penId})`;
                return { name, count: counts[penId] };
            })
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    };
    const reinkSummary30 = buildPenActionSummary(last30Cutoff);
    const reinkSummary90 = buildPenActionSummary(last90Cutoff);

    const pricedPens = pens
        .map(pen => ({ brand: (pen.brand || '').trim(), price: parsePriceNumber(pen.price) }))
        .filter(item => Number.isFinite(item.price) && item.price > 0);
    const pricedInks = inks
        .map((ink) => {
            const unitPrice = parsePriceNumber(ink.price);
            const amount = parseAmountNumber(ink.amount, 1);
            return {
                brand: (ink.brand || '').trim(),
                unitPrice,
                amount,
                total: unitPrice * amount
            };
        })
        .filter(item => Number.isFinite(item.total) && item.total > 0);
    const totalPenSpend = pricedPens.reduce((sum, item) => sum + item.price, 0);
    const totalInkSpend = pricedInks.reduce((sum, item) => sum + item.total, 0);
    const totalInkVolume = inks.reduce((sum, ink) => {
        const volumeCl = parseAmountNumber(ink && ink.cl, 0);
        const amount = parseAmountNumber(ink && ink.amount, 1);
        if (!Number.isFinite(volumeCl) || volumeCl <= 0) return sum;
        if (!Number.isFinite(amount) || amount <= 0) return sum;
        return sum + (volumeCl * amount);
    }, 0);
    const totalSpend = totalPenSpend + totalInkSpend;
    const averagePenPrice = pricedPens.length ? (totalPenSpend / pricedPens.length) : 0;
    const totalInkUnits = pricedInks.reduce((sum, item) => sum + item.amount, 0);
    const averageInkPrice = totalInkUnits > 0 ? (totalInkSpend / totalInkUnits) : 0;
    const penSpendByBrand = Object.create(null);
    pricedPens.forEach((item) => {
        const key = item.brand || 'Unknown';
        penSpendByBrand[key] = (penSpendByBrand[key] || 0) + item.price;
    });
    const inkSpendByBrand = Object.create(null);
    pricedInks.forEach((item) => {
        const key = item.brand || 'Unknown';
        inkSpendByBrand[key] = (inkSpendByBrand[key] || 0) + item.total;
    });
    const topPenSpendBrand = topMoneyLabel(penSpendByBrand);
    const topInkSpendBrand = topMoneyLabel(inkSpendByBrand);

    const penCompletenessFields = [
        { key: 'brand', mode: 'text', label: 'Pen Brand' },
        { key: 'model', mode: 'text', label: 'Pen Model' },
        { key: 'nib', mode: 'text', label: 'Pen Nib Size' },
        { key: 'nib_material', mode: 'text', label: 'Pen Nib Material' },
        { key: 'material', mode: 'text', label: 'Pen Body Material' },
        { key: 'filling_system', mode: 'text', label: 'Pen Filling System' },
        { key: 'color', mode: 'text', label: 'Pen Color' },
        { key: 'price', mode: 'number', label: 'Pen Price' }
    ];
    const inkCompletenessFields = [
        { key: 'brand', mode: 'text', label: 'Ink Brand' },
        { key: 'name', mode: 'text', label: 'Ink Name' },
        { key: 'line', mode: 'text', label: 'Ink Line' },
        { key: 'type', mode: 'text', label: 'Ink Type' },
        { key: 'cl', mode: 'number', label: 'Ink Volume (cl)' },
        { key: 'amount', mode: 'number', label: 'Ink Amount' },
        { key: 'price', mode: 'number', label: 'Ink Price' },
        { key: 'color_base', mode: 'text', label: 'Ink Base Color' },
        { key: 'flow', mode: 'text', label: 'Ink Flow' },
        { key: 'lubrication', mode: 'text', label: 'Ink Lubrication' },
        { key: 'permanence', mode: 'text', label: 'Ink Permanence' }
    ];
    let expectedFields = 0;
    let filledFields = 0;
    const missingFieldCounts = Object.create(null);
    const missingFieldDetails = Object.create(null);
    pens.forEach((pen) => {
        penCompletenessFields.forEach((field) => {
            expectedFields += 1;
            if (isCompletenessFieldFilled(pen && pen[field.key], field.mode)) {
                filledFields += 1;
            } else {
                missingFieldCounts[field.label] = (missingFieldCounts[field.label] || 0) + 1;
                if (!Array.isArray(missingFieldDetails[field.label])) missingFieldDetails[field.label] = [];
                missingFieldDetails[field.label].push(formatPenName(pen));
            }
        });
    });
    inks.forEach((ink) => {
        inkCompletenessFields.forEach((field) => {
            expectedFields += 1;
            if (isCompletenessFieldFilled(ink && ink[field.key], field.mode)) {
                filledFields += 1;
            } else {
                missingFieldCounts[field.label] = (missingFieldCounts[field.label] || 0) + 1;
                if (!Array.isArray(missingFieldDetails[field.label])) missingFieldDetails[field.label] = [];
                missingFieldDetails[field.label].push(formatInkName(ink));
            }
        });
    });
    const completeness = expectedFields ? Math.round((filledFields / expectedFields) * 100) : 100;
    const missingFieldCount = Math.max(0, expectedFields - filledFields);

    const listForTooltip = (items, options = {}) => {
        const {
            noneText = 'None',
            max = 10
        } = options;
        if (!Array.isArray(items) || items.length === 0) return noneText;
        if (items.length <= max) return items.join(', ');
        const shown = items.slice(0, max);
        return `${shown.join(', ')} (+${items.length - max} more)`;
    };
    const missingFieldSummary = Object.keys(missingFieldCounts)
        .map((label) => ({ label, count: missingFieldCounts[label] }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((item) => {
            const names = Array.isArray(missingFieldDetails[item.label]) ? missingFieldDetails[item.label] : [];
            return `${item.label} (${item.count}): ${listForTooltip(names, { noneText: 'None', max: 8 })}`;
        });

    const latestPenActivity = Math.max(
        latestTimestampFromCollection(pens),
        ...(appData.activity_log || []).filter(e => e.category === 'pen').map(e => e.timestamp || 0),
        0
    );
    const latestInkActivity = Math.max(
        latestTimestampFromCollection(inks),
        ...(appData.activity_log || []).filter(e => e.category === 'ink').map(e => e.timestamp || 0),
        0
    );
    const latestSwatchActivity = Math.max(
        latestTimestampFromCollection(swatches),
        ...(appData.activity_log || []).filter(e => e.category === 'swatch').map(e => e.timestamp || 0),
        0
    );
    const latestActivityLog = Math.max(...(appData.activity_log || []).map(e => e.timestamp || 0), 0);

    return [
        { label: 'Inks per Pen Ratio', value: `${inksPerPen.toFixed(2)} (${inks.length}:${pens.length || 0})` },
        {
            label: 'Underused Pens',
            value: `${underusedPens}`,
            valueTooltip: `Pens never inked: ${listForTooltip(underusedPensDetailed.map((pen) => formatPenName(pen)))}`
        },
        {
            label: 'Inked Right Now',
            value: `${active.length} pens (${activeRatio}%)`,
            valueTooltip: `Currently inked pens: ${listForTooltip(activePensDetailed.map((pen) => formatPenName(pen)))}`
        },
        { label: 'Activity Last 30 Days', value: `${recentActivity.length} entries` },
        { label: 'New Entries Last 30 Days', value: `${createdRecent}` },
        { label: 'Average Inked Duration', value: formatDays(avgInkedDays) },
        { label: 'Median Inked Duration', value: formatDays(medianInkedDays) },
        {
            label: 'Re-inks (30d / 90d)',
            value: `${inkActions30} / ${inkActions90}`,
            labelTooltip: 'Total inking and re-inking activity recorded over the last 30 and 90 days.',
            valueTooltip: `30d: ${listForTooltip(reinkSummary30.map((item) => `${item.name} (${item.count})`))}\n90d: ${listForTooltip(reinkSummary90.map((item) => `${item.name} (${item.count})`))}`
        },
        {
            label: 'Swatch Coverage',
            value: `${swatchCoverage}% (${swatchedInkIds.size}/${inks.length || 0})`,
            valueTooltip: `Inks missing swatches: ${listForTooltip(missingSwatchInks)}`
        },
        {
            label: 'Stale Inked Pens (>30d)',
            value: `${staleInkedPens}`,
            valueTooltip: `Pens inked for over 30 days: ${listForTooltip(staleInkedPensDetailed.map((pen) => formatPenName(pen)))}`
        },
        {
            label: 'Activity Velocity (7d / 30d)',
            value: `${actions7} / ${actions30}`,
            labelTooltip: 'How many activity entries were recorded over the last 7 and 30 days.'
        },
        { label: 'Top Pen Brand', value: topLabel(penBrandCounts) },
        { label: 'Top Ink Brand', value: topLabel(inkBrandCounts) },
        {
            label: 'Total Ink Volume',
            value: `${Number.isInteger(totalInkVolume) ? totalInkVolume : totalInkVolume.toFixed(2)} cl`,
            valueTooltip: `${(totalInkVolume / 100).toFixed(2)} L`
        },
        { label: 'Tracked Spend', value: formatMoney(totalSpend) },
        { label: 'Total Pen Spend', value: formatMoney(totalPenSpend) },
        { label: 'Total Ink Spend', value: formatMoney(totalInkSpend) },
        { label: 'Average Pen Price', value: formatMoney(averagePenPrice) },
        { label: 'Average Ink Price', value: formatMoney(averageInkPrice) },
        { label: 'Top Pen Spend Brand', value: topPenSpendBrand },
        { label: 'Top Ink Spend Brand', value: topInkSpendBrand },
        {
            label: 'Completeness Score',
            value: `${completeness}% (${missingFieldCount} fields missing)`,
            labelTooltip: 'How complete your pen and ink records are based on key fields.',
            valueTooltip: missingFieldSummary.length > 0
                ? `Missing fields:\n${missingFieldSummary.join('\n')}`
                : 'Missing fields: None'
        },
        { label: 'Last Updated - Pens', value: formatUpdatedAt(latestPenActivity) },
        { label: 'Last Updated - Inks', value: formatUpdatedAt(latestInkActivity) },
        { label: 'Last Updated - Swatches', value: formatUpdatedAt(latestSwatchActivity) },
        { label: 'Last Updated - Activity', value: formatUpdatedAt(latestActivityLog) }
    ];
}

function renderCollectionInsights() {
    if (!collectionInsightsCard || !collectionInsightsList) return;
    if (shouldHideInsightsInShowcase()) {
        collectionInsightsCard.style.display = 'none';
        return;
    }
    collectionInsightsCard.style.display = '';

    let rows = computeCollectionInsights();
    if (shouldHidePricesInShowcase()) {
        const priceRelatedLabels = new Set([
            'Tracked Spend',
            'Total Pen Spend',
            'Total Ink Spend',
            'Average Pen Price',
            'Average Ink Price',
            'Top Pen Spend Brand',
            'Top Ink Spend Brand'
        ]);
        rows = rows.filter(row => !priceRelatedLabels.has(row.label));
    }
    const toInsightTooltipAttr = (value) => {
        const text = String(value || '').trim();
        return text ? ` data-insight-tooltip="${escapeHtml(text).replace(/\n/g, '&#10;')}" tabindex="0"` : '';
    };
    collectionInsightsList.innerHTML = `<div class="insight-list">${rows.map(row => `
        <div class="insight-item">
            <span class="insight-label"${toInsightTooltipAttr(row.labelTooltip)}>${escapeHtml(row.label)}</span>
            <span class="insight-value"${toInsightTooltipAttr(row.valueTooltip)}>${escapeHtml(row.value)}</span>
        </div>
    `).join('')}</div>`;
}

function renderCollectionCharts() {
    if (!collectionChartsCard || !chartColorDistribution || !chartInkColorDistribution || !chartActivityTrend || !chartTopPenBrands || !chartTopInkBrands || !chartPenSpendBrands || !chartInkSpendBrands) return;
    if (shouldHideChartsInShowcase()) {
        collectionChartsCard.style.display = 'none';
        return;
    }
    collectionChartsCard.style.display = '';
    const hidePrices = shouldHidePricesInShowcase();
    const penSpendBlock = chartPenSpendBrands ? chartPenSpendBrands.closest('.chart-block') : null;
    const inkSpendBlock = chartInkSpendBrands ? chartInkSpendBrands.closest('.chart-block') : null;
    if (penSpendBlock) penSpendBlock.style.display = hidePrices ? 'none' : '';
    if (inkSpendBlock) inkSpendBlock.style.display = hidePrices ? 'none' : '';

    const topPenBrandRows = getTopPenBrandRows();
    chartTopPenBrands.innerHTML = buildMiniBarChart(topPenBrandRows, {
        percentFn: (value) => `${value}`
    });

    const topInkBrandRows = getTopInkBrandRows();
    chartTopInkBrands.innerHTML = buildMiniBarChart(topInkBrandRows, {
        percentFn: (value) => `${value}`
    });

    const penSpendRows = getPenSpendByBrandRows();
    if (!hidePrices) {
        chartPenSpendBrands.innerHTML = buildMiniBarChart(penSpendRows, {
            percentFn: (value) => formatMoney(value)
        });
    } else {
        chartPenSpendBrands.innerHTML = '';
    }

    const inkSpendRows = getInkSpendByBrandRows();
    if (!hidePrices) {
        chartInkSpendBrands.innerHTML = buildMiniBarChart(inkSpendRows, {
            percentFn: (value) => formatMoney(value)
        });
    } else {
        chartInkSpendBrands.innerHTML = '';
    }

    const penColorRows = getPenColorDistributionRows();
    chartColorDistribution.innerHTML = buildMiniBarChart(penColorRows, {
        percentFn: (value) => `${value}`,
        fillFn: (row) => `linear-gradient(90deg, ${getColorHexForCategory(row.label)} 0%, #48556a 100%)`
    });

    const inkColorRows = getInkColorDistributionRows();
    chartInkColorDistribution.innerHTML = buildMiniBarChart(inkColorRows, {
        percentFn: (value) => `${value}`,
        fillFn: (row) => `linear-gradient(90deg, ${getColorHexForCategory(row.label)} 0%, #48556a 100%)`
    });
    renderGroupedInkSpectrum();

    const trendRows = getActivityTrendRows();
    chartActivityTrend.innerHTML = buildMiniBarChart(trendRows, {
        percentFn: (value) => `${value}`
    });
    updateChartScrollMarkers();
}

function updateChartScrollMarkers() {
    if (!collectionChartsCard) return;
    const chartBlocks = collectionChartsCard.querySelectorAll('.chart-block');
    chartBlocks.forEach((block) => {
        const existingBlockMarker = block.querySelector('.chart-scroll-value-indicator');
        if (existingBlockMarker) existingBlockMarker.remove();
        block.classList.remove('has-scroll-indicator');

        const heading = block.querySelector('h4');
        if (heading) {
            const existingHeadingMarker = heading.querySelector('.chart-scroll-indicator');
            if (existingHeadingMarker) existingHeadingMarker.remove();
        }

        const list = block.querySelector('.mini-chart-list');
        if (!list) return;

        const isScrollable = (list.scrollHeight - list.clientHeight) > 1;
        if (!isScrollable) return;

        const marker = document.createElement('span');
        marker.className = 'chart-scroll-value-indicator';
        marker.textContent = '↕';
        block.classList.add('has-scroll-indicator');
        block.appendChild(marker);
    });
}

function renderInkedPens() {
    if (!inkedGrid) return;
    inkedGrid.innerHTML = '';

    try {
        if (!appData.currently_inked || appData.currently_inked.length === 0) {
            inkedGrid.innerHTML = `<div class="empty-state">No pens currently inked. Time to fill one up!</div>`;
            return;
        }

        appData.currently_inked.forEach(item => {
            const pen = appData.pens.find(p => p.id === item.pen_id);
            const ink = appData.inks.find(k => k.id === item.ink_id);

            if (!pen) return; // Skip if pen record is missing

            const card = document.createElement('div');
            card.className = 'inked-card glass-panel';

            if (isManagerApp) {
                card.style.cursor = 'pointer';
                card.onclick = () => openPenModal(pen.id);
            }

            let bgStyle = '';
            if (ink) {
                bgStyle = `background: linear-gradient(135deg, ${ink.color_base || '#ccc'}, ${ink.color_accent || ink.color_base || '#999'})`;
            } else {
                bgStyle = `background: linear-gradient(135deg, #ccc, #999)`;
            }

            const inkColor = ink ? (ink.color_base || '#ccc') : '#ccc';
            const inkName = ink ? (ink.brand ? `${ink.brand} ${ink.name}` : ink.name) : 'Unknown Ink';
            const penName = pen.model;
            const penDetail = `${pen.brand} • ${pen.nib}`;
            const safePenName = escapeHtml(penName);
            const safePenDetail = escapeHtml(penDetail);
            const safeInkName = escapeHtml(inkName);

            card.innerHTML = `
                <div class="ink-swatch-bg" style="${bgStyle}; height: 120px;"></div>
                <div class="card-content">
                    <div class="pen-name" style="font-size: 16px; font-weight: 600;">${safePenName}</div>
                    <div class="pen-detail" style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px;">${safePenDetail}</div>
                    <div class="ink-pairing" style="display: flex; align-items: center; gap: 8px;">
                        <div class="ink-dot" style="background-color: ${inkColor}; width: 12px; height: 12px; border-radius: 50%;"></div>
                        <span style="font-size: 13px; color: var(--color-text-main);">${safeInkName}</span>
                    </div>
                    <div class="card-meta" style="margin-top: 8px; font-size: 11px; color: var(--color-text-muted);">Inked ${formatDateByPreference(new Date(item.date_inked))}</div>
                </div>
            `;
            inkedGrid.appendChild(card);
        });
    } catch (e) {
        console.error("Inked Pens Render Failed:", e);
        inkedGrid.innerHTML = `<div style="color: red; padding: 20px;">Error rendering inked pens. Check console.</div>`;
    }
}

function renderRecentInks() {
    const listContainer = document.getElementById('recent-inks-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    try {
        const libraryInks = getLibraryInks();
        if (!libraryInks || libraryInks.length === 0) return;

        const recent = [...libraryInks].reverse().slice(0, DASHBOARD_RECENT_LIMIT);
        recent.forEach(ink => {
            if (!ink) return;
            const safeName = escapeHtml(ink.name);
            const safeBrand = escapeHtml(ink.brand || '');
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="color-circle" style="background-color: ${ink.color_base || '#ccc'}; border-color: ${ink.color_accent || ink.color_base || '#999'}"></div>
                <div class="item-info">
                    <div class="item-title">${safeName}</div>
                    <div class="item-sub">${safeBrand}</div>
                </div>
            `;
            listContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Recent Inks Render Failed:", e);
    }
}

function renderRecentPens() {
    const listContainer = document.getElementById('recent-pens-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    try {
        if (!appData.pens || appData.pens.length === 0) return;

        const recent = [...appData.pens].reverse().slice(0, DASHBOARD_RECENT_LIMIT);
        recent.forEach(pen => {
            if (!pen) return;
            const safeModel = escapeHtml(pen.model || 'Unnamed Pen');
            const safeBrand = escapeHtml(pen.brand || '');
            const safeNib = pen.nib ? escapeHtml(pen.nib) : '';
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="color-circle" style="background-color: ${pen.hex_color || '#d8dde6'}; border-color: ${pen.hex_color || '#d8dde6'}"></div>
                <div class="item-info">
                    <div class="item-title">${safeModel}</div>
                    <div class="item-sub">${safeBrand}${safeNib ? ` • ${safeNib}` : ''}</div>
                </div>
            `;
            listContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Recent Pens Render Failed:", e);
    }
}

function renderRecentSwatches() {
    const listContainer = document.getElementById('recent-swatches-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    try {
        const swatches = getAllSwatches();
        if (swatches.length === 0) return;

        const recent = [...swatches]
            .sort((a, b) => getSwatchTimestamp(b) - getSwatchTimestamp(a))
            .slice(0, DASHBOARD_RECENT_LIMIT);
        recent.forEach((swatch) => {
            const ink = getInkById(swatch.ink_id);
            const safeInkName = escapeHtml((ink && ink.name) || 'Unnamed Swatch');
            const safeInkBrand = escapeHtml((ink && ink.brand) || '');
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="color-circle" style="background-color: ${(ink && ink.color_base) || '#d8dde6'}; border-color: ${(ink && (ink.color_accent || ink.color_base)) || '#d8dde6'}"></div>
                <div class="item-info">
                    <div class="item-title">${safeInkName}</div>
                    <div class="item-sub">${safeInkBrand}</div>
                </div>
            `;
            listContainer.appendChild(div);
        });
    } catch (e) {
        console.error("Recent Swatches Render Failed:", e);
    }
}

function renderRecentActivity() {
    if (recentActivityCard) {
        recentActivityCard.style.display = shouldHideRecentActivityInShowcase() ? 'none' : '';
    }
    if (shouldHideRecentActivityInShowcase() || !recentActivityList) return;

    const items = (appData.activity_log || []).slice(0, DASHBOARD_RECENT_LIMIT);
    recentActivityList.innerHTML = '';
    if (items.length === 0) {
        recentActivityList.innerHTML = `<div class="empty-state" style="padding: 18px 0;">No activity yet.</div>`;
        return;
    }

    items.forEach((entry) => {
        const iconSpec = getRecentActivityIcon(entry);
        const safeMessage = escapeHtml(resolveActivityNormalMessage(entry) || 'Activity recorded');
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="color-circle" style="background: ${iconSpec.bg}; border-color: ${iconSpec.border}; display: flex; align-items: center; justify-content: center;">
                <i class="ph ${iconSpec.icon}" style="font-size: 16px; color: ${iconSpec.color};"></i>
            </div>
            <div class="item-info">
                <div class="item-title">${safeMessage}</div>
                <div class="item-sub">${formatActivityTimestamp(entry.timestamp)}</div>
            </div>
        `;
        recentActivityList.appendChild(div);
    });
}

function toActivityFilterKey(value, fallback = 'all') {
    const key = String(value || '').trim().toLowerCase();
    return key || fallback;
}

function isActivityFilterActive() {
    return !!(
        activityDateFilter
        || (activityTypeFilter && activityTypeFilter !== 'all')
        || (activityActionFilter && activityActionFilter !== 'all')
        || String(activitySearchFilter || '').trim()
        || activityDateFromFilter
        || activityDateToFilter
    );
}

function humanizeActivityFilterValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'Unknown';
    return raw
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function renderActivityFilterSelectOptions(selectEl, values, preferredValue = 'all') {
    if (!selectEl) return;
    const current = String(preferredValue || 'all').toLowerCase();
    const seen = new Set(['all']);
    const options = [{ value: 'all', label: 'All' }];
    (values || []).forEach((value) => {
        const normalized = toActivityFilterKey(value, '');
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        options.push({ value: normalized, label: humanizeActivityFilterValue(value) });
    });
    selectEl.innerHTML = options
        .map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
        .join('');
    const hasCurrent = options.some((opt) => opt.value === current);
    selectEl.value = hasCurrent ? current : 'all';
}

function refreshActivityFilterControls() {
    if (activityFilterTypeSelect) {
        const typeValues = [...new Set((appData.activity_log || []).map((entry) => toActivityFilterKey(entry.category, '')).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));
        renderActivityFilterSelectOptions(activityFilterTypeSelect, typeValues, activityTypeFilter);
        activityTypeFilter = activityFilterTypeSelect.value || 'all';
    }
    if (activityFilterActionSelect) {
        const actionValues = [...new Set((appData.activity_log || []).map((entry) => toActivityFilterKey(entry.action, '')).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));
        renderActivityFilterSelectOptions(activityFilterActionSelect, actionValues, activityActionFilter);
        activityActionFilter = activityFilterActionSelect.value || 'all';
    }
    if (activityFilterSearchInput) activityFilterSearchInput.value = activitySearchFilter;
    setActivityFilterDateInputValue('from', activityDateFromFilter);
    setActivityFilterDateInputValue('to', activityDateToFilter);
    syncActivityCustomSelectUI();
}

function getFilteredActivityEntries() {
    let items = [...(appData.activity_log || [])]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (activityDateFilter) {
        const selected = new Date(`${activityDateFilter}T00:00:00`);
        if (!Number.isNaN(selected.getTime())) {
            const startTs = selected.getTime();
            const endTs = startTs + (24 * 60 * 60 * 1000);
            items = items.filter((entry) => {
                const ts = entry.timestamp || 0;
                return ts >= startTs && ts < endTs;
            });
        }
    }

    const fromDate = parseIsoLocalDate(activityDateFromFilter);
    const toDate = parseIsoLocalDate(activityDateToFilter);
    if (fromDate || toDate) {
        const fromTs = fromDate ? fromDate.getTime() : null;
        const toTsExclusive = toDate ? (toDate.getTime() + (24 * 60 * 60 * 1000)) : null;
        const lowerBound = (fromTs != null && toTsExclusive != null) ? Math.min(fromTs, toTsExclusive) : (fromTs != null ? fromTs : null);
        const upperBound = (fromTs != null && toTsExclusive != null) ? Math.max(fromTs, toTsExclusive) : (toTsExclusive != null ? toTsExclusive : null);
        items = items.filter((entry) => {
            const ts = entry.timestamp || 0;
            if (lowerBound != null && ts < lowerBound) return false;
            if (upperBound != null && ts >= upperBound) return false;
            return true;
        });
    }

    if (activityTypeFilter && activityTypeFilter !== 'all') {
        items = items.filter((entry) => toActivityFilterKey(entry.category) === activityTypeFilter);
    }

    if (activityActionFilter && activityActionFilter !== 'all') {
        items = items.filter((entry) => toActivityFilterKey(entry.action) === activityActionFilter);
    }

    const searchNeedle = String(activitySearchFilter || '').trim().toLowerCase();
    if (searchNeedle) {
        const terms = searchNeedle.split(/\s+/).filter(Boolean);
        const penDuplicateCounts = getPenDuplicateNameCounts();
        items = items.filter((entry) => {
            const msg = String(entry.message || '');
            const action = String(entry.action || '');
            const category = String(entry.category || '');
            const entity = String(entry.entity_id || '');
            const metadata = entry && entry.metadata ? JSON.stringify(entry.metadata) : '';
            const penDiff = getActivityPenDifferentiator(entry, penDuplicateCounts);
            const haystack = `${msg} ${action} ${category} ${entity} ${metadata} ${penDiff ? penDiff.searchText : ''}`.toLowerCase();
            return terms.every((term) => haystack.includes(term));
        });
    }

    return items;
}

function buildActivityLogbookHtml(items) {
    if (!items.length) {
        const hasFilters = isActivityFilterActive();
        const fallbackDate = activityDateFilter ? parseIsoLocalDate(activityDateFilter) : new Date();
        const label = hasFilters ? 'No Matches' : (fallbackDate ? formatActivityDateLabel(fallbackDate.getTime()) : 'Today');
        const message = hasFilters
            ? 'No activity entries match the current filters.'
            : 'No activity has been recorded for this day.';
        return `
            <div class="activity-date-label">${label}</div>
            <div class="activity-logbook-item activity-logbook-empty glass-panel">
                <div class="activity-logbook-message">${message}</div>
            </div>
        `;
    }

    let html = '';
    let lastDate = '';
    const penDuplicateCounts = getPenDuplicateNameCounts();
    items.forEach((entry) => {
        const dateLabel = formatActivityDateLabel(entry.timestamp);
        const safeId = escapeHtml(entry.id || '');
        const safeCategory = escapeHtml(entry.category || 'system');
        const safeAction = escapeHtml(entry.action || 'updated');
        const penDiff = getActivityPenDifferentiator(entry, penDuplicateCounts);
        const messageHtml = renderActivityMessage(entry, penDiff);
        const deleteControl = isManagerApp
            ? `<button class="activity-delete-btn" data-delete-activity-id="${safeId}" title="Delete entry">
                    <i class="ph ph-trash"></i>
               </button>`
            : '';
        if (dateLabel !== lastDate) {
            html += `<div class="activity-date-label">${dateLabel}</div>`;
            lastDate = dateLabel;
        }
        html += `
            <div class="activity-logbook-item glass-panel" data-activity-id="${safeId}">
                <div class="activity-logbook-time">${formatActivityTimestamp(entry.timestamp)}</div>
                <div>
                    <div class="activity-logbook-message">${messageHtml}</div>
                    <div class="activity-logbook-meta">${safeCategory} • ${safeAction}</div>
                </div>
                ${deleteControl}
            </div>
        `;
    });
    return html;
}

function renderActivityPagination(totalItems) {
    if (!activityPagination || !activityPageStatus || !activityPagePrevBtn || !activityPageNextBtn || !activityPageSizeSelect) return;

    if (activityPageSizeSelect.value !== String(activityPageSize)) {
        activityPageSizeSelect.value = String(activityPageSize);
    }

    const pageSize = Math.max(1, activityPageSize);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    activityCurrentPage = Math.min(Math.max(1, activityCurrentPage), totalPages);

    activityPageStatus.textContent = `Page ${activityCurrentPage} of ${totalPages}`;
    activityPagePrevBtn.disabled = activityCurrentPage <= 1;
    activityPageNextBtn.disabled = activityCurrentPage >= totalPages;
    activityPagination.style.display = totalItems > pageSize ? 'flex' : 'none';
}

function formatReleasePublishedDate(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderReleaseStatusUi(status) {
    if (!isManagerApp) {
        if (appVersionText) appVersionText.textContent = 'Version: Showcase mode';
        if (appUpdateStatusText) appUpdateStatusText.textContent = 'Update checks are available in the desktop app.';
        return;
    }
    const currentVersion = String(status?.currentVersion || '');
    if (appVersionText) {
        appVersionText.textContent = currentVersion
            ? `${isDockerMode ? 'Docker image' : 'Version'}: ${currentVersion}`
            : `${isDockerMode ? 'Docker image' : 'Version'}: Unknown`;
    }
    if (btnOpenReleases) {
        const targetUrl = isDockerMode
            ? (status?.containerUrl || 'https://github.com/aloglu/inkubator/pkgs/container/inkubator')
            : (status?.releasesUrl || 'https://github.com/aloglu/inkubator/releases');
        btnOpenReleases.href = targetUrl;
        const label = btnOpenReleases.querySelector('span') || btnOpenReleases;
        label.textContent = isDockerMode ? 'Open Container Package' : 'Open Releases';
    }
    if (btnCheckUpdates) {
        const label = btnCheckUpdates.querySelector('span') || btnCheckUpdates;
        if (!btnCheckUpdates.disabled) label.textContent = isDockerMode ? 'Check Container Image' : 'Check for Updates';
    }
    if (!appUpdateStatusText) return;
    if (!status) {
        appUpdateStatusText.textContent = isDockerMode
            ? 'Press "Check Container Image" to compare this container version with the latest release.'
            : 'Press "Check for Updates" to query GitHub Releases.';
        return;
    }
    if (status === localAppInfo || status.localOnly) {
        appUpdateStatusText.textContent = isDockerMode
            ? 'Press "Check Container Image" to compare this container version with the latest release.'
            : 'Press "Check for Updates" to query GitHub Releases.';
        return;
    }
    if (!status.success) {
        appUpdateStatusText.textContent = status.message || 'Could not check for updates right now.';
        return;
    }

    const latestVersion = status.latestVersion || status.latestTag || 'unknown';
    const published = formatReleasePublishedDate(status.publishedAt);
    const versionState = String(status.versionState || '').trim() || (status.hasUpdate ? 'update_available' : 'up_to_date');
    if (versionState === 'update_available') {
        if (isDockerMode) {
            appUpdateStatusText.textContent = published
                ? `New container image available: ${latestVersion} (${published}). Pull a newer ghcr.io/aloglu/inkubator image and recreate the container.`
                : `New container image available: ${latestVersion}. Pull a newer ghcr.io/aloglu/inkubator image and recreate the container.`;
            return;
        }
        appUpdateStatusText.textContent = published
            ? `New version available: ${latestVersion} (${published}). Download it from Releases.`
            : `New version available: ${latestVersion}. Download it from Releases.`;
        return;
    }
    if (versionState === 'ahead_of_latest') {
        if (isDockerMode) {
            appUpdateStatusText.textContent = published
                ? `This container (${currentVersion || 'unknown'}) is newer than the latest published image (${latestVersion}, released ${published}).`
                : `This container (${currentVersion || 'unknown'}) is newer than the latest published image (${latestVersion}).`;
            return;
        }
        appUpdateStatusText.textContent = published
            ? `This build (${currentVersion || 'unknown'}) is newer than the latest published release (${latestVersion}, released ${published}).`
            : `This build (${currentVersion || 'unknown'}) is newer than the latest published release (${latestVersion}).`;
        return;
    }
    if (isDockerMode) {
        appUpdateStatusText.textContent = published
            ? `Container image is up to date (latest: ${latestVersion}, released ${published}).`
            : `Container image is up to date (latest: ${latestVersion}).`;
        return;
    }
    appUpdateStatusText.textContent = published
        ? `You are up to date (latest: ${latestVersion}, released ${published}).`
        : `You are up to date (latest: ${latestVersion}).`;
}

async function checkForAppUpdates() {
    const checkLabel = isDockerMode ? 'container image' : 'updates';
    if (!isManagerApp || !desktopAPI || typeof desktopAPI.getReleaseStatus !== 'function') {
        latestReleaseStatus = {
            success: false,
            message: 'Update checks are only available in the desktop app.'
        };
        renderReleaseStatusUi(latestReleaseStatus);
        showAppNotice(`Could not check ${checkLabel}`, 'error');
        return;
    }
    if (btnCheckUpdates) {
        btnCheckUpdates.disabled = true;
        btnCheckUpdates.textContent = 'Checking...';
    }
    try {
        const status = await desktopAPI.getReleaseStatus();
        latestReleaseStatus = (status && typeof status === 'object')
            ? status
            : { success: false, message: 'Unexpected update-check response.' };
        if (latestReleaseStatus.success) {
            showAppNotice(isDockerMode ? 'Container image checked' : 'Update check complete', 'success');
        } else {
            showAppNotice(latestReleaseStatus.message || `Could not check ${checkLabel}`, 'error');
        }
    } catch (error) {
        latestReleaseStatus = {
            success: false,
            message: error && error.message ? error.message : 'Failed to check updates.'
        };
        showAppNotice(latestReleaseStatus.message || `Could not check ${checkLabel}`, 'error');
    } finally {
        renderReleaseStatusUi(latestReleaseStatus);
        if (btnCheckUpdates) {
            btnCheckUpdates.disabled = false;
            btnCheckUpdates.textContent = isDockerMode ? 'Check Container Image' : 'Check for Updates';
        }
    }
}

function renderSettingsView() {
    const prefs = getPreferences();
    const showcasePrefs = getShowcasePreferences();
    const filterPrefs = getActivityLogFilterPreferences();
    const defaultsPrefs = getDefaultsPreferences();
    const importExportPrefs = getImportExportPreferences();
    const backupPrefs = getBackupPreferences();
    const showcaseSort = getShowcaseSortPreferences();
    applyDockerSettingsUi();
    if (toggleActivityVisible) toggleActivityVisible.checked = !!prefs.show_activity_log;
    if (toggleRecentActivityVisible) toggleRecentActivityVisible.checked = !!prefs.show_recent_activity;
    if (toggleOpenCardsEditMode) toggleOpenCardsEditMode.checked = shouldOpenCardsInEditMode();
    if (toggleShowcasePricesVisible) toggleShowcasePricesVisible.checked = !!showcasePrefs.show_prices;
    if (toggleShowcasePensVisible) toggleShowcasePensVisible.checked = !!showcasePrefs.show_pens;
    if (toggleShowcaseInksVisible) toggleShowcaseInksVisible.checked = !!showcasePrefs.show_inks;
    if (toggleShowcaseSwatchesVisible) toggleShowcaseSwatchesVisible.checked = !!showcasePrefs.show_swatches;
    if (toggleShowcaseActivityFiltersVisible) toggleShowcaseActivityFiltersVisible.checked = !!showcasePrefs.show_activity_filters;
    if (toggleShowcaseInsightsVisible) toggleShowcaseInsightsVisible.checked = !!showcasePrefs.show_insights;
    if (toggleShowcaseChartsVisible) toggleShowcaseChartsVisible.checked = !!showcasePrefs.show_charts;
    if (activityRetentionSelect) activityRetentionSelect.value = String(getActivityRetentionDays());
    if (colorModeSelect) colorModeSelect.value = ['light', 'dark', 'auto'].includes(prefs.color_mode) ? prefs.color_mode : 'auto';
    if (showcaseColorModeSelect) showcaseColorModeSelect.value = ['light', 'dark', 'auto'].includes(String(showcasePrefs.color_mode || '').toLowerCase())
        ? String(showcasePrefs.color_mode).toLowerCase()
        : 'auto';
    if (toggleConfirmDestructive) toggleConfirmDestructive.checked = !!prefs.confirm_destructive_actions;
    if (activityLogVerbositySelect) activityLogVerbositySelect.value = getActivityLogVerbosity();
    if (toggleLogPenEdits) toggleLogPenEdits.checked = !!filterPrefs.pen_edits;
    if (toggleLogInkEdits) toggleLogInkEdits.checked = !!filterPrefs.ink_edits;
    if (toggleLogSwatchEvents) toggleLogSwatchEvents.checked = !!filterPrefs.swatches;
    if (toggleLogDeleteEvents) toggleLogDeleteEvents.checked = !!filterPrefs.deletes;
    if (showcaseTitleInput) showcaseTitleInput.value = normalizeShowcaseTitle(showcasePrefs.title);
    if (showcaseSortPensSelect) showcaseSortPensSelect.value = showcaseSort.pens;
    if (showcaseSortInksSelect) showcaseSortInksSelect.value = showcaseSort.inks;
    if (showcaseSortSwatchesSelect) showcaseSortSwatchesSelect.value = showcaseSort.swatches;
    if (defaultCurrencySelect) defaultCurrencySelect.value = String(defaultsPrefs.currency || 'USD').toUpperCase();
    if (defaultDateFormatSelect) defaultDateFormatSelect.value = String(defaultsPrefs.date_format || 'system').toLowerCase();
    if (defaultPenNibInput) defaultPenNibInput.value = String(defaultsPrefs.pen_nib || '');
    if (defaultPenNibMaterialInput) defaultPenNibMaterialInput.value = String(defaultsPrefs.pen_nib_material || '');
    if (defaultPenStatusSelect) defaultPenStatusSelect.value = String(defaultsPrefs.pen_status || '');
    if (defaultInkTypeSelect) defaultInkTypeSelect.value = String(defaultsPrefs.ink_type || '');
    if (toggleImportAutoValidate) toggleImportAutoValidate.checked = !!importExportPrefs.auto_validate_import;
    if (toggleExportIncludeMetadata) toggleExportIncludeMetadata.checked = !!importExportPrefs.include_optional_metadata;
    if (importConflictBehaviorSelect) importConflictBehaviorSelect.value = String(importExportPrefs.conflict_behavior || 'overwrite');
    if (autoBackupFrequencySelect) autoBackupFrequencySelect.value = String(backupPrefs.auto_frequency || 'daily');
    if (backupRetentionCountInput) backupRetentionCountInput.value = String(Number(backupPrefs.retention_count) || 30);
    if (toggleBackupKeepReplacedImages) toggleBackupKeepReplacedImages.checked = !!backupPrefs.keep_replaced_images;
    refreshBackupEffectiveStatus();
    updateInkPricePrefix();
    renderReleaseStatusUi(latestReleaseStatus);
    syncSettingsCustomSelectUI();
}

function applyDockerSettingsUi() {
    if (showcaseSettingsTitle) {
        showcaseSettingsTitle.textContent = isDockerMode ? 'Website Settings' : 'Showcase Website';
    }
    document.querySelectorAll('[data-docker-label]').forEach((element) => {
        if (!element.dataset.defaultLabel) element.dataset.defaultLabel = element.textContent;
        element.textContent = isDockerMode ? element.dataset.dockerLabel : element.dataset.defaultLabel;
    });
    document.querySelectorAll('[data-docker-tooltip]').forEach((element) => {
        if (!element.dataset.defaultTooltip) element.dataset.defaultTooltip = element.getAttribute('data-tooltip') || '';
        element.setAttribute('data-tooltip', isDockerMode ? element.dataset.dockerTooltip : element.dataset.defaultTooltip);
    });
    const showcaseActions = btnExportShowcase ? btnExportShowcase.closest('.settings-showcase-actions') : null;
    if (showcaseActions) {
        showcaseActions.style.display = isDockerMode ? 'none' : '';
    }
    if (websiteColorModeField) {
        websiteColorModeField.style.display = isDockerMode ? 'none' : '';
    }
}

function renderActivityLogView() {
    if (!activityLogContainer) return;

    if (activityRetentionSelect) activityRetentionSelect.value = String(getActivityRetentionDays());
    refreshActivityFilterControls();
    if (activityDatePickerToggle) {
        activityDatePickerToggle.classList.toggle('active', !!activityDateFilter);
    }
    const hideActivityNav = shouldHideActivityInShowcase();
    if (navActivity) navActivity.style.display = hideActivityNav ? 'none' : '';
    if (navActivityDivider) navActivityDivider.style.display = hideActivityNav ? 'none' : '';
    if (activityFilterToolbar) activityFilterToolbar.style.display = shouldHideActivityFiltersInShowcase() ? 'none' : '';

    const items = getFilteredActivityEntries();
    const pageSize = Math.max(1, activityPageSize);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    activityCurrentPage = Math.min(Math.max(1, activityCurrentPage), totalPages);
    const start = (activityCurrentPage - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);
    activityLogContainer.innerHTML = buildActivityLogbookHtml(pagedItems);
    renderActivityPagination(items.length);
}

function deleteActivityEntry(activityId) {
    if (!activityId) return;
    appData.activity_log = (appData.activity_log || []).filter(entry => entry.id !== activityId);
    persistDataAndRefresh({
        refresh: {
            dashboard: true,
            activity: true
        },
        onErrorMessage: 'Failed to delete activity entry.'
    });
}

function persistActivityMaintenance(onErrorMessage) {
    persistDataAndRefresh({
        refresh: {
            dashboard: true,
            activity: true
        },
        onErrorMessage
    });
}

function applyShowcaseSettingsFromForm() {
    const prefs = getPreferences();
    const showcase = prefs.showcase || {};
    showcase.show_prices = !!(toggleShowcasePricesVisible && toggleShowcasePricesVisible.checked);
    showcase.show_pens = !!(toggleShowcasePensVisible && toggleShowcasePensVisible.checked);
    showcase.show_inks = !!(toggleShowcaseInksVisible && toggleShowcaseInksVisible.checked);
    showcase.show_swatches = !!(toggleShowcaseSwatchesVisible && toggleShowcaseSwatchesVisible.checked);
    showcase.show_activity_filters = !!(toggleShowcaseActivityFiltersVisible && toggleShowcaseActivityFiltersVisible.checked);
    showcase.show_insights = !!(toggleShowcaseInsightsVisible && toggleShowcaseInsightsVisible.checked);
    showcase.show_charts = !!(toggleShowcaseChartsVisible && toggleShowcaseChartsVisible.checked);
    showcase.title = normalizeShowcaseTitle(showcaseTitleInput ? showcaseTitleInput.value : showcase.title);
    const selectedShowcaseMode = showcaseColorModeSelect ? String(showcaseColorModeSelect.value || '').toLowerCase().trim() : '';
    showcase.color_mode = ['light', 'dark', 'auto'].includes(selectedShowcaseMode) ? selectedShowcaseMode : 'auto';
    showcase.default_sort = {
        pens: showcaseSortPensSelect ? String(showcaseSortPensSelect.value || 'newest') : 'newest',
        inks: showcaseSortInksSelect ? String(showcaseSortInksSelect.value || 'newest') : 'newest',
        swatches: showcaseSortSwatchesSelect ? String(showcaseSortSwatchesSelect.value || 'newest') : 'newest'
    };
    const selectedMode = colorModeSelect ? String(colorModeSelect.value || '').toLowerCase().trim() : '';
    prefs.color_mode = ['light', 'dark', 'auto'].includes(selectedMode) ? selectedMode : 'auto';
    prefs.open_cards_in_edit_mode = !!(toggleOpenCardsEditMode && toggleOpenCardsEditMode.checked);
    prefs.confirm_destructive_actions = !!(toggleConfirmDestructive && toggleConfirmDestructive.checked);
    prefs.activity_log_verbosity = activityLogVerbositySelect ? String(activityLogVerbositySelect.value || 'normal') : 'normal';
    prefs.activity_log_filters = {
        pen_edits: !!(toggleLogPenEdits && toggleLogPenEdits.checked),
        ink_edits: !!(toggleLogInkEdits && toggleLogInkEdits.checked),
        swatches: !!(toggleLogSwatchEvents && toggleLogSwatchEvents.checked),
        deletes: !!(toggleLogDeleteEvents && toggleLogDeleteEvents.checked)
    };
    const existingCategoryPrefs = getActivityLogCategoryPreferences();
    prefs.activity_log_categories = {
        pen: !!existingCategoryPrefs.pen,
        ink: !!existingCategoryPrefs.ink,
        swatch: !!existingCategoryPrefs.swatch
    };
    prefs.defaults = {
        currency: defaultCurrencySelect ? String(defaultCurrencySelect.value || 'USD').toUpperCase() : 'USD',
        date_format: defaultDateFormatSelect ? String(defaultDateFormatSelect.value || 'system').toLowerCase() : 'system',
        pen_nib: defaultPenNibInput ? String(defaultPenNibInput.value || '').trim() : '',
        pen_nib_material: defaultPenNibMaterialInput ? String(defaultPenNibMaterialInput.value || '').trim() : '',
        pen_status: defaultPenStatusSelect ? String(defaultPenStatusSelect.value || '').toLowerCase() : '',
        ink_type: defaultInkTypeSelect ? String(defaultInkTypeSelect.value || '') : ''
    };
    prefs.import_export = {
        auto_validate_import: !!(toggleImportAutoValidate && toggleImportAutoValidate.checked),
        conflict_behavior: importConflictBehaviorSelect ? String(importConflictBehaviorSelect.value || 'overwrite').toLowerCase() : 'overwrite',
        include_optional_metadata: !!(toggleExportIncludeMetadata && toggleExportIncludeMetadata.checked)
    };
    prefs.backup = {
        auto_frequency: autoBackupFrequencySelect ? String(autoBackupFrequencySelect.value || 'daily').toLowerCase() : 'daily',
        retention_count: backupRetentionCountInput ? Math.max(1, Math.min(365, Number(backupRetentionCountInput.value) || 30)) : 30,
        include_images: true,
        keep_replaced_images: !!(toggleBackupKeepReplacedImages && toggleBackupKeepReplacedImages.checked)
    };
    prefs.showcase = showcase;
    appData.preferences = prefs;
    updateInkPricePrefix();
    applyShowcaseTitleUi();
    applyInterfacePreferences();
    applyShowcaseSortDefaults();
    applyShowcaseSectionVisibility();
    refreshBackupEffectiveStatus();
    if (!isManagerApp) {
        const lastView = localStorage.getItem('lastView') || 'dashboard';
        if (
            (lastView === 'pens' && shouldHidePensInShowcase()) ||
            (lastView === 'inks' && shouldHideInksInShowcase()) ||
            (lastView === 'swatches' && shouldHideSwatchesInShowcase()) ||
            (lastView === 'activity' && shouldHideActivityInShowcase())
        ) {
            switchView('dashboard');
        }
    }
}

async function persistShowcaseSettingsNow({ force = false, notify = true } = {}) {
    if (!isManagerApp) return false;
    if (!force && (suppressSettingsPersist || showcaseExportInFlight)) return false;
    applyShowcaseSettingsFromForm();
    const saved = await persistDataAndRefresh({
        refresh: {
            dashboard: true,
            stats: true,
            activity: true,
            pens: true,
            inks: true,
            swatches: true
        },
        onErrorMessage: 'Failed to save showcase settings.'
    });
    if (saved && notify) {
        showAppNotice('Settings saved', 'success');
    }
    return saved;
}

function persistShowcaseSettings() {
    void persistShowcaseSettingsNow();
}

let settingsInputPersistTimer = null;
function persistShowcaseSettingsDebounced() {
    if (settingsInputPersistTimer) {
        clearTimeout(settingsInputPersistTimer);
    }
    settingsInputPersistTimer = setTimeout(() => {
        settingsInputPersistTimer = null;
        persistShowcaseSettings();
    }, 500);
}

function renderPens() {
    if (!pensGrid) return;
    pensGrid.innerHTML = '';

    try {
        let pens = [...(appData.pens || [])];

        // 1. Apply Search Filter
        if (searchPensQuery) {
            const q = searchPensQuery.toLowerCase();
            pens = pens.filter(p =>
                p.model.toLowerCase().includes(q) ||
                p.brand.toLowerCase().includes(q) ||
                (p.nib && p.nib.toLowerCase().includes(q)) ||
                (p.material && p.material.toLowerCase().includes(q)) ||
                (p.notes && p.notes.toLowerCase().includes(q))
            );
        }

        // 2. Apply Custom Filters
        pens = pens.filter(pen => {
            if (activePensFilters.brand.length > 0 && !activePensFilters.brand.includes(pen.brand)) return false;
            if (activePensFilters.nib.length > 0 && !activePensFilters.nib.includes(pen.nib)) return false;
            if (activePensFilters.nib_material.length > 0 && !activePensFilters.nib_material.includes(pen.nib_material)) return false;
            if (!valueMatchesFilter(pen.material, activePensFilters.material)) return false;
            if (!valueMatchesFilter(pen.filling_system, activePensFilters.filling_system)) return false;
            if (!valueMatchesFilter(pen.color, activePensFilters.color)) return false;

            if (activePensFilters.status.length > 0) {
                const isInked = (appData.currently_inked || []).some(i => i.pen_id === pen.id);
                const status = isInked ? 'Inked' : 'Resting';
                if (!activePensFilters.status.includes(status)) return false;
            }

            return true;
        });

        // 3. Apply Sorting
        pens.sort((a, b) => {
            if (activePensSort === 'model-asc') return a.model.localeCompare(b.model);
            if (activePensSort === 'model-desc') return b.model.localeCompare(a.model);
            if (activePensSort === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
            if (activePensSort === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
            if (activePensSort === 'newest') return b.id.localeCompare(a.id); // Assuming ID has timestamp
            if (activePensSort === 'oldest') return a.id.localeCompare(b.id);
            return 0;
        });

        if (pens.length === 0) {
            pensGrid.innerHTML = `<div class="empty-state">No pens found.</div>`;
            return;
        }

        pens.forEach(pen => {
            const card = document.createElement('div');
            card.className = 'pen-card-horizontal glass-panel';
            card.onclick = () => {
                if (isManagerApp && shouldOpenCardsInEditMode()) {
                    openPenModal(pen.id);
                } else {
                    openPenDetailModal(pen.id, 'pens');
                }
            };

            // Check if this pen is currently inked
            const currentlyInkedArr = appData.currently_inked || [];
            const inkedData = currentlyInkedArr.find(i => i.pen_id === pen.id);
            const isInked = !!inkedData;

            let inkedStatusHTML = '';
            if (isInked) {
                const ink = appData.inks.find(i => i.id === inkedData.ink_id);
                // Use color_base as the property name for ink colors
                const inkColor = ink ? (ink.color_base || '#888') : '#888';
                const inkName = ink ? `${ink.brand} ${ink.name}` : 'Unknown Ink';
                inkedStatusHTML = `
                    <div class="pen-card-inked-status">
                        <div class="pen-card-ink-dot" style="background: ${inkColor};"></div>
                        <span>${inkName}</span>
                    </div>
                `;
            } else {
                inkedStatusHTML = `
                    <div class="pen-card-inked-status" style="color: #bbb;">
                        <i class="ph ph-moon" style="font-size: 13px;"></i>
                        <span>Resting</span>
                    </div>
                `;
            }

            const imagePath = (pen.image && pen.image !== 'default_pen.png')
                ? resolveImageSource(pen.image)
                : null;

            // If image is present, use a neutral background. 
            // If no image, use the first color as the "profile photo" color.
            const backgroundStyle = imagePath
                ? `background: #f9f9f9;`
                : (pen.hex_color ? `background: ${pen.hex_color};` : `background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);`);

            const rotation = pen.image_rotation || 0;
            const is90 = rotation === 90 || rotation === 270;
            const imgClass = is90 ? 'pen-photo-rotated' : '';
            const imgStyle = is90 ? `--rot: ${rotation}deg;` : `width: 100%; height: 100%; object-fit: cover; transform: rotate(${rotation}deg);`;
            const safeBrand = escapeHtml(pen.brand || '');
            const safeModel = escapeHtml(pen.model || '');
            const safeFillingSystem = escapeHtml(pen.filling_system || 'Standard');
            const safeNib = escapeHtml(pen.nib || '');
            const safeNibMaterial = escapeHtml(pen.nib_material || 'Steel');

            card.innerHTML = `
                <div class="pen-card-visual" style="${backgroundStyle}">
                    ${imagePath ? `<img src="${imagePath}" class="${imgClass}" style="${imgStyle}">` : `<i class="ph ph-pen-nib" style="font-size: 40px; color: rgba(0,0,0,0.1);"></i>`}
                </div>
                <div class="pen-card-info">
                    <div class="pen-card-brand">${safeBrand}</div>
                    <div class="pen-card-model">${safeModel}</div>
                    <div class="pen-card-meta">
                        <span>${safeFillingSystem}</span>
                        <span>${safeNib}</span>
                        <span>${safeNibMaterial}</span>
                    </div>
                    ${inkedStatusHTML}
                </div>
            `;
            pensGrid.appendChild(card);
        });
    } catch (e) {
        console.error("Pens Render Failed:", e);
        pensGrid.innerHTML = `<div style="color: red; padding: 20px;">Error rendering pens.</div>`;
    }
}


// Modal Logic
// Modal Logic (Updated for Multiple Modals)
const modalInk = document.getElementById('modal-ink');
const modalPen = document.getElementById('modal-pen');
const btnSaveInk = document.getElementById('btn-save-ink');
const btnSavePen = document.getElementById('btn-save-pen');
// Header Buttons (Already declared at top)
// const btnAddPenHeader = document.getElementById('btn-add-pen-header');

// Inputs
const inkNameInput = document.getElementById('ink-name-input');
const inkBrandInput = document.getElementById('ink-brand-input');
const penBrandInput = document.getElementById('pen-brand-input');
const penModelInput = document.getElementById('pen-model-input');
const penNibInput = document.getElementById('pen-nib-input');
const penNibMaterialInput = document.getElementById('pen-nib-material-input');
const penMaterialInput = document.getElementById('pen-material-input');
const penFillingSystemInput = document.getElementById('pen-filling-system-input');
const penColorInput = document.getElementById('pen-color-input');
const penPriceInput = document.getElementById('pen-price-input');
const penNotesInput = document.getElementById('pen-notes-input');

// Delete Buttons
const btnDeleteInk = document.getElementById('btn-delete-ink');
const btnDeletePen = document.getElementById('btn-delete-pen');

const penColorsList = document.getElementById('pen-colors-list');
const btnAddPenColor = document.getElementById('btn-add-pen-color');
const inkColorsList = document.getElementById('ink-colors-list');
const btnAddInkColor = document.getElementById('btn-add-ink-color');

const uploadPenPhotoArea = document.getElementById('upload-pen-photo-area');
const uploadPenPreview = document.getElementById('upload-pen-preview');
const penPhotoIcon = document.getElementById('pen-photo-icon');
const penPhotoText = document.getElementById('pen-photo-text');
const penPhotoControls = document.getElementById('pen-photo-controls');

let currentEditingId = null;
let currentPenColors = [];
let currentPenSuggestedColors = [];
let currentInkColors = [];
let currentPenImagePath = null;
let penImageRemoved = false; // Add flag to track explicit removal
let currentPenRotation = 0;
const btnRotatePen = document.getElementById('btn-rotate-pen');
const btnRemovePenPhoto = document.getElementById('btn-remove-pen-photo');

// Ink Photo Handling
const inkImageArea = document.getElementById('ink-image-area');
const inkImagePreview = document.getElementById('ink-image-preview');
let currentSelectedImagePath = null;

if (inkImageArea) {
    inkImageArea.addEventListener('click', async () => {
        if (!isManagerApp) return alert("Upload is only available in the Manager app.");
        let filePath = null;
        try {
            filePath = await desktopAPI.selectImage();
        } catch (error) {
            alert(`Image selection failed: ${error && error.message ? error.message : error}`);
            return;
        }
        if (filePath) {
            currentSelectedImagePath = filePath;
            const icon = inkImageArea.querySelector('i');
            const label = inkImageArea.querySelector('p');
            inkImageArea.classList.add('is-processing');
            if (icon) {
                icon.classList.remove('ph-image');
                icon.classList.add('ph-circle-notch', 'is-loading');
            }
            if (label) label.textContent = isHeicImagePath(filePath) ? 'Processing image...' : 'Loading image...';
            const previewSrc = await getLocalImagePreviewSource(filePath);
            inkImagePreview.onload = () => {
                const colors = extractInkColors(inkImagePreview);
                if (colors) {
                    currentInkColors = [];
                    if (colors.base) currentInkColors.push(colors.base);
                    if (colors.accent && colors.accent !== colors.base) currentInkColors.push(colors.accent);
                    renderInkColorSlots();
                }
                inkImagePreview.onload = null;
                inkImageArea.classList.remove('is-processing');
                if (icon) {
                    icon.classList.remove('ph-circle-notch', 'is-loading');
                    icon.classList.add('ph-image');
                }
            };
            inkImagePreview.src = previewSrc;
            inkImagePreview.style.display = 'block';
            if (icon) icon.style.display = 'none';
            if (label) {
                label.textContent = 'Click to upload image';
                label.style.display = 'none';
            }
        }
    });
}

async function openInkModal(inkId = null) {
    if (!(await requestCloseAllModals())) return;
    resetOverlayState();

    activateModal(modalInk);
    document.getElementById('ink-validation-msg').style.display = 'none';
    currentEditingId = inkId;
    currentSelectedImagePath = null;
    if (uploadPenPreview) uploadPenPreview.onload = null;

    if (inkImagePreview) {
        inkImagePreview.style.display = 'none';
        inkImagePreview.src = '';
    }
    if (inkImageArea) {
        const icon = inkImageArea.querySelector('i');
        const label = inkImageArea.querySelector('p');
        inkImageArea.classList.remove('is-processing');
        if (icon) {
            icon.classList.remove('ph-circle-notch', 'is-loading');
            icon.classList.add('ph-image');
            icon.style.display = 'block';
        }
        if (label) {
            label.textContent = 'Click to upload image';
            label.style.display = 'block';
        }
    }

    if (inkId && typeof inkId === 'string') {
        const ink = appData.inks.find(i => i.id === inkId);
        if (ink) {
            inkNameInput.value = ink.name;
            if (inkBrandInput) inkBrandInput.value = ink.brand || '';

            // New fields
            if (document.getElementById('ink-line-input')) document.getElementById('ink-line-input').value = ink.line || '';
            setCustomSelectValue('ink-type-input', normalizeInkType(ink.type) || 'Bottle');
            if (document.getElementById('ink-cl-input')) document.getElementById('ink-cl-input').value = ink.cl || '';
            if (document.getElementById('ink-amount-input')) document.getElementById('ink-amount-input').value = ink.amount || '1';
            if (document.getElementById('ink-price-input')) document.getElementById('ink-price-input').value = ink.price || '';

            if (ink.image && inkImagePreview) {
                inkImagePreview.src = resolveImageSource(ink.image);
                inkImagePreview.style.display = 'block';
                inkImageArea.querySelector('i').style.display = 'none';
                inkImageArea.querySelector('p').style.display = 'none';
            }

            // Initialize Colors
            initInkColors(ink.hex_colors, ink.color_base, ink.color_accent);

            // New Characteristics (Sorting as requested)
            setCustomSelectValue('ink-shading', ink.shading || 'None');
            setCustomSelectValue('ink-sheen', ink.sheen || 'None');
            setCustomSelectValue('ink-shimmer', ink.shimmer || 'None');
            setCustomSelectValue('ink-flow', ink.flow || 'Average');
            setCustomSelectValue('ink-lubrication', ink.lubrication || 'None');
            if (document.getElementById('ink-dry-time')) document.getElementById('ink-dry-time').value = ink.dry_time || '';
            setCustomSelectValue('ink-permanence', ink.permanence || 'None');

            // Multiselect for Base Type
            const baseTypeCheckboxes = document.querySelectorAll('#base-type-popover input[type="checkbox"]');
            baseTypeCheckboxes.forEach(cb => {
                cb.checked = (ink.base_type || []).includes(cb.value);
            });
            updateMultiselectHeader('base-type');

            // Multiselect for Paper Compatibility
            const paperCheckboxes = document.querySelectorAll('#paper-compatibility-popover input[type="checkbox"]');
            paperCheckboxes.forEach(cb => {
                cb.checked = (ink.paper_compatibility || []).includes(cb.value);
            });
            updateMultiselectHeader('paper-compatibility');

            if (document.getElementById('ink-notes')) document.getElementById('ink-notes').value = ink.notes || '';

            btnSaveInk.textContent = 'Save Changes';
            if (btnDeleteInk) btnDeleteInk.style.display = 'inline-block'; // Show delete button
            modalInk.querySelector('h2').textContent = 'Edit Ink';
        }
    } else {
        const defaults = getDefaultsPreferences();
        // Force re-enable inputs in case they got stuck
        const inputs = modalInk.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.disabled = false;
            input.readOnly = false;
            input.style.pointerEvents = 'auto';
        });

        if (inkBrandInput) {
            inkBrandInput.value = '';
            setTimeout(() => {
                inkBrandInput.focus();
                inkBrandInput.click(); // Triggers any click listeners if needed
            }, 100);
        }
        if (inkNameInput) inkNameInput.value = '';

        // Reset all new fields
        if (document.getElementById('ink-line-input')) document.getElementById('ink-line-input').value = '';
        setCustomSelectValue('ink-type-input', String(defaults.ink_type || ''));
        if (document.getElementById('ink-cl-input')) document.getElementById('ink-cl-input').value = '';
        if (document.getElementById('ink-amount-input')) document.getElementById('ink-amount-input').value = '1';
        if (document.getElementById('ink-price-input')) document.getElementById('ink-price-input').value = '';

        setCustomSelectValue('ink-shading', 'None');
        setCustomSelectValue('ink-sheen', 'None');
        setCustomSelectValue('ink-shimmer', 'None');
        setCustomSelectValue('ink-flow', 'Average');
        setCustomSelectValue('ink-lubrication', 'None');
        if (document.getElementById('ink-dry-time')) document.getElementById('ink-dry-time').value = '';
        setCustomSelectValue('ink-permanence', 'None');

        // Initialize Colors (Default)
        initInkColors([], '#4a0e28', '#9e2a6b');

        // Reset Multiselects
        const baseTypeCheckboxes = document.querySelectorAll('#base-type-popover input[type="checkbox"]');
        baseTypeCheckboxes.forEach(cb => cb.checked = false);
        updateMultiselectHeader('base-type');

        // Reset Multiselect
        const paperCheckboxes = document.querySelectorAll('#paper-compatibility-popover input[type="checkbox"]');
        paperCheckboxes.forEach(cb => cb.checked = false);
        updateMultiselectHeader('paper-compatibility');

        if (document.getElementById('ink-notes')) document.getElementById('ink-notes').value = '';



        btnSaveInk.textContent = 'Save to Collection';
        if (btnDeleteInk) btnDeleteInk.style.display = 'none';
        modalInk.querySelector('h2').textContent = 'Add New Ink';
    }
    captureModalDraftSnapshot('ink');
}

// Multiselect Logic
// Multiselect Logic (Popover Version)
function setupMultiselectPopover(id) {
    const popover = document.getElementById(`${id}-popover`);
    const btn = document.querySelector(`[popovertarget="${id}-popover"]`);

    if (!popover || !btn) return;

    // Positioning Logic
    const positionPopover = () => {
        const rect = btn.getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
        popover.style.left = `${rect.left + window.scrollX}px`;
        popover.style.width = `${rect.width}px`;
    };

    btn.addEventListener('click', () => {
        setTimeout(positionPopover, 0);
    });

    // Update Header Text on Change
    popover.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => updateMultiselectHeader(id));
    });
}

function updateMultiselectHeader(id) {
    const header = document.getElementById(`${id}-header`);
    const popover = document.getElementById(`${id}-popover`);
    if (!header || !popover) return;

    const selected = Array.from(popover.querySelectorAll('input:checked')).map(cb => cb.value);
    const placeholder = header.querySelector('.placeholder');
    if (!placeholder) return;

    if (selected.length === 0) {
        placeholder.textContent = placeholder.dataset.default || 'Select properties...';
        placeholder.classList.remove('has-value');
    } else {
        placeholder.textContent = selected.join(', ');
        placeholder.classList.add('has-value');
    }
}

// Global Multiselect Init
document.addEventListener('DOMContentLoaded', () => {
    setupMultiselectPopover('paper-compatibility');
    setupMultiselectPopover('base-type');
});

// Ink Selection in Pen Modal
const penInkSelect = document.getElementById('pen-ink-select');

// --- Pen Color Dynamic System ---

function renderPenColorSlots() {
    if (!penColorsList) return;
    if (!Array.isArray(currentPenColors) || currentPenColors.length === 0) {
        currentPenColors = ['#ffffff'];
    }

    // Remove existing slots (keep the add button)
    const existingSlots = penColorsList.querySelectorAll('.dynamic-color-slot:not(.add-slot)');
    existingSlots.forEach(slot => slot.remove());

    currentPenColors.forEach((hex, index) => {
        const slot = document.createElement('div');
        slot.className = 'dynamic-color-slot';
        slot.innerHTML = `
            <div class="color-picker-wrapper">
                <input type="color" value="${hex}" data-index="${index}">
            </div>
            <input type="text" value="${hex}" data-index="${index}" placeholder="#HEX">
            <div class="remove-color-btn" data-index="${index}"><i class="ph ph-x"></i></div>
        `;

        // Sync Hex Input -> Picker
        const hexInput = slot.querySelector('input[type="text"]');
        const picker = slot.querySelector('input[type="color"]');

        picker.addEventListener('input', (e) => {
            const newHex = e.target.value;
            hexInput.value = newHex;
            currentPenColors[index] = newHex;
        });

        hexInput.addEventListener('input', (e) => {
            let newHex = e.target.value;
            if (newHex.startsWith('#') && (newHex.length === 4 || newHex.length === 7)) {
                picker.value = newHex;
                currentPenColors[index] = newHex;
            }
        });

        const removeBtn = slot.querySelector('.remove-color-btn');
        if (removeBtn) {
            removeBtn.onclick = () => {
                if (currentPenColors.length <= 1) {
                    currentPenColors[0] = '#ffffff';
                } else {
                    currentPenColors.splice(index, 1);
                }
                renderPenColorSlots();
            };
        }

        penColorsList.insertBefore(slot, document.getElementById('pen-add-color-wrapper'));
    });

    // Toggle Add Button Visibility
    const penAddWrapper = document.getElementById('pen-add-color-wrapper');
    if (penAddWrapper) {
        if (currentPenColors.length >= 4) {
            penAddWrapper.classList.add('is-hidden');
        } else {
            penAddWrapper.classList.remove('is-hidden');
        }
    }
}

function getNextSuggestedPenColor() {
    const suggestions = Array.isArray(currentPenSuggestedColors) ? currentPenSuggestedColors : [];
    if (suggestions.length === 0) return null;
    const used = new Set((currentPenColors || []).map(c => (c || '').toLowerCase()));
    for (const color of suggestions) {
        const normalized = (color || '').toLowerCase();
        if (!normalized) continue;
        if (!used.has(normalized)) return color;
    }
    return null;
}

if (btnAddPenColor) {
    btnAddPenColor.onclick = () => {
        if (currentPenColors.length < 4) {
            const nextSuggested = getNextSuggestedPenColor();
            currentPenColors.push(nextSuggested || '#ffffff');
            renderPenColorSlots();
        }
    };
}

function initPenColors(colorsInput) {
    if (Array.isArray(colorsInput)) {
        currentPenColors = [...colorsInput];
    } else if (typeof colorsInput === 'string' && colorsInput.trim()) {
        currentPenColors = [colorsInput];
    } else {
        currentPenColors = ['#ffffff']; // Default
    }
    currentPenSuggestedColors = [];
    renderPenColorSlots();
}

function getPenColors() {
    return currentPenColors;
}

// --- Ink Color Dynamic System ---

function renderInkColorSlots() {
    if (!inkColorsList) return;
    if (!Array.isArray(currentInkColors) || currentInkColors.length === 0) {
        currentInkColors = ['#4a0e28'];
    }

    // Remove existing slots (keep the add button)
    const existingSlots = inkColorsList.querySelectorAll('.dynamic-color-slot:not(.add-slot)');
    existingSlots.forEach(slot => slot.remove());

    currentInkColors.forEach((hex, index) => {
        const slot = document.createElement('div');
        slot.className = 'dynamic-color-slot';
        slot.innerHTML = `
            <div class="color-picker-wrapper">
                <input type="color" value="${hex}" data-index="${index}">
            </div>
            <input type="text" value="${hex}" data-index="${index}" placeholder="#HEX">
            ${currentInkColors.length > 1 ? `<div class="remove-color-btn" data-index="${index}"><i class="ph ph-x"></i></div>` : ''}
        `;

        // Sync Hex Input -> Picker
        const hexInput = slot.querySelector('input[type="text"]');
        const picker = slot.querySelector('input[type="color"]');

        picker.addEventListener('input', (e) => {
            const newHex = e.target.value;
            hexInput.value = newHex;
            currentInkColors[index] = newHex;
        });

        hexInput.addEventListener('input', (e) => {
            let newHex = e.target.value;
            if (newHex.startsWith('#') && (newHex.length === 4 || newHex.length === 7)) {
                picker.value = newHex;
                currentInkColors[index] = newHex;
            }
        });

        const removeBtn = slot.querySelector('.remove-color-btn');
        if (removeBtn) {
            removeBtn.onclick = () => {
                currentInkColors.splice(index, 1);
                renderInkColorSlots();
            };
        }

        inkColorsList.insertBefore(slot, document.getElementById('ink-add-color-wrapper'));
    });

    // Toggle Add Button Visibility
    const inkAddWrapper = document.getElementById('ink-add-color-wrapper');
    if (inkAddWrapper) {
        if (currentInkColors.length >= 4) {
            inkAddWrapper.classList.add('is-hidden');
        } else {
            inkAddWrapper.classList.remove('is-hidden');
        }
    }
}

if (btnAddInkColor) {
    btnAddInkColor.onclick = () => {
        if (currentInkColors.length < 4) {
            currentInkColors.push('#ffffff');
            renderInkColorSlots();
        }
    };
}

function initInkColors(colorsInput, fallbackBase, fallbackAccent) {
    if (Array.isArray(colorsInput) && colorsInput.length > 0) {
        currentInkColors = [...colorsInput];
    } else {
        // Fallback for migration
        currentInkColors = [];
        if (fallbackBase) currentInkColors.push(fallbackBase);
        if (fallbackAccent && fallbackAccent !== fallbackBase) currentInkColors.push(fallbackAccent);

        if (currentInkColors.length === 0) {
            currentInkColors = ['#4a0e28']; // Default baseline
        }
    }
    renderInkColorSlots();
}

function getInkColors() {
    return currentInkColors;
}

// --- End Ink Color System ---

// --- End Pen Color System ---

async function openPenModal(penId = null) {
    if (!(await requestCloseAllModals())) return;
    resetOverlayState();
    activateModal(modalPen);
    document.getElementById('pen-validation-msg').style.display = 'none';
    currentEditingId = penId;
    penImageRemoved = false; // Reset flag on open
    if (uploadPenPreview) uploadPenPreview.onload = null; // Prevent auto-extraction on load

    // Populate Ink Select
    // Populate Ink Select Custom Options
    const inkSelectOptions = document.getElementById('pen-ink-select-options');
    if (inkSelectOptions) {
        const sortedLibraryInks = [...getLibraryInks()].sort((a, b) => {
            const nameCompare = String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
            if (nameCompare !== 0) return nameCompare;
            return String(a?.brand || '').localeCompare(String(b?.brand || ''), undefined, { sensitivity: 'base' });
        });
        let html = `<div class="custom-option" data-value="">Nothing (Clean)</div>`;
        sortedLibraryInks.forEach(ink => {
            const safeInkId = escapeHtml(ink.id || '');
            const safeInkName = escapeHtml(ink.name || '');
            const safeInkBrand = escapeHtml(ink.brand || '');
            html += `<div class="custom-option" data-value="${safeInkId}">${safeInkName} (${safeInkBrand})</div>`;
        });
        inkSelectOptions.innerHTML = html;
        // Re-bind click events for new options
        setupCustomSelectOptions(inkSelectOptions);
    }

    if (penId && typeof penId === 'string') {
        // Edit Mode
        const pen = appData.pens.find(p => p.id === penId);
        if (pen) {
            penBrandInput.value = pen.brand || '';
            penModelInput.value = pen.model || '';
            penNibInput.value = pen.nib || '';
            penNibMaterialInput.value = pen.nib_material || '';
            penMaterialInput.value = pen.material || '';
            if (penFillingSystemInput) penFillingSystemInput.value = pen.filling_system || '';
            if (penColorInput) penColorInput.value = pen.color || '';
            if (penPriceInput) penPriceInput.value = pen.price || '';
            if (penNotesInput) penNotesInput.value = pen.notes || '';

            // Initialize Colors
            initPenColors(pen.hex_colors || pen.hex_color);

            currentPenRotation = pen.image_rotation || 0;
            if (uploadPenPreview) {
                updatePenPreviewStyle(currentPenRotation);
            }

            if (penPhotoControls) {
                penPhotoControls.style.display = (pen.image && pen.image !== 'default_pen.png') ? 'flex' : 'none';
            }

            // Show existing image
            if (pen.image && pen.image !== 'default_pen.png') {
                const imagePath = resolveImageSource(pen.image);
                if (uploadPenPreview) {
                    uploadPenPreview.src = imagePath;
                    uploadPenPreview.style.display = 'block';
                }
                if (penPhotoIcon) penPhotoIcon.style.display = 'none';
                if (penPhotoText) penPhotoText.style.display = 'none';
                currentPenImagePath = null; // Don't set to relative path, saveNewPen handles existing image
            } else {
                if (uploadPenPreview) {
                    uploadPenPreview.src = '';
                    uploadPenPreview.style.display = 'none';
                }
                if (penPhotoControls) penPhotoControls.style.display = 'none';
                if (penPhotoIcon) penPhotoIcon.style.display = 'block';
                if (penPhotoText) penPhotoText.style.display = 'block';
                currentPenImagePath = null;
                currentPenRotation = 0;
            }

            // Set currently inked status
            if (penInkSelect) {
                const currentInk = appData.currently_inked.find(ci => ci.pen_id === penId);
                setCustomSelectValue('pen-ink-select', currentInk ? currentInk.ink_id : "");
            }

            btnSavePen.textContent = 'Update Pen';
            if (btnDeletePen) btnDeletePen.style.display = 'block';
            modalPen.querySelector('h2').textContent = 'Edit Pen';
        }
    } else {
        const defaults = getDefaultsPreferences();
        // Create Mode
        // Force re-enable pen inputs in case they got stuck
        const inputs = modalPen.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = false;
            input.readOnly = false; // Except specific ones if needed?
            input.style.pointerEvents = 'auto';
        });

        if (penBrandInput) {
            penBrandInput.value = '';
            setTimeout(() => {
                penBrandInput.focus();
                penBrandInput.click();
            }, 100);
        }
        if (penModelInput) penModelInput.value = '';
        if (penNibInput) penNibInput.value = String(defaults.pen_nib || '');
        if (penNibMaterialInput) penNibMaterialInput.value = String(defaults.pen_nib_material || '');
        if (penMaterialInput) penMaterialInput.value = '';
        if (penFillingSystemInput) penFillingSystemInput.value = '';
        if (penColorInput) penColorInput.value = '';
        if (penPriceInput) penPriceInput.value = '';
        if (penNotesInput) penNotesInput.value = '';

        // Initialize Colors (Empty/Default)
        initPenColors([]);

        currentPenRotation = 0;
        if (uploadPenPreview) {
            uploadPenPreview.src = '';
            uploadPenPreview.style.display = 'none';
            uploadPenPreview.className = '';
            uploadPenPreview.style.transform = 'rotate(0deg)';
        }
        if (penPhotoControls) penPhotoControls.style.display = 'none';
        if (penPhotoIcon) penPhotoIcon.style.display = 'block';
        if (penPhotoText) penPhotoText.style.display = 'block';
        currentPenImagePath = null;

        if (penInkSelect) {
            if (String(defaults.pen_status || '') === 'inked') {
                const firstInk = [...(getLibraryInks() || [])]
                    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))[0];
                setCustomSelectValue('pen-ink-select', firstInk ? firstInk.id : "");
            } else {
                setCustomSelectValue('pen-ink-select', "");
            }
        }

        btnSavePen.textContent = 'Add Pen';
        if (btnDeletePen) btnDeletePen.style.display = 'none';
        modalPen.querySelector('h2').textContent = 'Add New Pen';
    }
    captureModalDraftSnapshot('pen');
}

let modalLifecycle = null;
const modalDraftSnapshots = {
    ink: '',
    pen: '',
    swatch: ''
};

function getModalLifecycle() {
    if (modalLifecycle) return modalLifecycle;
    if (!window.PenStationModalLifecycle || typeof window.PenStationModalLifecycle.createModalLifecycle !== 'function') {
        return null;
    }
    modalLifecycle = window.PenStationModalLifecycle.createModalLifecycle({
        focusWindow: () => {
            if (desktopAPI && typeof desktopAPI.focusWindow === 'function') {
                desktopAPI.focusWindow();
            }
        }
    });
    return modalLifecycle;
}

function clearAllModalDraftSnapshots() {
    modalDraftSnapshots.ink = '';
    modalDraftSnapshots.pen = '';
    modalDraftSnapshots.swatch = '';
}

function normalizeDraftArray(values) {
    if (!Array.isArray(values)) return [];
    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function getCheckedModalValues(selector) {
    return Array.from(document.querySelectorAll(selector))
        .filter((input) => input && input.checked)
        .map((input) => String(input.value || ''));
}

function getInkModalExistingImagePath() {
    const inkId = typeof currentEditingId === 'string' ? currentEditingId : '';
    const ink = inkId ? findInkById(inkId) : null;
    return ink && ink.image ? ink.image : '';
}

function getInkModalDraftState() {
    return JSON.stringify({
        name: inkNameInput ? inkNameInput.value : '',
        brand: inkBrandInput ? inkBrandInput.value : '',
        line: document.getElementById('ink-line-input')?.value || '',
        type: normalizeInkType(document.getElementById('ink-type-input')?.value) || 'Bottle',
        cl: document.getElementById('ink-cl-input')?.value || '',
        amount: document.getElementById('ink-amount-input')?.value || '1',
        price: document.getElementById('ink-price-input')?.value || '',
        shading: document.getElementById('ink-shading')?.value || 'None',
        sheen: document.getElementById('ink-sheen')?.value || 'None',
        shimmer: document.getElementById('ink-shimmer')?.value || 'None',
        flow: document.getElementById('ink-flow')?.value || 'Average',
        lubrication: document.getElementById('ink-lubrication')?.value || 'None',
        dryTime: document.getElementById('ink-dry-time')?.value || '',
        permanence: document.getElementById('ink-permanence')?.value || 'None',
        baseType: getCheckedModalValues('#base-type-popover input[type="checkbox"]'),
        paperCompatibility: getCheckedModalValues('#paper-compatibility-popover input[type="checkbox"]'),
        notes: document.getElementById('ink-notes')?.value || '',
        colors: normalizeDraftArray(getInkColors()),
        image: currentSelectedImagePath || getInkModalExistingImagePath()
    });
}

function getPenModalExistingImagePath() {
    const penId = typeof currentEditingId === 'string' ? currentEditingId : '';
    const pen = penId ? findPenById(penId) : null;
    return pen && pen.image && pen.image !== 'default_pen.png' ? pen.image : '';
}

function getPenModalEffectiveImagePath() {
    if (currentPenImagePath) return currentPenImagePath;
    if (penImageRemoved) return '';
    return getPenModalExistingImagePath();
}

function getPenModalDraftState() {
    const effectiveImagePath = getPenModalEffectiveImagePath();
    return JSON.stringify({
        brand: penBrandInput ? penBrandInput.value : '',
        model: penModelInput ? penModelInput.value : '',
        nib: penNibInput ? penNibInput.value : '',
        nibMaterial: penNibMaterialInput ? penNibMaterialInput.value : '',
        material: penMaterialInput ? normalizeCsvValues(penMaterialInput.value).join(', ') : '',
        fillingSystem: penFillingSystemInput ? normalizeCsvValues(penFillingSystemInput.value).join(', ') : '',
        color: penColorInput ? normalizeCsvValues(penColorInput.value).join(', ') : '',
        price: penPriceInput ? penPriceInput.value : '',
        notes: penNotesInput ? penNotesInput.value : '',
        inkId: penInkSelect ? String(penInkSelect.value || '') : '',
        colors: normalizeDraftArray(getPenColors()),
        image: effectiveImagePath,
        imageRotation: effectiveImagePath ? currentPenRotation : 0
    });
}

function getSwatchModalExistingImagePath() {
    const swatch = currentEditingSwatchId ? getSwatchById(currentEditingSwatchId) : null;
    return swatch && swatch.image ? swatch.image : '';
}

function getSwatchModalEffectiveImagePath() {
    if (currentSwatchImageCandidate && typeof currentSwatchImageCandidate === 'object') {
        const type = String(currentSwatchImageCandidate.type || 'image');
        const value = String(currentSwatchImageCandidate.value || '');
        return `${type}:${value}`;
    }
    return getSwatchModalExistingImagePath();
}

function getSwatchModalDraftState() {
    return JSON.stringify({
        inkId: document.getElementById('fetch-swatch-ink-input')?.value || '',
        matchedName: document.getElementById('fetch-swatch-name-auto')?.value || '',
        manualUrl: document.getElementById('fetch-swatch-url-manual')?.value || '',
        paper: document.getElementById('swatch-paper-input')?.value || '',
        nib: document.getElementById('swatch-nib-input')?.value || '',
        date: document.getElementById('swatch-date-input')?.value || '',
        lighting: document.getElementById('swatch-lighting-input')?.value || 'Unknown',
        notes: document.getElementById('swatch-notes-input')?.value || '',
        image: getSwatchModalEffectiveImagePath()
    });
}

function getVisibleFormModalKey() {
    const addSwatchModal = document.getElementById('modal-add-swatch');
    if (isModalVisible(modalInk)) return 'ink';
    if (isModalVisible(modalPen)) return 'pen';
    if (isModalVisible(addSwatchModal)) return 'swatch';
    return '';
}

function captureModalDraftSnapshot(key) {
    if (key === 'ink') {
        modalDraftSnapshots.ink = getInkModalDraftState();
    } else if (key === 'pen') {
        modalDraftSnapshots.pen = getPenModalDraftState();
    } else if (key === 'swatch') {
        modalDraftSnapshots.swatch = getSwatchModalDraftState();
    }
}

function hasUnsavedFormChanges(key) {
    if (!key || !modalDraftSnapshots[key]) return false;
    if (key === 'ink') return modalDraftSnapshots.ink !== getInkModalDraftState();
    if (key === 'pen') return modalDraftSnapshots.pen !== getPenModalDraftState();
    if (key === 'swatch') return modalDraftSnapshots.swatch !== getSwatchModalDraftState();
    return false;
}

async function requestCloseAllModals() {
    const openFormKey = getVisibleFormModalKey();
    if (openFormKey && hasUnsavedFormChanges(openFormKey)) {
        const confirmed = await confirmAction({
            title: 'Discard Changes?',
            message: 'Close this panel and discard unsaved changes?',
            detail: 'Any unsaved edits in this panel will be lost.',
            buttons: ['Keep Editing', 'Discard Changes'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        });
        if (!confirmed) return false;
    }
    closeAllModals();
    return true;
}

function closeAllModals() {
    const addSwatchModal = document.getElementById('modal-add-swatch');
    const lifecycle = getModalLifecycle();
    if (!lifecycle) return;
    closeDetailImageLightbox();
    closeSwatchCalendar();
    lifecycle.closeAllModals([modalInk, modalPen, modalSwatchDetail, modalPenDetail, addSwatchModal]);
    currentSwatchDetailInkId = null;
    currentSwatchDetailSwatchId = null;
    currentPenDetailPenId = null;
    currentEditingId = null;
    currentEditingSwatchId = null;
    setSwatchFormMode('create');
    clearAllModalDraftSnapshots();
}

async function confirmAction(messageOrOptions, title = 'Confirm') {
    const options = (typeof messageOrOptions === 'object' && messageOrOptions !== null)
        ? messageOrOptions
        : {
            title,
            message: messageOrOptions,
            buttons: ['Cancel', 'Confirm'],
            defaultId: 1,
            cancelId: 0,
            confirmedIndex: 1
        };
    const isDestructive = !!options.destructive;
    if (isDestructive && !getPreferences().confirm_destructive_actions) {
        if (typeof options.bypassResult === 'boolean') return options.bypassResult;
        return true;
    }

    if (isManagerApp && desktopAPI && typeof desktopAPI.confirmDialog === 'function') {
        const result = await desktopAPI.confirmDialog({
            type: options.type || 'question',
            title: options.title || 'Confirm',
            message: options.message || 'Are you sure?',
            detail: options.detail || '',
            buttons: options.buttons || ['Cancel', 'Confirm'],
            defaultId: typeof options.defaultId === 'number' ? options.defaultId : 1,
            cancelId: typeof options.cancelId === 'number' ? options.cancelId : 0,
            confirmedIndex: typeof options.confirmedIndex === 'number' ? options.confirmedIndex : 1
        });
        return !!(result && result.confirmed);
    }
    return confirm(options.message || 'Are you sure?');
}

function resetOverlayState() {
    const lifecycle = getModalLifecycle();
    if (!lifecycle) return;
    lifecycle.resetOverlayState();
}

function activateModal(modalEl) {
    const lifecycle = getModalLifecycle();
    if (!lifecycle) return;
    lifecycle.activateModal(modalEl);
}

function reviveModalInputs(modalEl) {
    const lifecycle = getModalLifecycle();
    if (!lifecycle) return;
    lifecycle.reviveModalInputs(modalEl);
}

let settingsTooltipEl = null;
let activeSettingsTooltipTarget = null;
let settingsTooltipDelayTimer = null;
let pendingSettingsTooltipTarget = null;
let pendingSettingsTooltipPoint = { x: null, y: null };
let lastSettingsPointerPoint = { x: null, y: null };
let insightsTooltipEl = null;
let activeInsightsTooltipTarget = null;
let appNoticeEl = null;
let appNoticeTimer = null;
let suppressSettingsPersist = false;
let showcaseExportInFlight = false;
const SETTINGS_TOOLTIP_DELAY_MS = 500;

function ensureSettingsTooltipEl() {
    if (settingsTooltipEl) return settingsTooltipEl;
    const el = document.createElement('div');
    el.className = 'settings-tooltip-floating';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    settingsTooltipEl = el;
    return settingsTooltipEl;
}

function positionSettingsTooltip(clientX, clientY) {
    if (!settingsTooltipEl) return;
    const offsetX = 14;
    const offsetY = 18;
    const margin = 10;
    const rect = settingsTooltipEl.getBoundingClientRect();
    let x = Number(clientX) + offsetX;
    let y = Number(clientY) + offsetY;
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    x = Math.min(Math.max(margin, x), Math.max(margin, maxX));
    y = Math.min(Math.max(margin, y), Math.max(margin, maxY));
    settingsTooltipEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function showSettingsTooltip(target, clientX = null, clientY = null) {
    if (!target) return;
    const text = String(target.getAttribute('data-tooltip') || '').trim();
    if (!text) return;
    const el = ensureSettingsTooltipEl();
    activeSettingsTooltipTarget = target;
    el.textContent = text;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    if (typeof clientX === 'number' && typeof clientY === 'number') {
        positionSettingsTooltip(clientX, clientY);
    } else {
        const rect = target.getBoundingClientRect();
        positionSettingsTooltip(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
    }
}

function clearPendingSettingsTooltip() {
    if (settingsTooltipDelayTimer) {
        clearTimeout(settingsTooltipDelayTimer);
        settingsTooltipDelayTimer = null;
    }
    pendingSettingsTooltipTarget = null;
    pendingSettingsTooltipPoint.x = null;
    pendingSettingsTooltipPoint.y = null;
}

function scheduleSettingsTooltip(target, clientX = null, clientY = null) {
    if (!target) return;
    const text = String(target.getAttribute('data-tooltip') || '').trim();
    if (!text) return;
    if (activeSettingsTooltipTarget === target && settingsTooltipEl && settingsTooltipEl.classList.contains('is-visible')) return;

    pendingSettingsTooltipTarget = target;
    if (typeof clientX === 'number' && typeof clientY === 'number') {
        pendingSettingsTooltipPoint.x = clientX;
        pendingSettingsTooltipPoint.y = clientY;
    }

    if (settingsTooltipDelayTimer) return;
    settingsTooltipDelayTimer = setTimeout(() => {
        settingsTooltipDelayTimer = null;
        const nextTarget = pendingSettingsTooltipTarget;
        const x = pendingSettingsTooltipPoint.x;
        const y = pendingSettingsTooltipPoint.y;
        pendingSettingsTooltipTarget = null;
        pendingSettingsTooltipPoint.x = null;
        pendingSettingsTooltipPoint.y = null;
        if (!nextTarget) return;
        if (!viewSettings || !viewSettings.contains(nextTarget)) return;
        showSettingsTooltip(nextTarget, x, y);
    }, SETTINGS_TOOLTIP_DELAY_MS);
}

function hideSettingsTooltip() {
    clearPendingSettingsTooltip();
    activeSettingsTooltipTarget = null;
    if (!settingsTooltipEl) return;
    settingsTooltipEl.classList.remove('is-visible');
    settingsTooltipEl.setAttribute('aria-hidden', 'true');
    settingsTooltipEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
}

function ensureInsightsTooltipEl() {
    if (insightsTooltipEl) return insightsTooltipEl;
    const el = document.createElement('div');
    el.className = 'insight-tooltip-floating';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    insightsTooltipEl = el;
    return el;
}

function positionInsightsTooltip(clientX, clientY) {
    if (!insightsTooltipEl) return;
    const offsetX = 14;
    const offsetY = 18;
    const margin = 10;
    const rect = insightsTooltipEl.getBoundingClientRect();
    let x = Number(clientX) + offsetX;
    let y = Number(clientY) + offsetY;
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    x = Math.min(Math.max(margin, x), Math.max(margin, maxX));
    y = Math.min(Math.max(margin, y), Math.max(margin, maxY));
    insightsTooltipEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function showInsightsTooltip(target, clientX = null, clientY = null) {
    if (!target) return;
    const text = String(target.getAttribute('data-insight-tooltip') || '').trim();
    if (!text) return;
    const el = ensureInsightsTooltipEl();
    activeInsightsTooltipTarget = target;
    el.textContent = text;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        positionInsightsTooltip(clientX, clientY);
        return;
    }
    const rect = target.getBoundingClientRect();
    positionInsightsTooltip(rect.left + (rect.width / 2), rect.top + (rect.height / 2));
}

function hideInsightsTooltip() {
    activeInsightsTooltipTarget = null;
    if (!insightsTooltipEl) return;
    insightsTooltipEl.classList.remove('is-visible');
    insightsTooltipEl.setAttribute('aria-hidden', 'true');
    insightsTooltipEl.style.transform = 'translate3d(-9999px, -9999px, 0)';
}

function recoverSettingsInteractivity() {
    if (!viewSettings) return;
    viewSettings.style.pointerEvents = 'auto';
    const settingsShell = viewSettings.querySelector('.settings-shell');
    if (settingsShell) settingsShell.style.pointerEvents = 'auto';
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        if (!overlay) return;
        overlay.style.pointerEvents = 'none';
        if (overlay !== modalInk && overlay !== modalPen && overlay !== modalSwatchDetail && overlay !== modalPenDetail && overlay !== modalAddSwatch) {
            overlay.style.display = 'none';
        }
    });
}

function reviveSettingsTextInputs() {
    const textLikeInputs = [
        showcaseTitleInput,
        backupRetentionCountInput,
        defaultPenNibInput,
        defaultPenNibMaterialInput
    ].filter(Boolean);

    textLikeInputs.forEach((el) => {
        el.disabled = false;
        el.readOnly = false;
        el.style.pointerEvents = 'auto';
    });
}

function ensureAppNoticeEl() {
    if (appNoticeEl) return appNoticeEl;
    const el = document.createElement('div');
    el.className = 'app-notice-floating';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    appNoticeEl = el;
    return appNoticeEl;
}

function showAppNotice(message, type = 'info') {
    const text = String(message || '').trim().replace(/[.。]+$/u, '');
    if (!text) return;
    const el = ensureAppNoticeEl();
    if (appNoticeTimer) {
        clearTimeout(appNoticeTimer);
        appNoticeTimer = null;
    }
    el.textContent = text;
    el.classList.remove('is-success', 'is-error', 'is-warning');
    if (type === 'success') el.classList.add('is-success');
    if (type === 'error') el.classList.add('is-error');
    if (type === 'warning') el.classList.add('is-warning');
    el.classList.add('is-visible');
    appNoticeTimer = setTimeout(() => {
        el.classList.remove('is-visible');
    }, 2600);
}

async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;
    try {
        if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (_error) {
        // Fall through to legacy copy path.
    }

    try {
        const tmp = document.createElement('textarea');
        tmp.value = value;
        tmp.setAttribute('readonly', 'true');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        tmp.style.pointerEvents = 'none';
        document.body.appendChild(tmp);
        tmp.select();
        tmp.setSelectionRange(0, tmp.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(tmp);
        return !!ok;
    } catch (_error) {
        return false;
    }
}

function createCopyableColorChip(hex) {
    const normalizedHex = String(hex || '').trim();
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.style.width = '32px';
    chip.style.height = '32px';
    chip.style.borderRadius = '50%';
    chip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    chip.style.border = '2px solid #fff';
    chip.style.backgroundColor = normalizedHex || '#cccccc';
    chip.style.cursor = 'pointer';
    chip.style.padding = '0';
    chip.title = normalizedHex ? `Copy ${normalizedHex}` : 'Color';
    chip.setAttribute('aria-label', normalizedHex ? `Copy color ${normalizedHex}` : 'Color');
    chip.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!normalizedHex) return;
        const copied = await copyTextToClipboard(normalizedHex);
        showAppNotice(
            copied ? `Copied ${normalizedHex}` : `Failed to copy ${normalizedHex}`,
            copied ? 'success' : 'error'
        );
    });
    return chip;
}

function updateInkDetailMetadataLayout() {
    const metadataArea = document.getElementById('swatch-detail-metadata');
    if (!metadataArea || currentSwatchDetailSourceView !== 'inks') return;
    const paperSection = metadataArea.querySelector('[data-field="paper-compatibility"]');
    if (!paperSection) return;

    // On wider layouts keep Paper Compatibility beside Permanence; stack when narrow.
    const width = metadataArea.clientWidth || 0;
    paperSection.style.gridColumn = width >= 520 ? 'span 1' : 'span 2';
}

function openSwatchDetailModal(entityId, sourceView = 'swatches') {
    if (!modalSwatchDetail) return;
    activateModal(modalSwatchDetail);
    const isSwatchCardView = sourceView === 'swatches';
    const swatch = isSwatchCardView ? getSwatchById(entityId) : getLatestSwatchForInk(entityId);
    const ink = isSwatchCardView ? getInkById(swatch && swatch.ink_id) : getInkById(entityId);
    if (!ink) return;
    currentSwatchDetailInkId = entityId;
    currentSwatchDetailSwatchId = swatch ? swatch.id : null;
    currentSwatchDetailSourceView = sourceView;
    if (btnEditSwatchDetail) {
        btnEditSwatchDetail.textContent = sourceView === 'inks' ? 'Edit Ink' : 'Edit Swatch';
        btnEditSwatchDetail.style.display = (isManagerApp && (sourceView === 'inks' || !!swatch)) ? 'inline-block' : 'none';
    }

    const img = document.getElementById('swatch-detail-img');
    const layout = document.getElementById('swatch-detail-layout');
    const container = document.getElementById('swatch-detail-modal-container');
    const imageContainer = document.getElementById('swatch-detail-image-container');
    const contentArea = document.getElementById('swatch-detail-content');
    const name = document.getElementById('swatch-detail-name');
    const brand = document.getElementById('swatch-detail-brand');
    const standaloneBadge = document.getElementById('swatch-detail-standalone-badge');
    // 1. Hide modal immediately to prevent "ghost" content from previous ink
    modalSwatchDetail.style.display = 'none';
    if (contentArea) contentArea.scrollTop = 0;
    if (contentArea) contentArea.classList.remove('portrait-metadata-centered');

    // 2. Default Portrait Reset (Before layout decision)
    if (layout) layout.style.flexDirection = 'row';
    if (container) container.style.width = '900px';
    if (imageContainer) {
        imageContainer.style.display = 'block';
        imageContainer.style.flex = '1.2';
        imageContainer.style.height = 'auto';
        imageContainer.style.minHeight = '400px';
    }

    // 3. Populate basic data
    if (name) name.textContent = ink.name;
    if (brand) {
        const baseBrand = ink.brand || 'Custom';
        brand.textContent = isSwatchCardView
            ? baseBrand + (ink.line ? ` - ${ink.line}` : '')
            : baseBrand;
    }
    if (standaloneBadge) {
        standaloneBadge.style.display = (!swatch || swatch.ink_id) ? 'none' : 'inline-flex';
    }

    // Handle Colors
    const detailColorsContainer = document.getElementById('swatch-detail-colors');
    if (detailColorsContainer) {
        detailColorsContainer.innerHTML = '';
        const colorsToShow = ink.hex_colors || [ink.color_base || '#ccc', ink.color_accent || ink.color_base || '#999'];
        colorsToShow.forEach(hex => {
            const chip = createCopyableColorChip(hex);
            detailColorsContainer.appendChild(chip);
        });
    }

    const createSection = (label, value, extraStyle = '', fieldKey = '') => `
        <div ${fieldKey ? `data-field="${escapeHtml(fieldKey)}"` : ''} style="margin: 0; padding: 0; ${extraStyle}">
            <h4 style="text-transform: uppercase; font-size: 11px; font-family: var(--font-body); letter-spacing: 1.5px; color: #aaa; margin: 0 0 4px 0; padding: 0; font-weight: 700; line-height: 1.2;">${escapeHtml(label)}</h4>
            <p style="font-size: 15px; color: var(--color-text-main); line-height: 1.6; font-family: var(--font-body) !important; font-weight: 400; margin: 0; padding: 0; text-transform: none !important; letter-spacing: normal !important;">${escapeHtml(value || 'None')}</p>
        </div>
    `;

    const metadataArea = document.getElementById('swatch-detail-metadata');
    if (metadataArea) {
        const baseTypeVal = (Array.isArray(ink.base_type) ? ink.base_type : [ink.base_type || 'Dye']).join(', ');
        const paperVal = (ink.paper_compatibility || []).join(', ') || 'No specific data';
        const amount = parseAmountNumber(ink.amount, 1);
        const bottleAmountLabel = `${amount} bottle${amount === 1 ? '' : 's'}`;
        const unitPrice = parsePriceNumber(ink.price);
        const unitPriceLabel = Number.isFinite(unitPrice) && unitPrice > 0 ? formatMoney(unitPrice) : 'N/A';
        const totalPrice = Number.isFinite(unitPrice) && unitPrice > 0
            ? formatMoney(unitPrice * amount)
            : 'N/A';

        if (isSwatchCardView) {
            metadataArea.innerHTML = `
                ${createSection('Paper', (swatch && swatch.swatch_paper) || 'Not specified')}
                ${createSection('Nib Used', (swatch && swatch.swatch_nib) || 'Not specified')}
                ${createSection('Date Sampled', (swatch && swatch.swatch_date) || 'Not specified')}
                ${createSection('Lighting', (swatch && swatch.swatch_lighting) || 'Unknown')}
            `;
        } else {
            const hidePrices = shouldHidePricesInShowcase();
            const swatchCount = getSwatchesForInk(ink.id).length;
            metadataArea.innerHTML = `
                ${createSection('Ink Line', ink.line || 'Not specified')}
                ${createSection('Type', normalizeInkType(ink.type) || 'Bottle')}
                ${createSection('Volume (cl)', ink.cl || 'Not specified')}
                ${createSection('Amount', bottleAmountLabel)}
                ${hidePrices ? '' : createSection('Price (Per Bottle)', unitPriceLabel)}
                ${hidePrices ? '' : createSection('Total Price', totalPrice)}
                ${createSection('Shading', ink.shading)}
                ${createSection('Sheen', ink.sheen)}
                ${createSection('Shimmer', ink.shimmer)}
                ${createSection('Flow', ink.flow)}
                ${createSection('Lubrication', ink.lubrication)}
                ${createSection('Dry Time', ink.dry_time)}
                ${createSection('Base Type', baseTypeVal)}
                ${createSection('Permanence', ink.permanence)}
                ${createSection('Paper Compatibility', paperVal, '', 'paper-compatibility')}
                ${createSection('Swatches', `${swatchCount}`)}
            `;
        }
        requestAnimationFrame(updateInkDetailMetadataLayout);
    }

    const notesArea = document.getElementById('swatch-detail-notes-area');
    const detailNotes = isSwatchCardView
        ? ((swatch && swatch.swatch_notes) || '')
        : (ink.notes || '');
    if (notesArea) {
        if (detailNotes && detailNotes.trim()) {
            notesArea.style.display = 'block';
            notesArea.innerHTML = createSection('Notes', detailNotes);
        } else {
            notesArea.style.display = 'none';
        }
    }

    // 4. Handle Image and Layout Decision
    if (swatch && swatch.image && img) {
        const imagePath = resolveImageSource(swatch.image);
        configureDetailImageLightboxTrigger(
            img,
            imagePath,
            sourceView === 'inks' ? `${formatInkName(ink)} ink image` : `${formatInkName(ink)} swatch image`
        );

        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio > 1.25) {
                if (contentArea) contentArea.classList.remove('portrait-metadata-centered');
                if (layout) layout.style.flexDirection = 'column';
                if (container) container.style.width = '700px';
                if (imageContainer) {
                    imageContainer.style.flex = 'none';
                    imageContainer.style.height = '350px';
                    imageContainer.style.minHeight = 'auto';
                }
            } else {
                if (contentArea) contentArea.classList.add('portrait-metadata-centered');
            }
            modalSwatchDetail.style.display = 'flex';
            requestAnimationFrame(updateInkDetailMetadataLayout);
            img.onload = null;
            img.onerror = null;
        };

        img.onerror = () => {
            // If image fails, hide image area but still show modal
            if (contentArea) contentArea.classList.remove('portrait-metadata-centered');
            if (imageContainer) imageContainer.style.display = 'none';
            if (container) container.style.width = '550px';
            modalSwatchDetail.style.display = 'flex';
            requestAnimationFrame(updateInkDetailMetadataLayout);
            img.onload = null;
            img.onerror = null;
        };

        img.src = imagePath;
    } else {
        if (img) configureDetailImageLightboxTrigger(img, '', '');
        if (contentArea) contentArea.classList.remove('portrait-metadata-centered');
        if (img) img.src = '';
        if (imageContainer) imageContainer.style.display = 'none';
        if (container) container.style.width = '550px';
        modalSwatchDetail.style.display = 'flex';
        requestAnimationFrame(updateInkDetailMetadataLayout);
    }
}

function openPenDetailModal(penId, sourceView = 'pens') {
    if (!modalPenDetail) return;
    activateModal(modalPenDetail);
    const pen = appData.pens.find(p => p.id === penId);
    if (!pen) return;
    currentPenDetailPenId = penId;
    currentPenDetailSourceView = sourceView;

    const brand = document.getElementById('pen-detail-brand');
    const model = document.getElementById('pen-detail-model');
    const metadataArea = document.getElementById('pen-detail-metadata');
    const inkArea = document.getElementById('pen-detail-ink-area');
    const notesArea = document.getElementById('pen-detail-notes-area');
    const penImg = document.getElementById('pen-detail-img');
    const placeholderIcon = document.getElementById('pen-detail-placeholder-icon');
    const penDetailInkColor = document.getElementById('pen-detail-ink-color');
    const layout = document.getElementById('pen-detail-layout');
    const container = document.getElementById('pen-detail-modal-container');
    const visualContainer = document.getElementById('pen-detail-visual-container');
    if (btnEditPenDetail) {
        btnEditPenDetail.style.display = isManagerApp ? 'inline-block' : 'none';
    }

    // Reset scroll & layout
    const contentArea = document.getElementById('pen-detail-content');
    if (contentArea) contentArea.scrollTop = 0;
    if (layout) layout.style.flexDirection = 'row';
    if (container) container.style.width = '800px';
    if (visualContainer) {
        visualContainer.style.background = pen.hex_color || getPenDetailDefaultVisualBackground();
        visualContainer.style.flex = '1';
        visualContainer.style.height = 'auto';
        visualContainer.style.minHeight = '400px';
    }

    if (brand) brand.textContent = pen.brand;
    if (model) model.textContent = pen.model;

    // Handle Colors
    const detailColorsContainer = document.getElementById('pen-detail-colors');
    if (detailColorsContainer) {
        detailColorsContainer.innerHTML = '';
        const colorsToShow = pen.hex_colors || (pen.hex_color ? [pen.hex_color] : []);
        colorsToShow.forEach(hex => {
            const chip = createCopyableColorChip(hex);
            detailColorsContainer.appendChild(chip);
        });
    }

    const createSection = (label, value) => `
        <div style="margin: 0; padding: 0;">
            <h4 style="text-transform: uppercase; font-size: 11px; font-family: var(--font-body); letter-spacing: 1.5px; color: #aaa; margin: 0 0 4px 0; padding: 0; font-weight: 700; line-height: 1.2;">${escapeHtml(label)}</h4>
            <p style="font-size: 15px; color: var(--color-text-main); line-height: 1.6; font-family: var(--font-body) !important; font-weight: 400; margin: 0; padding: 0;">${escapeHtml(value || 'None')}</p>
        </div>
    `;

    const formatPrice = (p) => {
        if (!p || p === 'Not Specified') return 'Not Specified';
        let val = p.toString().trim();
        return val.startsWith('$') ? val : `$${val}`;
    };

    const ci = (appData.currently_inked || []).find(item => item.pen_id === pen.id);
    const linkedInk = ci ? appData.inks.find(i => i.id === ci.ink_id) : null;
    const isMobileDetail = !!(window.matchMedia && window.matchMedia('(max-width: 1024px)').matches);

    if (metadataArea) {
        const hidePrices = shouldHidePricesInShowcase();
        const mobileCurrentInkName = linkedInk
            ? `${linkedInk.brand ? `${linkedInk.brand} ` : ''}${linkedInk.name || ''}`.trim()
            : 'Nothing (Clean)';
        const mobileCurrentInkColor = linkedInk ? (linkedInk.color_base || '#ccc') : '#d0d0d0';
        metadataArea.innerHTML = `
            ${createSection('Nib Size', pen.nib)}
            ${createSection('Nib Material', pen.nib_material || 'Not Specified')}
            ${createSection('Body Material', pen.material || 'Standard')}
            ${createSection('Filling System', pen.filling_system || 'Not Specified')}
            ${createSection('Color', pen.color || 'Not Specified')}
            ${hidePrices ? '' : createSection('Price', formatPrice(pen.price))}
            ${isMobileDetail && linkedInk ? `
            <div style="margin: 0; padding: 0;">
                <h4 style="text-transform: uppercase; font-size: 11px; font-family: var(--font-body); letter-spacing: 1.5px; color: #aaa; margin: 0 0 4px 0; padding: 0; font-weight: 700; line-height: 1.2;">Currently Inked With</h4>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${mobileCurrentInkColor}; box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,0.1);"></div>
                    <p style="font-size: 15px; color: var(--color-text-main); line-height: 1.6; font-family: var(--font-body) !important; font-weight: 400; margin: 0; padding: 0;">${mobileCurrentInkName}</p>
                </div>
            </div>` : ''}
        `;
    }

    // Check Currently Inked
    if (isMobileDetail) {
        if (inkArea) inkArea.style.display = 'none';
        if (penDetailInkColor) {
            penDetailInkColor.onclick = null;
            penDetailInkColor.onkeydown = null;
            penDetailInkColor.style.cursor = '';
            penDetailInkColor.removeAttribute('title');
            penDetailInkColor.removeAttribute('tabindex');
            penDetailInkColor.removeAttribute('role');
            penDetailInkColor.removeAttribute('aria-label');
        }
    } else if (ci) {
        if (linkedInk && inkArea) {
            inkArea.style.display = 'block';
            document.getElementById('pen-detail-ink-name').textContent = linkedInk.name;
            document.getElementById('pen-detail-ink-color').style.backgroundColor = linkedInk.color_base || '#ccc';
            if (penDetailInkColor) {
                const inkHex = String(linkedInk.color_base || '').trim();
                penDetailInkColor.style.cursor = inkHex ? 'pointer' : '';
                penDetailInkColor.title = inkHex ? `Copy ${inkHex}` : '';
                penDetailInkColor.setAttribute('role', 'button');
                penDetailInkColor.setAttribute('tabindex', '0');
                penDetailInkColor.setAttribute('aria-label', inkHex ? `Copy color ${inkHex}` : 'Color');
                penDetailInkColor.onclick = async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!inkHex) return;
                    const copied = await copyTextToClipboard(inkHex);
                    showAppNotice(
                        copied ? `Copied ${inkHex}` : `Failed to copy ${inkHex}`,
                        copied ? 'success' : 'error'
                    );
                };
                penDetailInkColor.onkeydown = async (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    if (!inkHex) return;
                    const copied = await copyTextToClipboard(inkHex);
                    showAppNotice(
                        copied ? `Copied ${inkHex}` : `Failed to copy ${inkHex}`,
                        copied ? 'success' : 'error'
                    );
                };
            }
        } else if (inkArea) {
            inkArea.style.display = 'none';
            if (penDetailInkColor) {
                penDetailInkColor.onclick = null;
                penDetailInkColor.onkeydown = null;
                penDetailInkColor.style.cursor = '';
                penDetailInkColor.removeAttribute('title');
                penDetailInkColor.removeAttribute('tabindex');
                penDetailInkColor.removeAttribute('role');
                penDetailInkColor.removeAttribute('aria-label');
            }
        }
    } else {
        if (inkArea) inkArea.style.display = 'none';
        if (penDetailInkColor) {
            penDetailInkColor.onclick = null;
            penDetailInkColor.onkeydown = null;
            penDetailInkColor.style.cursor = '';
            penDetailInkColor.removeAttribute('title');
            penDetailInkColor.removeAttribute('tabindex');
            penDetailInkColor.removeAttribute('role');
            penDetailInkColor.removeAttribute('aria-label');
        }
    }

    if (notesArea) {
        if (pen.notes && pen.notes.trim()) {
            notesArea.style.display = 'block';
            document.getElementById('pen-detail-notes').textContent = pen.notes;
        } else {
            notesArea.style.display = 'none';
        }
    }

    // Handle Image and Layout (Normalized to Vertical)
    if (pen.image && pen.image !== "default_pen.png" && penImg) {
        const imagePath = resolveImageSource(pen.image);
        configureDetailImageLightboxTrigger(penImg, imagePath, `${formatPenName(pen)} image`);

        penImg.onload = () => {
            // Force Portrait (Side-by-side) for pens, as they are normalized vertical
            if (layout) layout.style.flexDirection = 'row';
            if (container) container.style.width = '850px';

            if (visualContainer) {
                const rotation = pen.image_rotation || 0;
                const isRotated = rotation === 90 || rotation === 270;

                visualContainer.style.background = pen.hex_color || getPenDetailDefaultVisualBackground();
                visualContainer.style.flex = '1';
                visualContainer.style.height = 'auto';
                visualContainer.style.minHeight = '500px';
                visualContainer.style.maxHeight = '80vh';
                visualContainer.style.containerType = 'size';

                if (isRotated) {
                    penImg.className = 'pen-photo-rotated';
                    penImg.style.setProperty('--rot', `${rotation}deg`);

                    // Clear ALL JS overrides to let CSS .pen-photo-rotated take over
                    penImg.style.width = '';
                    penImg.style.height = '';
                    penImg.style.objectFit = '';
                    penImg.style.position = '';
                    penImg.style.transform = '';
                    penImg.style.top = '';
                    penImg.style.left = '';
                } else {
                    penImg.className = '';
                    penImg.style.width = '100%';
                    penImg.style.height = '100%';
                    penImg.style.position = 'static';
                    penImg.style.transform = `rotate(${rotation}deg)`;
                    penImg.style.objectFit = 'cover';
                    penImg.style.top = 'auto';
                    penImg.style.left = 'auto';
                }
            }

            penImg.style.display = 'block';
            if (placeholderIcon) placeholderIcon.style.display = 'none';
            modalPenDetail.style.display = 'flex';
            penImg.onload = null;
        };
        penImg.src = imagePath;
    } else {
        if (penImg) configureDetailImageLightboxTrigger(penImg, '', '');
        if (penImg) {
            penImg.style.display = 'none';
            penImg.style.transform = 'rotate(0deg)';
        }
        if (placeholderIcon) placeholderIcon.style.display = 'block';
        if (layout) layout.style.flexDirection = 'row';
        if (container) container.style.width = '800px';
        modalPenDetail.style.display = 'flex';
    }
}

async function saveNewInk() {
    const name = inkNameInput.value;
    const brand = inkBrandInput ? inkBrandInput.value : "Custom";
    const wasEdit = !!currentEditingId;
    const existingInk = wasEdit ? findInkById(currentEditingId) : null;
    const existingInkSnapshot = wasEdit
        ? cloneEntityForDiff(existingInk, ['hex_colors', 'base_type', 'paper_compatibility'])
        : null;

    const validationMsg = document.getElementById('ink-validation-msg');
    validationMsg.style.display = 'none';

    if (!name) {
        validationMsg.textContent = 'Please enter an ink name';
        validationMsg.style.display = 'inline-block';
        return;
    }

    const previousImagePath = existingInk && existingInk.image ? existingInk.image : null;
    let imageFilename = null;
    if (currentSelectedImagePath && !currentSelectedImagePath.startsWith('images/')) {
        imageFilename = await saveManagedImage(currentSelectedImagePath, 'ink', { brand, model: name });
    }

    const allColors = getInkColors();
    const colorBase = allColors[0] || "#4a0e28";
    const colorAccent = allColors[1] || colorBase;

    if (currentEditingId) {
        // Edit Mode
        const index = appData.inks.findIndex(i => i.id === currentEditingId);
        if (index !== -1) {
            appData.inks[index].name = name;
            appData.inks[index].brand = brand;
            appData.inks[index].color_base = colorBase;
            appData.inks[index].color_accent = colorAccent;
            appData.inks[index].hex_colors = allColors;

            if (imageFilename) {
                appData.inks[index].image = imageFilename;
            }


            // Technical Fields
            appData.inks[index].line = document.getElementById('ink-line-input')?.value;
            appData.inks[index].type = normalizeInkType(document.getElementById('ink-type-input')?.value) || 'Bottle';
            appData.inks[index].cl = document.getElementById('ink-cl-input')?.value;
            appData.inks[index].amount = document.getElementById('ink-amount-input')?.value;
            appData.inks[index].price = document.getElementById('ink-price-input')?.value || '';

            appData.inks[index].shading = document.getElementById('ink-shading')?.value;
            appData.inks[index].sheen = document.getElementById('ink-sheen')?.value;
            appData.inks[index].shimmer = document.getElementById('ink-shimmer')?.value;
            appData.inks[index].flow = document.getElementById('ink-flow')?.value;
            appData.inks[index].lubrication = document.getElementById('ink-lubrication')?.value;
            appData.inks[index].dry_time = document.getElementById('ink-dry-time')?.value;
            appData.inks[index].permanence = document.getElementById('ink-permanence')?.value;

            // Multiselect for Base Type
            const baseTypeCheckboxes = document.querySelectorAll('#base-type-popover input[type="checkbox"]');
            appData.inks[index].base_type = Array.from(baseTypeCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

            // Multiselect for Paper Compatibility
            const paperCheckboxes = document.querySelectorAll('#paper-compatibility-popover input[type="checkbox"]');
            appData.inks[index].paper_compatibility = Array.from(paperCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

            appData.inks[index].notes = document.getElementById('ink-notes')?.value;
        }
    } else {
        const paperCheckboxes = document.querySelectorAll('#paper-compatibility-popover input[type="checkbox"]');
        const newInk = {
            id: makeClientId('ink'),
            name: name,
            brand: brand,
            line: document.getElementById('ink-line-input')?.value || '',
            type: normalizeInkType(document.getElementById('ink-type-input')?.value) || 'Bottle',
            cl: document.getElementById('ink-cl-input')?.value || '',
            amount: document.getElementById('ink-amount-input')?.value || '1',
            price: document.getElementById('ink-price-input')?.value || '',
            color_base: colorBase,
            color_accent: colorAccent,
            hex_colors: allColors,
            shading: document.getElementById('ink-shading')?.value || 'None',
            sheen: document.getElementById('ink-sheen')?.value || 'None',
            shimmer: document.getElementById('ink-shimmer')?.value || 'None',
            flow: document.getElementById('ink-flow')?.value || 'Average',
            lubrication: document.getElementById('ink-lubrication')?.value || 'None',
            dry_time: document.getElementById('ink-dry-time')?.value || '',
            base_type: Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]')).filter(cb => cb.checked).map(cb => cb.value),
            permanence: document.getElementById('ink-permanence')?.value || 'None',
            paper_compatibility: Array.from(paperCheckboxes).filter(cb => cb.checked).map(cb => cb.value),
            notes: document.getElementById('ink-notes')?.value || '',
            image: imageFilename
        };
        appData.inks.push(newInk);
        logActivity('created', 'ink', `Added ink: ${formatInkName(newInk)}.`, {
            entityId: newInk.id,
            metadata: buildInkActivityMetadata(newInk)
        });
    }

    if (wasEdit && existingInk) {
        const updatedInk = findInkById(existingInk.id);
        const changedLabels = getChangedFieldLabels(existingInkSnapshot, updatedInk, [
            { key: 'name', label: 'Name' },
            { key: 'brand', label: 'Brand' },
            { key: 'line', label: 'Ink Line' },
            { key: 'type', label: 'Type' },
            { key: 'cl', label: 'Volume (cl)' },
            { key: 'amount', label: 'Amount' },
            { key: 'price', label: 'Price' },
            { key: 'hex_colors', label: 'Colors', mode: 'array' },
            { key: 'shading', label: 'Shading' },
            { key: 'sheen', label: 'Sheen' },
            { key: 'shimmer', label: 'Shimmer' },
            { key: 'flow', label: 'Flow' },
            { key: 'lubrication', label: 'Lubrication' },
            { key: 'dry_time', label: 'Dry Time' },
            { key: 'base_type', label: 'Base Type', mode: 'array' },
            { key: 'permanence', label: 'Permanence' },
            { key: 'paper_compatibility', label: 'Paper Compatibility', mode: 'array' },
            { key: 'notes', label: 'Notes' },
            { key: 'image', label: 'Image' }
        ]);
        const details = formatChangedFieldsCompact(changedLabels);
        const message = details
            ? `Updated ink: ${formatInkName(updatedInk)} (${details}).`
            : `Updated ink: ${formatInkName(updatedInk)}.`;
        logActivity('updated', 'ink', message, {
            entityId: existingInk.id,
            metadata: buildInkActivityMetadata(updatedInk)
        });
    }

    const nextImagePath = currentEditingId
        ? ((appData.inks.find(i => i.id === currentEditingId) || {}).image || '')
        : imageFilename;
    const shouldDeletePreviousImage = wasEdit
        && previousImagePath
        && nextImagePath
        && previousImagePath !== nextImagePath
        && isManagedImagePathForDeletion(previousImagePath);

    await persistDataAndRefresh({
        refresh: {
            dashboard: true,
            inks: true,
            swatches: true,
            activity: true,
            autocomplete: true
        },
        onSuccess: async () => {
            if (shouldDeletePreviousImage) {
                await disposeReplacedManagedImage(previousImagePath);
            }
            currentSelectedImagePath = null;
            closeAllModals();
        },
        onErrorMessage: 'Failed to save data!'
    });
}

async function saveNewPen() {
    const brand = penBrandInput.value;
    const model = penModelInput.value;
    const normalizedPenMaterial = normalizeCsvValues(penMaterialInput.value).join(', ');
    const normalizedFillingSystem = normalizeCsvValues(penFillingSystemInput.value).join(', ');
    const normalizedPenColor = normalizeCsvValues(penColorInput.value).join(', ');
    const wasEdit = !!currentEditingId;
    const existingPen = wasEdit ? findPenById(currentEditingId) : null;
    const existingPenSnapshot = wasEdit
        ? cloneEntityForDiff(existingPen, ['hex_colors'])
        : null;
    const previousImagePath = wasEdit && existingPen ? (existingPen.image || null) : null;
    const previousLink = wasEdit ? (appData.currently_inked || []).find(ci => ci.pen_id === currentEditingId) : null;
    const previousInkId = previousLink ? previousLink.ink_id : '';

    const validationMsg = document.getElementById('pen-validation-msg');
    validationMsg.style.display = 'none';

  if (!brand || !model) {
      validationMsg.textContent = 'Brand and Model are required.';
      validationMsg.style.display = 'inline-block';
      return;
  }

  const allColors = getPenColors();
  const hexColor = allColors[0] || '';

  let imageFilename = "default_pen.png";

    // 1. Determine existing image if editing
    if (currentEditingId) {
        if (existingPen && existingPen.image) {
            imageFilename = existingPen.image;
        }
    }

    // 2. Override if removed or new image
    if (penImageRemoved) {
        imageFilename = "default_pen.png";
    }

    if (currentPenImagePath) {
        if (currentPenImagePath.startsWith('data:')) {

            imageFilename = currentPenImagePath;
        } else if (isManagerSelectedUploadPath(currentPenImagePath) || ((currentPenImagePath.includes('/') || currentPenImagePath.includes('\\')) && !currentPenImagePath.startsWith('images/'))) {
              // It's a full path, save it
              const savedName = await saveManagedImage(currentPenImagePath, 'pen', {
                  brand,
                  model,
                  nib: document.getElementById('pen-nib-input')?.value,
                  color: normalizedPenColor,
                  hex_color: allColors[0] || '',
                  hex_colors: allColors
              });
              if (savedName) {
                  imageFilename = savedName;
              }
        } else {
            // Already a filename or internal path
            imageFilename = currentPenImagePath;
        }
    }

    // Safety: If it's an internal path, don't re-save
    if (imageFilename && imageFilename.startsWith('images/')) {
        imageFilename = imageFilename.replace('images/', '');
    }

  let targetPenId = currentEditingId;

    if (currentEditingId) {
        // Edit Mode
        const index = appData.pens.findIndex(p => p.id === currentEditingId);
        if (index !== -1) {
            appData.pens[index].brand = brand;
            appData.pens[index].model = model;
            appData.pens[index].nib = penNibInput.value;
            appData.pens[index].nib_material = penNibMaterialInput.value;
            appData.pens[index].material = normalizedPenMaterial;
            appData.pens[index].filling_system = normalizedFillingSystem;
            appData.pens[index].color = normalizedPenColor;
            appData.pens[index].hex_color = hexColor;
            appData.pens[index].hex_colors = allColors;
            appData.pens[index].image_rotation = currentPenRotation;
            appData.pens[index].price = penPriceInput.value;
            appData.pens[index].notes = penNotesInput.value;
            appData.pens[index].image = imageFilename;
        }
    } else {
        // Create Mode
        targetPenId = makeClientId('pen');
        const newPen = {
            id: targetPenId,
            brand: brand,
            model: model,
            nib: penNibInput.value || 'M',
            nib_material: penNibMaterialInput.value || 'Steel',
            material: normalizedPenMaterial || 'Standard',
            filling_system: normalizedFillingSystem || '',
            color: normalizedPenColor || '',
            hex_color: hexColor,
            hex_colors: allColors,
            image_rotation: currentPenRotation,
            price: penPriceInput.value || '',
            notes: penNotesInput.value || '',
            image: imageFilename
        };
        appData.pens.push(newPen);
    }

    // Handle Currently Inked State
    if (penInkSelect) {
        const selectedInkId = penInkSelect.value;
        // Check if existing
        const currentLinkIndex = appData.currently_inked.findIndex(ci => ci.pen_id === targetPenId);

        if (selectedInkId) {
            // Ink Selected
            if (currentLinkIndex !== -1) {
                // Update
                appData.currently_inked[currentLinkIndex].ink_id = selectedInkId;
            } else {
                // Add New
                appData.currently_inked.push({
                    id: makeClientId('ci'),
                    pen_id: targetPenId,
                    ink_id: selectedInkId,
                    date_inked: Date.now()
                });
            }
        } else {
            // Un-ink (Clean)
            if (currentLinkIndex !== -1) {
                appData.currently_inked.splice(currentLinkIndex, 1);
            }
        }
    }

    const targetPen = findPenById(targetPenId);
    const penActivityMetadata = targetPen ? buildPenActivityMetadata(targetPen) : {};
    if (!wasEdit && targetPen) {
        logActivity('created', 'pen', `Added pen: ${formatPenName(targetPen)}.`, {
            entityId: targetPenId,
            metadata: penActivityMetadata
        });
    } else if (wasEdit && targetPen) {
        const changedLabels = getChangedFieldLabels(existingPenSnapshot, targetPen, [
            { key: 'brand', label: 'Brand' },
            { key: 'model', label: 'Model' },
            { key: 'nib', label: 'Nib Size' },
            { key: 'nib_material', label: 'Nib Material' },
            { key: 'material', label: 'Body Material' },
            { key: 'filling_system', label: 'Filling System' },
            { key: 'color', label: 'Color' },
            { key: 'hex_colors', label: 'Pen Colors', mode: 'array' },
            { key: 'price', label: 'Price' },
            { key: 'notes', label: 'Notes' },
            { key: 'image', label: 'Image' },
            { key: 'image_rotation', label: 'Image Rotation' }
        ]);
        const details = formatChangedFieldsCompact(changedLabels);
        const message = details
            ? `Updated pen: ${formatPenName(targetPen)} (${details}).`
            : `Updated pen: ${formatPenName(targetPen)}.`;
        logActivity('updated', 'pen', message, {
            entityId: targetPenId,
            metadata: penActivityMetadata
        });
    }

    const currentLink = (appData.currently_inked || []).find(ci => ci.pen_id === targetPenId);
    const currentInkId = currentLink ? currentLink.ink_id : '';
    if (previousInkId !== currentInkId && targetPen) {
        const previousInk = findInkById(previousInkId);
        const currentInk = findInkById(currentInkId);
        if (!previousInkId && currentInkId && currentInk) {
            logActivity('inked', 'pen', `Inked ${formatPenName(targetPen)} with ${formatInkName(currentInk)}.`, {
                entityId: targetPenId,
                metadata: buildPenActivityMetadata(targetPen, {
                    new_ink_id: currentInkId,
                    new_ink_name: formatInkName(currentInk)
                })
            });
        } else if (previousInkId && !currentInkId) {
            logActivity('cleaned', 'pen', `Emptied ${formatPenName(targetPen)} (${formatInkName(previousInk)} removed).`, {
                entityId: targetPenId,
                metadata: buildPenActivityMetadata(targetPen, {
                    previous_ink_id: previousInkId,
                    previous_ink_name: formatInkName(previousInk)
                })
            });
        } else if (previousInkId && currentInkId && currentInk) {
            logActivity('reinked', 'pen', `Changed ink in ${formatPenName(targetPen)} to ${formatInkName(currentInk)}.`, {
                entityId: targetPenId,
                metadata: buildPenActivityMetadata(targetPen, {
                    previous_ink_id: previousInkId,
                    previous_ink_name: formatInkName(previousInk),
                    new_ink_id: currentInkId,
                    new_ink_name: formatInkName(currentInk)
                })
            });
        }
    }

    const shouldDeletePreviousImage = wasEdit
        && previousImagePath
        && previousImagePath !== imageFilename
        && isManagedImagePathForDeletion(previousImagePath);

    await persistDataAndRefresh({
        refresh: {
            pens: true,
            dashboard: true,
            activity: true,
            autocomplete: true
        },
        onSuccess: async () => {
            if (shouldDeletePreviousImage) {
                await disposeReplacedManagedImage(previousImagePath);
            }
            currentPenImagePath = null;
            closeAllModals();
        },
        onErrorMessage: 'Failed to save pen!'
    });
}

async function deleteInk() {
    if (!currentEditingId) return;
    if (!(await confirmAction({
        title: 'Delete Ink',
        message: 'Delete this ink and all its inking history?',
        destructive: true,
        buttons: ['Keep Ink', 'Delete Ink'],
        defaultId: 0,
        cancelId: 0,
        confirmedIndex: 1
    }))) return;

    const inkToDelete = appData.inks.find(i => i.id === currentEditingId);
    if (!inkToDelete) return;
    const inkImagePath = inkToDelete.image || null;
    const linkedSwatches = getSwatchesForInk(currentEditingId);
    const linkedSwatchImages = linkedSwatches.map((s) => s.image).filter(Boolean);
    appData.currently_inked = appData.currently_inked.filter(ci => ci.ink_id !== currentEditingId);
    appData.swatches = getAllSwatches().filter((swatch) => swatch.ink_id !== currentEditingId);
    appData.inks = appData.inks.filter(i => i.id !== currentEditingId);
    logActivity('deleted', 'ink', `Deleted ink: ${formatInkName(inkToDelete)}.`, {
        entityId: currentEditingId,
        metadata: buildInkActivityMetadata(inkToDelete)
    });
    if (linkedSwatches.length > 0) {
        logActivity('deleted', 'swatch', `Deleted ${linkedSwatches.length} swatch${linkedSwatches.length === 1 ? '' : 'es'} linked to ${formatInkName(inkToDelete)}.`, {
            entityId: currentEditingId,
            metadata: buildSwatchActivityMetadata(null, inkToDelete, {
                swatch_count: linkedSwatches.length
            })
        });
    }

    await persistDataAndRefresh({
        refresh: {
            dashboard: true,
            inks: true,
            swatches: true,
            activity: true,
            autocomplete: true
        },
        onSuccess: async () => {
            currentSelectedImagePath = null;
            if (inkImagePath) {
                await desktopAPI.deleteImage(inkImagePath);
            }
            for (const imagePath of linkedSwatchImages) {
                await desktopAPI.deleteImage(imagePath);
            }
            closeAllModals();
            currentEditingId = null;
        },
        onErrorMessage: 'Failed to delete ink!'
    });
}

async function deletePen() {
    if (!currentEditingId) return;
    if (!(await confirmAction({
        title: 'Delete Pen',
        message: 'Delete this pen?',
        destructive: true,
        buttons: ['Keep Pen', 'Delete Pen'],
        defaultId: 0,
        cancelId: 0,
        confirmedIndex: 1
    }))) return;

    // Get image path before deleting
    const penToDelete = appData.pens.find(p => p.id === currentEditingId);
    const penImagePath = penToDelete ? penToDelete.image : null;
    const penActivityMetadata = penToDelete ? buildPenActivityMetadata(penToDelete) : {};

    // Remove from pens
    appData.pens = appData.pens.filter(p => p.id !== currentEditingId);
    // Remove from currently inked
    appData.currently_inked = appData.currently_inked.filter(ci => ci.pen_id !== currentEditingId);
    if (penToDelete) {
        logActivity('deleted', 'pen', `Deleted pen: ${formatPenName(penToDelete)}.`, {
            entityId: currentEditingId,
            metadata: penActivityMetadata
        });
    }

    await persistDataAndRefresh({
        refresh: {
            pens: true,
            dashboard: true,
            activity: true
        },
        onSuccess: async () => {
            currentPenImagePath = null;
            if (penImagePath) {
                await desktopAPI.deleteImage(penImagePath);
            }
            closeAllModals();
            currentEditingId = null;
        },
        onErrorMessage: 'Failed to delete pen!'
    });
}

async function deleteCurrentSwatch() {
    if (!currentSwatchDetailInkId) return;
    const swatchId = currentSwatchDetailSwatchId
        || (currentSwatchDetailSourceView === 'inks'
            ? ((getLatestSwatchForInk(currentSwatchDetailInkId) || {}).id || '')
            : currentSwatchDetailInkId);
    const swatch = getSwatchById(swatchId);
    if (!swatch || !swatch.image) return;
    const swatchInk = getInkById(swatch.ink_id);
    if (!swatchInk) return;

    if (!(await confirmAction({
        title: 'Delete Swatch',
        message: 'Delete this swatch image?',
        destructive: true,
        buttons: ['Keep Swatch', 'Delete Swatch'],
        defaultId: 0,
        cancelId: 0,
        confirmedIndex: 1
    }))) return;

    const swatchImagePath = swatch.image;
    appData.swatches = getAllSwatches().filter((item) => item.id !== swatchId);
    logActivity('deleted', 'swatch', `Deleted swatch for ${formatInkName(swatchInk)}.`, {
        entityId: swatchId,
        metadata: buildSwatchActivityMetadata(swatch, swatchInk)
    });

    await persistDataAndRefresh({
        refresh: {
            dashboard: true,
            inks: true,
            swatches: true,
            activity: true,
            autocomplete: true
        },
        onSuccess: async () => {
            if (swatchImagePath) {
                await desktopAPI.deleteImage(swatchImagePath);
            }
            if (modalSwatchDetail) {
                modalSwatchDetail.style.display = 'none';
            }
            currentSwatchDetailInkId = null;
            currentSwatchDetailSwatchId = null;
        },
        onErrorMessage: 'Failed to delete swatch!'
    });
}

const btnAddMenu = null; // Removed
const dropdownMenu = null; // Removed
const menuAddPen = null;   // Removed
const menuAddInk = null;   // Removed
const menuAddSwatch = null;// Removed

// Event Listeners Consolidated
window.addEventListener('click', async (e) => {
    // 1. Dropdown outside click
    if (dropdownMenu && btnAddMenu && !btnAddMenu.contains(e.target) && dropdownMenu.classList.contains('show')) {
        dropdownMenu.classList.remove('show');
    }

    // 2. Modal outside click (close on overlay click)
    if (e.target === modalInk || e.target === modalPen || e.target === modalSwatchDetail || e.target === modalPenDetail ||
        e.target === document.getElementById('modal-add-swatch')) {
        await requestCloseAllModals();
    }
});

document.addEventListener('keydown', async (e) => {
    const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    const typingInField = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT';
    const detailOpen = isModalVisible(modalSwatchDetail) || isModalVisible(modalPenDetail);
    const formModalOpen = !!getVisibleFormModalKey();

    if (e.key === 'Escape') {
        if (isDetailImageLightboxOpen()) {
            e.preventDefault();
            closeDetailImageLightbox();
            return;
        }
        if (detailOpen) {
            e.preventDefault();
            closeDetailModals();
            return;
        }
        if (formModalOpen) {
            e.preventDefault();
            await requestCloseAllModals();
        }
        return;
    }

    if (isDetailImageLightboxOpen()) return;
    if (!detailOpen) return;
    if (typingInField) return;
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateDetailModal(-1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateDetailModal(1);
    }
});

function closeDetailModals() {
    closeDetailImageLightbox();
    const lifecycle = getModalLifecycle();
    if (lifecycle) {
        lifecycle.closeAllModals([modalSwatchDetail, modalPenDetail]);
    } else {
        if (isModalVisible(modalSwatchDetail)) modalSwatchDetail.style.display = 'none';
        if (isModalVisible(modalPenDetail)) modalPenDetail.style.display = 'none';
    }
    currentSwatchDetailInkId = null;
    currentSwatchDetailSwatchId = null;
    currentPenDetailPenId = null;
}

function setupDetailModalGestures() {
    const bindSwipe = (overlay) => {
        if (!overlay || overlay.dataset.swipeBound === '1') return;
        overlay.dataset.swipeBound = '1';

        const target = overlay.querySelector('.modal') || overlay;
        let startX = 0;
        let startY = 0;
        let startTs = 0;
        let tracking = false;

        target.addEventListener('touchstart', (e) => {
            if (isDetailImageLightboxOpen() || !isModalVisible(overlay) || !e.touches || e.touches.length !== 1) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startTs = Date.now();
            tracking = true;
        }, { passive: true });

        target.addEventListener('touchend', (e) => {
            if (!tracking || isDetailImageLightboxOpen() || !isModalVisible(overlay) || !e.changedTouches || e.changedTouches.length === 0) return;
            tracking = false;

            const t = e.changedTouches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            const elapsed = Date.now() - startTs;

            // Swipe left/right to navigate detail items.
            if (absX > 70 && absX > absY * 1.2 && elapsed < 800) {
                navigateDetailModal(dx < 0 ? 1 : -1);
                return;
            }

            // Swipe down to close.
            if (dy > 110 && dy > absX * 1.35 && elapsed < 900) {
                closeDetailModals();
            }
        }, { passive: true });
    };

    bindSwipe(modalSwatchDetail);
    bindSwipe(modalPenDetail);
}

setupDetailModalGestures();

function setupDetailImageLightbox() {
    const bindTrigger = (element) => {
        if (!element || element.dataset.lightboxBound === '1') return;
        element.addEventListener('click', handleDetailImageLightboxTrigger);
        element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            handleDetailImageLightboxTrigger(event);
        });
        element.dataset.lightboxBound = '1';
    };

    bindTrigger(document.getElementById('swatch-detail-img'));
    bindTrigger(document.getElementById('pen-detail-img'));

    if (!detailImageLightbox || !detailImageLightboxStage) return;
    if (detailImageLightbox.dataset.bound === '1') return;
    detailImageLightbox.dataset.bound = '1';

    detailImageLightbox.addEventListener('click', () => {
        if (!isDetailImageLightboxOpen()) return;
        if (detailImageLightboxState.suppressClick) {
            detailImageLightboxState.suppressClick = false;
            return;
        }
        closeDetailImageLightbox();
    });

    detailImageLightboxStage.addEventListener('touchstart', (event) => {
        if (!isDetailImageLightboxOpen()) return;
        if (event.touches.length >= 2) {
            const a = event.touches[0];
            const b = event.touches[1];
            const beforeSize = getDetailImageLightboxScaledSize();
            detailImageLightboxState.pinchActive = true;
            detailImageLightboxState.pinchStartDistance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
            detailImageLightboxState.pinchStartScale = detailImageLightboxState.scale;
            const centerX = (a.clientX + b.clientX) / 2;
            const centerY = (a.clientY + b.clientY) / 2;
            detailImageLightboxState.pinchOriginRatioX = beforeSize.wrapWidth
                ? (detailImageLightboxStage.scrollLeft + centerX) / beforeSize.wrapWidth
                : 0.5;
            detailImageLightboxState.pinchOriginRatioY = beforeSize.wrapHeight
                ? (detailImageLightboxStage.scrollTop + centerY) / beforeSize.wrapHeight
                : 0.5;
            detailImageLightboxState.touchMoved = true;
            detailImageLightboxState.suppressClick = true;
            return;
        }

        const touch = event.touches[0];
        if (!touch) return;
        detailImageLightboxState.touchStartX = touch.clientX;
        detailImageLightboxState.touchStartY = touch.clientY;
        detailImageLightboxState.touchStartTs = Date.now();
        detailImageLightboxState.startScrollLeft = detailImageLightboxStage.scrollLeft;
        detailImageLightboxState.startScrollTop = detailImageLightboxStage.scrollTop;
        detailImageLightboxState.touchMoved = false;
    }, { passive: true });

    detailImageLightboxStage.addEventListener('touchmove', (event) => {
        if (!isDetailImageLightboxOpen()) return;
        if (event.touches.length >= 2 && detailImageLightboxState.pinchActive) {
            const a = event.touches[0];
            const b = event.touches[1];
            const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
            if (!distance || !detailImageLightboxState.pinchStartDistance) return;

            event.preventDefault();
            const centerX = (a.clientX + b.clientX) / 2;
            const centerY = (a.clientY + b.clientY) / 2;
            const nextScale = Math.min(4, Math.max(1, detailImageLightboxState.pinchStartScale * (distance / detailImageLightboxState.pinchStartDistance)));
            detailImageLightboxState.scale = nextScale;
            applyDetailImageLightboxZoom();

            const afterSize = getDetailImageLightboxScaledSize();
            detailImageLightboxStage.scrollLeft = Math.max(
                0,
                Math.min(afterSize.wrapWidth - detailImageLightboxStage.clientWidth, (detailImageLightboxState.pinchOriginRatioX * afterSize.wrapWidth) - centerX)
            );
            detailImageLightboxStage.scrollTop = Math.max(
                0,
                Math.min(afterSize.wrapHeight - detailImageLightboxStage.clientHeight, (detailImageLightboxState.pinchOriginRatioY * afterSize.wrapHeight) - centerY)
            );
            detailImageLightboxState.touchMoved = true;
            detailImageLightboxState.suppressClick = true;
            return;
        }

        const touch = event.touches[0];
        if (!touch) return;
        if (Math.abs(touch.clientX - detailImageLightboxState.touchStartX) > 8 || Math.abs(touch.clientY - detailImageLightboxState.touchStartY) > 8) {
            detailImageLightboxState.touchMoved = true;
            detailImageLightboxState.suppressClick = true;
        }
    }, { passive: false });

    detailImageLightboxStage.addEventListener('touchend', (event) => {
        if (!isDetailImageLightboxOpen()) return;
        if (event.touches.length >= 2) return;
        if (detailImageLightboxState.pinchActive) {
            if (event.touches.length < 2) {
                detailImageLightboxState.pinchActive = false;
                detailImageLightboxState.suppressClick = true;
                if (detailImageLightboxState.scale <= 1.01) {
                    fitDetailImageLightboxToViewport();
                }
            }
            return;
        }

        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - detailImageLightboxState.touchStartX;
        const dy = touch.clientY - detailImageLightboxState.touchStartY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const elapsed = Date.now() - detailImageLightboxState.touchStartTs;
        const scrollMoved = Math.abs(detailImageLightboxStage.scrollLeft - detailImageLightboxState.startScrollLeft) > 4
            || Math.abs(detailImageLightboxStage.scrollTop - detailImageLightboxState.startScrollTop) > 4;

        if (!detailImageLightboxState.touchMoved && !scrollMoved) {
            closeDetailImageLightbox();
            return;
        }

        if (detailImageLightboxState.scale <= 1.01 && elapsed < 900 && ((absY > 70 && absY > absX * 1.15) || (absX > 80 && absX > absY * 1.15))) {
            closeDetailImageLightbox();
        }
    }, { passive: true });
}

setupDetailImageLightbox();



if (uploadPenPhotoArea) {
    uploadPenPhotoArea.onclick = async () => {
        if (!isManagerApp) return alert("Upload is only available in the Manager app.");
        let filePath = null;
        try {
            filePath = await desktopAPI.selectImage();
        } catch (error) {
            alert(`Image selection failed: ${error && error.message ? error.message : error}`);
            return;
        }
        if (filePath) {
            currentPenImagePath = filePath;
            uploadPenPhotoArea.classList.add('is-processing');
            if (penPhotoIcon) {
                penPhotoIcon.style.display = 'block';
                penPhotoIcon.classList.remove('ph-image');
                penPhotoIcon.classList.add('ph-circle-notch', 'is-loading');
            }
            if (penPhotoText) {
                penPhotoText.textContent = isHeicImagePath(filePath) ? 'Processing photo...' : 'Loading photo...';
                penPhotoText.style.display = 'block';
            }
            const previewSrc = await getLocalImagePreviewSource(filePath);
            if (uploadPenPreview) {
                // Setup onload BEFORE setting src to avoid race condition
                uploadPenPreview.onload = async () => {
                    let colors = null;
                    if (isManagerApp && desktopAPI && typeof desktopAPI.detectPenColors === 'function') {
                        try {
                            const result = await desktopAPI.detectPenColors(filePath);
                            if (result && result.success && result.colors) {
                                colors = result.colors;
                            }
                        } catch (error) {
                            console.warn('Local ML pen color detection failed, using fallback.', error);
                        }
                    }
                    if (!colors) {
                        colors = extractPenColors(uploadPenPreview) || extractInkColors(uploadPenPreview);
                    }
                    if (colors && colors.base) {
                        const palette = Array.isArray(colors.palette) ? colors.palette : [colors.base, colors.accent].filter(Boolean);
                        currentPenSuggestedColors = palette.slice(0, 4);
                        currentPenColors[0] = colors.base;
                        renderPenColorSlots();
                    }

                    if (uploadPenPreview.naturalWidth > uploadPenPreview.naturalHeight) {
                        currentPenRotation = 90;
                    } else {
                        currentPenRotation = 0;
                    }
                    penImageRemoved = false; // Reset removed flag on new upload

                    updatePenPreviewStyle(currentPenRotation);
                    uploadPenPhotoArea.classList.remove('is-processing');
                    if (penPhotoIcon) {
                        penPhotoIcon.classList.remove('ph-circle-notch', 'is-loading');
                        penPhotoIcon.classList.add('ph-image');
                    }
                    if (penPhotoText) penPhotoText.textContent = 'Click to upload photo';
                };

                if (penPhotoControls) penPhotoControls.style.display = 'flex';
            }

            // Set src after HEIC-aware preview resolution.
            uploadPenPreview.src = previewSrc;
            uploadPenPreview.style.display = 'block';
        }
        if (penPhotoIcon) penPhotoIcon.style.display = 'none';
        if (penPhotoText) penPhotoText.style.display = 'none';
    };
}

if (btnRemovePenPhoto) {
    btnRemovePenPhoto.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmAction({
            title: 'Remove Photo',
            message: 'Remove this photo?',
            destructive: true,
            buttons: ['Keep Photo', 'Remove Photo'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        })) {
            currentPenImagePath = null;
            penImageRemoved = true; // Mark as explicitly removed
            currentPenSuggestedColors = [];
            currentPenRotation = 0;
            uploadPenPhotoArea.classList.remove('is-processing');
            if (uploadPenPreview) {
                uploadPenPreview.src = '';
                uploadPenPreview.style.display = 'none';
            }
            if (penPhotoControls) penPhotoControls.style.display = 'none';
            if (penPhotoIcon) {
                penPhotoIcon.classList.remove('ph-circle-notch', 'is-loading');
                penPhotoIcon.classList.add('ph-image');
                penPhotoIcon.style.display = 'block';
            }
            if (penPhotoText) {
                penPhotoText.textContent = 'Click to upload photo';
                penPhotoText.style.display = 'block';
            }
        }
    };
}



if (btnRotatePen) {
    btnRotatePen.onclick = (e) => {
        e.stopPropagation();
        currentPenRotation = (currentPenRotation + 90) % 360;
        if (uploadPenPreview) {
            updatePenPreviewStyle(currentPenRotation);
        }
    };
}




if (btnAddPenHeader) {
    btnAddPenHeader.addEventListener('click', (e) => {
        e.preventDefault();
        openPenModal();
    });
}

if (btnAddInkHeader) {
    btnAddInkHeader.addEventListener('click', (e) => {
        e.preventDefault();
        openInkModal();
    });
}

if (btnExportBackup) {
    btnExportBackup.addEventListener('click', async () => {
        if (!isManagerApp || !desktopAPI || typeof desktopAPI.exportBackup !== 'function') return;
        let result = null;
        try {
            result = await desktopAPI.exportBackup();
        } catch (error) {
            showAppNotice(`Backup export failed: ${error && error.message ? error.message : error}`, 'error');
            return;
        }
        if (result && result.success) {
            refreshBackupStatus();
            showAppNotice(`Backup exported: ${result.path}`, 'success');
        } else if (!(result && result.canceled)) {
            showAppNotice(`Backup export failed: ${result && result.message ? result.message : 'Unknown error.'}`, 'error');
        }
    });
}

if (btnImportBackup) {
    btnImportBackup.addEventListener('click', async () => {
        if (!isManagerApp || !desktopAPI || typeof desktopAPI.importBackup !== 'function') return;
        const importExportPrefs = getImportExportPreferences();
        const proceed = await confirmAction({
            title: 'Import Backup',
            message: 'Importing a backup will replace your current data and may replace images. Continue?',
            destructive: true,
            buttons: ['Cancel', 'Import Backup'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        });
        if (!proceed) return;
        const importPrefs = getImportExportPreferences();
        let result = null;
        try {
            result = await desktopAPI.importBackup({
                auto_validate_import: !!importPrefs.auto_validate_import,
                conflict_behavior: String(importPrefs.conflict_behavior || 'overwrite').toLowerCase()
            });
        } catch (error) {
            showAppNotice(`Backup import failed: ${error && error.message ? error.message : error}`, 'error');
            return;
        }
        if (result && result.success) {
            const reloaded = await desktopAPI.loadData();
            if (reloaded) {
                if (importExportPrefs.auto_validate_import) {
                    const basicValid = Array.isArray(reloaded.pens)
                        && Array.isArray(reloaded.inks)
                        && Array.isArray(reloaded.currently_inked)
                        && Array.isArray(reloaded.activity_log);
                    if (!basicValid) {
                        showAppNotice('Imported backup validation failed. Data shape is unexpected', 'error');
                        return;
                    }
                }
                appData = ensureAppDataDefaults(reloaded);
                await refreshManagedImageCache();
            }
            applyShowcaseTitleUi();
            applyInterfacePreferences();
            applyShowcaseSortDefaults();
            applyShowcaseSectionVisibility();
            updateAutocompleteLists();
            renderDashboard();
            renderStatsPage();
            renderSettingsView();
            renderPens();
            renderInks();
            renderSwatches();
            renderActivityLogView();
            closeAllModals();
            refreshBackupStatus();
            if (result.warning) {
                showAppNotice(result.message || 'Backup imported with warnings. Please review your images and backups', 'warning');
            } else {
                showAppNotice('Backup imported successfully', 'success');
            }
        } else if (!(result && result.canceled)) {
            showAppNotice(`Backup import failed: ${result && result.message ? result.message : 'Unknown error'}`, 'error');
        }
    });
}

if (btnExportShowcase) {
    btnExportShowcase.addEventListener('click', async () => {
        if (!isManagerApp || !desktopAPI || typeof desktopAPI.exportShowcase !== 'function') return;
        if (isDockerMode) {
            showAppNotice('The Docker public website updates automatically. Showcase export is unavailable in Docker mode.', 'warning');
            return;
        }
        if (showcaseExportInFlight) return;
        showcaseExportInFlight = true;
        try {
            hideSettingsTooltip();
            suppressSettingsPersist = true;
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            suppressSettingsPersist = false;
            await persistShowcaseSettingsNow({ force: true, notify: false });

            let result = null;
            try {
                result = await desktopAPI.exportShowcase();
            } catch (error) {
                showAppNotice(`Showcase export failed: ${error && error.message ? error.message : error}`, 'error');
                return;
            }
            if (result && result.success) {
                showAppNotice(`Showcase exported: ${result.path}`, 'success');
            } else if (!(result && result.canceled)) {
                showAppNotice(`Showcase export failed: ${result && result.message ? result.message : 'Unknown error.'}`, 'error');
            }
        } finally {
            suppressSettingsPersist = false;
            showcaseExportInFlight = false;
            hideSettingsTooltip();
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            resetOverlayState();
            recoverSettingsInteractivity();
            reviveSettingsTextInputs();
            if (desktopAPI && typeof desktopAPI.focusWindow === 'function') {
                await desktopAPI.focusWindow();
            }
            if (typeof window.focus === 'function') {
                window.focus();
            }
            requestAnimationFrame(() => {
                recoverSettingsInteractivity();
                reviveSettingsTextInputs();
            });
        }
    });
}

function downloadTextFile(filename, text, mimeType = 'text/plain') {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function buildActivityCsv() {
    const includeMeta = !!getImportExportPreferences().include_optional_metadata;
    const headers = includeMeta
        ? ['id', 'timestamp', 'date', 'action', 'category', 'entity_id', 'message', 'metadata_json']
        : ['id', 'timestamp', 'date', 'action', 'category', 'entity_id', 'message'];
    const escapeCsv = (value) => {
        const v = String(value == null ? '' : value);
        return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const lines = [(headers.map(escapeCsv).join(','))];
    (appData.activity_log || []).forEach((entry) => {
        const row = [
            entry.id || '',
            entry.timestamp || '',
            formatDateByPreference(new Date(entry.timestamp || 0), { time: true }),
            entry.action || '',
            entry.category || '',
            entry.entity_id || '',
            entry.message || ''
        ];
        if (includeMeta) row.push(JSON.stringify(entry.metadata || {}));
        lines.push(row.map(escapeCsv).join(','));
    });
    return lines.join('\r\n');
}

if (btnExportActivityCsv) {
    btnExportActivityCsv.addEventListener('click', () => {
        const stamp = toIsoLocalDate(new Date());
        downloadTextFile(`activity-log-${stamp}.csv`, buildActivityCsv(), 'text/csv');
    });
}

if (btnExportActivityJson) {
    btnExportActivityJson.addEventListener('click', () => {
        const includeMeta = !!getImportExportPreferences().include_optional_metadata;
        const payload = (appData.activity_log || []).map((entry) => {
            const out = {
                id: entry.id || '',
                timestamp: entry.timestamp || 0,
                date: formatDateByPreference(new Date(entry.timestamp || 0), { time: true }),
                action: entry.action || '',
                category: entry.category || '',
                entity_id: entry.entity_id || '',
                message: entry.message || ''
            };
            if (includeMeta) out.metadata = entry.metadata || {};
            return out;
        });
        const stamp = toIsoLocalDate(new Date());
        downloadTextFile(`activity-log-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });
}

if (btnSaveInk) btnSaveInk.addEventListener('click', saveNewInk);
if (btnSavePen) btnSavePen.addEventListener('click', saveNewPen);
if (btnDeleteInk) btnDeleteInk.addEventListener('click', deleteInk);
if (btnDeletePen) btnDeletePen.addEventListener('click', deletePen);
if (btnEditSwatchDetail) {
    btnEditSwatchDetail.addEventListener('click', () => {
        if (currentSwatchDetailSourceView === 'inks') {
            if (currentSwatchDetailInkId) {
                openInkModal(currentSwatchDetailInkId);
            }
            return;
        }
        const swatchId = currentSwatchDetailSwatchId
            || (currentSwatchDetailSourceView === 'inks'
                ? ((getLatestSwatchForInk(currentSwatchDetailInkId) || {}).id || '')
                : currentSwatchDetailInkId);
        if (!swatchId) return;
        openEditSwatchModal(swatchId);
    });
}
if (btnEditPenDetail) {
    btnEditPenDetail.addEventListener('click', () => {
        if (!currentPenDetailPenId) return;
        openPenModal(currentPenDetailPenId);
    });
}

// Keyboard Shortcuts (Save on Enter)
const inkInputs = [inkNameInput, inkBrandInput];
inkInputs.forEach(input => {
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Prevent save if dropdown is open (autocomplete)
                const wrapper = input.closest('.custom-autocomplete-wrapper');
                if (wrapper) {
                    const list = wrapper.querySelector('.custom-options');
                    if (list && list.classList.contains('show')) return;
                }

                e.preventDefault();
                saveNewInk();
            }
        });
    }
});

const penInputs = [penBrandInput, penModelInput, penNibInput, penMaterialInput, penFillingSystemInput, penColorInput, penPriceInput, penInkSelect];
penInputs.forEach(input => {
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Prevent save if dropdown is open
                const wrapper = input.closest('.custom-autocomplete-wrapper');
                if (wrapper) {
                    const list = wrapper.querySelector('.custom-options');
                    if (list && list.classList.contains('show')) return;
                }

                e.preventDefault();
                saveNewPen();
            }
        });
    }
});

// Close Buttons (Delegation)
document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await requestCloseAllModals();
    });
});

if (viewSettings) {
    viewSettings.addEventListener('mousedown', (e) => {
        const target = e.target && e.target.closest
            ? e.target.closest('#view-settings input[type="text"], #view-settings input[type="number"], #view-settings textarea')
            : null;
        if (!target) return;
        target.disabled = false;
        target.readOnly = false;
        target.style.pointerEvents = 'auto';
        if (desktopAPI && typeof desktopAPI.focusWindow === 'function') {
            desktopAPI.focusWindow();
        }
        setTimeout(() => {
            if (typeof target.focus === 'function') target.focus();
        }, 0);
    });

    viewSettings.addEventListener('mouseover', (e) => {
        const target = e.target && e.target.closest ? e.target.closest('[data-tooltip]') : null;
        if (!target || !viewSettings.contains(target)) return;
        lastSettingsPointerPoint.x = e.clientX;
        lastSettingsPointerPoint.y = e.clientY;
        scheduleSettingsTooltip(target, e.clientX, e.clientY);
    });

    viewSettings.addEventListener('mousemove', (e) => {
        const target = e.target && e.target.closest ? e.target.closest('[data-tooltip]') : null;
        if (!target || !viewSettings.contains(target)) return;
        lastSettingsPointerPoint.x = e.clientX;
        lastSettingsPointerPoint.y = e.clientY;
        if (activeSettingsTooltipTarget && target === activeSettingsTooltipTarget) {
            positionSettingsTooltip(e.clientX, e.clientY);
            return;
        }
        scheduleSettingsTooltip(target, e.clientX, e.clientY);
    });

    viewSettings.addEventListener('mouseout', (e) => {
        const related = e.relatedTarget;
        if (activeSettingsTooltipTarget && related && activeSettingsTooltipTarget.contains(related)) return;
        const next = related && related.closest ? related.closest('[data-tooltip]') : null;
        if (next && viewSettings.contains(next)) {
            scheduleSettingsTooltip(next, e.clientX, e.clientY);
            return;
        }
        hideSettingsTooltip();
    });

    viewSettings.addEventListener('focusin', (e) => {
        const target = e.target && e.target.closest ? e.target.closest('[data-tooltip]') : null;
        if (!target || !viewSettings.contains(target)) return;
        if (activeSettingsTooltipTarget === target && settingsTooltipEl && settingsTooltipEl.classList.contains('is-visible')) return;
        const hasPointer = Number.isFinite(lastSettingsPointerPoint.x) && Number.isFinite(lastSettingsPointerPoint.y);
        if (hasPointer && target.matches(':hover')) {
            showSettingsTooltip(target, lastSettingsPointerPoint.x, lastSettingsPointerPoint.y);
            return;
        }
        const rect = target.getBoundingClientRect();
        showSettingsTooltip(target, rect.left + (rect.width / 2), rect.top + (rect.height / 2));
    });

    viewSettings.addEventListener('focusout', (e) => {
        const next = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('[data-tooltip]') : null;
        if (next && viewSettings.contains(next)) return;
        hideSettingsTooltip();
    });

    viewSettings.addEventListener('scroll', () => {
        if (activeSettingsTooltipTarget) hideSettingsTooltip();
    }, true);
}

// Nav Listeners
if (navDashboard) navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('dashboard');
    renderDashboard();
});
if (navStats) navStats.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('stats');
    renderStatsPage();
});
if (navSettings) navSettings.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('settings');
    renderSettingsView();
});
if (navPens) navPens.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('pens');
    renderPens();
});
if (navInks) navInks.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('inks');
    renderInks();
});
if (navSwatches) navSwatches.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('swatches');
    renderSwatches();
});
if (navActivity) navActivity.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('activity');
    renderActivityLogView();
});
if (toggleActivityVisible) {
    toggleActivityVisible.addEventListener('change', async () => {
        appData.preferences.show_activity_log = !!toggleActivityVisible.checked;
        if (shouldHideActivityInShowcase() && localStorage.getItem('lastView') === 'activity') {
            switchView('dashboard');
        }
        const saved = await persistDataAndRefresh({
            refresh: {
                activity: true,
                dashboard: true
            },
            onErrorMessage: 'Failed to save activity visibility.'
        });
        if (saved) showAppNotice('Settings saved', 'success');
    });
}

if (toggleRecentActivityVisible) {
    toggleRecentActivityVisible.addEventListener('change', async () => {
        appData.preferences.show_recent_activity = !!toggleRecentActivityVisible.checked;
        const saved = await persistDataAndRefresh({
            refresh: {
                activity: true,
                dashboard: true
            },
            onErrorMessage: 'Failed to save dashboard activity visibility.'
        });
        if (saved) showAppNotice('Settings saved', 'success');
    });
}

if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', () => {
        void checkForAppUpdates();
    });
}

if (btnOpenReleases) {
    btnOpenReleases.addEventListener('click', async (event) => {
        if (!isManagerApp || !desktopAPI || typeof desktopAPI.openExternalUrl !== 'function') return;
        event.preventDefault();
        const releaseUrl = btnOpenReleases.href || latestReleaseStatus?.releasesUrl || 'https://github.com/aloglu/inkubator/releases';
        const result = await desktopAPI.openExternalUrl(releaseUrl);
        if (!result || !result.success) {
            alert(result && result.message ? result.message : 'Failed to open release page.');
        }
    });
}

if (toggleShowcaseInsightsVisible) {
    toggleShowcaseInsightsVisible.addEventListener('change', persistShowcaseSettings);
}

if (toggleShowcasePricesVisible) {
    toggleShowcasePricesVisible.addEventListener('change', persistShowcaseSettings);
}

if (toggleShowcasePensVisible) {
    toggleShowcasePensVisible.addEventListener('change', persistShowcaseSettings);
}

if (toggleShowcaseInksVisible) {
    toggleShowcaseInksVisible.addEventListener('change', persistShowcaseSettings);
}

if (toggleShowcaseSwatchesVisible) {
    toggleShowcaseSwatchesVisible.addEventListener('change', persistShowcaseSettings);
}

if (toggleShowcaseActivityFiltersVisible) {
    toggleShowcaseActivityFiltersVisible.addEventListener('change', persistShowcaseSettings);
}

if (toggleShowcaseChartsVisible) {
    toggleShowcaseChartsVisible.addEventListener('change', persistShowcaseSettings);
}

if (colorModeSelect) {
    colorModeSelect.addEventListener('change', persistShowcaseSettings);
}
if (toggleOpenCardsEditMode) {
    toggleOpenCardsEditMode.addEventListener('change', persistShowcaseSettings);
}
if (showcaseColorModeSelect) {
    showcaseColorModeSelect.addEventListener('change', persistShowcaseSettings);
}

if (toggleConfirmDestructive) {
    toggleConfirmDestructive.addEventListener('change', persistShowcaseSettings);
}

if (activityLogVerbositySelect) {
    activityLogVerbositySelect.addEventListener('change', persistShowcaseSettings);
}

if (toggleLogPenEdits) {
    toggleLogPenEdits.addEventListener('change', persistShowcaseSettings);
}

if (toggleLogInkEdits) {
    toggleLogInkEdits.addEventListener('change', persistShowcaseSettings);
}

if (toggleLogSwatchEvents) {
    toggleLogSwatchEvents.addEventListener('change', persistShowcaseSettings);
}

if (toggleLogDeleteEvents) {
    toggleLogDeleteEvents.addEventListener('change', persistShowcaseSettings);
}

if (showcaseSortPensSelect) {
    showcaseSortPensSelect.addEventListener('change', persistShowcaseSettings);
}

if (showcaseSortInksSelect) {
    showcaseSortInksSelect.addEventListener('change', persistShowcaseSettings);
}

if (showcaseSortSwatchesSelect) {
    showcaseSortSwatchesSelect.addEventListener('change', persistShowcaseSettings);
}

if (defaultCurrencySelect) defaultCurrencySelect.addEventListener('change', persistShowcaseSettings);
if (defaultDateFormatSelect) defaultDateFormatSelect.addEventListener('change', persistShowcaseSettings);
if (defaultPenStatusSelect) defaultPenStatusSelect.addEventListener('change', persistShowcaseSettings);
if (defaultInkTypeSelect) defaultInkTypeSelect.addEventListener('change', persistShowcaseSettings);
if (toggleImportAutoValidate) toggleImportAutoValidate.addEventListener('change', persistShowcaseSettings);
if (toggleExportIncludeMetadata) toggleExportIncludeMetadata.addEventListener('change', persistShowcaseSettings);
if (importConflictBehaviorSelect) importConflictBehaviorSelect.addEventListener('change', persistShowcaseSettings);
if (autoBackupFrequencySelect) autoBackupFrequencySelect.addEventListener('change', persistShowcaseSettings);

if (defaultPenNibInput) {
    defaultPenNibInput.addEventListener('input', persistShowcaseSettingsDebounced);
    defaultPenNibInput.addEventListener('change', persistShowcaseSettings);
    defaultPenNibInput.addEventListener('blur', persistShowcaseSettings);
}
if (defaultPenNibMaterialInput) {
    defaultPenNibMaterialInput.addEventListener('input', persistShowcaseSettingsDebounced);
    defaultPenNibMaterialInput.addEventListener('change', persistShowcaseSettings);
    defaultPenNibMaterialInput.addEventListener('blur', persistShowcaseSettings);
}
if (backupRetentionCountInput) {
    backupRetentionCountInput.addEventListener('input', persistShowcaseSettingsDebounced);
    backupRetentionCountInput.addEventListener('change', persistShowcaseSettings);
    backupRetentionCountInput.addEventListener('blur', persistShowcaseSettings);
}
if (toggleBackupKeepReplacedImages) toggleBackupKeepReplacedImages.addEventListener('change', persistShowcaseSettings);

if (showcaseTitleInput) {
    showcaseTitleInput.addEventListener('input', () => {
        applyShowcaseTitlePreview(showcaseTitleInput.value);
        persistShowcaseSettingsDebounced();
    });
    showcaseTitleInput.addEventListener('change', persistShowcaseSettings);
    showcaseTitleInput.addEventListener('blur', persistShowcaseSettings);
    showcaseTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            showcaseTitleInput.blur();
        }
    });
}

if (activityRetentionSelect) {
    activityRetentionSelect.addEventListener('change', () => {
        const selected = Number(activityRetentionSelect.value);
        appData.preferences.activity_retention_days = [0, 90, 180, 365].includes(selected) ? selected : 365;
        applyActivityRetention();
        persistActivityMaintenance('Failed to save activity retention.');
    });
}

if (btnDeleteOlderActivity) {
    btnDeleteOlderActivity.addEventListener('click', async () => {
        const days = Number(activityDeleteOlderSelect?.value || 90);
        if (![30, 90, 180, 365].includes(days)) return;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const removableCount = (appData.activity_log || []).filter(entry => (entry.timestamp || 0) < cutoff).length;
        if (removableCount === 0) {
            alert(`No activity entries older than ${days} days.`);
            return;
        }
        if (!(await confirmAction({
            title: 'Delete Older Activity',
            message: `Delete ${removableCount} activity entries older than ${days} days?`,
            destructive: true,
            buttons: ['Keep Logs', 'Delete Older Logs'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        }))) return;

        appData.activity_log = (appData.activity_log || []).filter(entry => (entry.timestamp || 0) >= cutoff);
        persistActivityMaintenance('Failed to delete older activity logs.');
    });
}

if (btnClearAllActivity) {
    btnClearAllActivity.addEventListener('click', async () => {
        const total = (appData.activity_log || []).length;
        if (total === 0) {
            alert('Activity log is already empty.');
            return;
        }
        if (!(await confirmAction({
            title: 'Clear All Activity Logs',
            message: `Delete all ${total} activity entries?`,
            detail: 'This action cannot be undone.',
            destructive: true,
            buttons: ['Keep Logs', 'Clear All'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        }))) return;

        appData.activity_log = [];
        persistActivityMaintenance('Failed to clear activity logs.');
    });
}

function applyActivityFiltersFromControls() {
    activityTypeFilter = activityFilterTypeSelect ? String(activityFilterTypeSelect.value || 'all').toLowerCase() : 'all';
    activityActionFilter = activityFilterActionSelect ? String(activityFilterActionSelect.value || 'all').toLowerCase() : 'all';
    activitySearchFilter = activityFilterSearchInput ? String(activityFilterSearchInput.value || '') : '';
    activityDateFromFilter = activityFilterDateFromInput ? String(activityFilterDateFromInput.value || '').trim() : '';
    activityDateToFilter = activityFilterDateToInput ? String(activityFilterDateToInput.value || '').trim() : '';
    activityCurrentPage = 1;
    renderActivityLogView();
}

function resetActivityFilters() {
    activityTypeFilter = 'all';
    activityActionFilter = 'all';
    activitySearchFilter = '';
    activityDateFromFilter = '';
    activityDateToFilter = '';
    activityDateFilter = '';
    if (activityFilterTypeSelect) activityFilterTypeSelect.value = 'all';
    if (activityFilterActionSelect) activityFilterActionSelect.value = 'all';
    if (activityFilterSearchInput) activityFilterSearchInput.value = '';
    if (activityFilterDateFromInput) activityFilterDateFromInput.value = '';
    if (activityFilterDateToInput) activityFilterDateToInput.value = '';
    activityCurrentPage = 1;
    renderActivityLogView();
}

if (activityFilterTypeSelect) {
    activityFilterTypeSelect.addEventListener('change', applyActivityFiltersFromControls);
}

if (activityFilterActionSelect) {
    activityFilterActionSelect.addEventListener('change', applyActivityFiltersFromControls);
}

if (activityFilterSearchInput) {
    activityFilterSearchInput.addEventListener('input', applyActivityFiltersFromControls);
}

if (activityFilterDateFromWrap) {
    activityFilterDateFromWrap.addEventListener('click', (e) => {
        if (activityFilterDateFromPopover?.contains(e.target)) return;
        if (activityFilterDateFromToggle?.contains(e.target)) return;
        if (activityFilterDateFromPopover && activityFilterDateFromPopover.classList.contains('open')) {
            closeActivityFilterDateCalendar('from');
        } else {
            openActivityFilterDateCalendar('from');
        }
    });
}

if (activityFilterDateToWrap) {
    activityFilterDateToWrap.addEventListener('click', (e) => {
        if (activityFilterDateToPopover?.contains(e.target)) return;
        if (activityFilterDateToToggle?.contains(e.target)) return;
        if (activityFilterDateToPopover && activityFilterDateToPopover.classList.contains('open')) {
            closeActivityFilterDateCalendar('to');
        } else {
            openActivityFilterDateCalendar('to');
        }
    });
}

if (activityFilterDateFromToggle) {
    activityFilterDateFromToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activityFilterDateFromPopover && activityFilterDateFromPopover.classList.contains('open')) {
            closeActivityFilterDateCalendar('from');
        } else {
            openActivityFilterDateCalendar('from');
        }
    });
}

if (activityFilterDateToToggle) {
    activityFilterDateToToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activityFilterDateToPopover && activityFilterDateToPopover.classList.contains('open')) {
            closeActivityFilterDateCalendar('to');
        } else {
            openActivityFilterDateCalendar('to');
        }
    });
}

if (activityFilterDateFromPrev) {
    activityFilterDateFromPrev.addEventListener('click', () => {
        activityFilterDateFromCalendarViewDate = new Date(
            activityFilterDateFromCalendarViewDate.getFullYear(),
            activityFilterDateFromCalendarViewDate.getMonth() - 1,
            1
        );
        renderActivityFilterDateCalendar('from');
    });
}

if (activityFilterDateFromNext) {
    activityFilterDateFromNext.addEventListener('click', () => {
        if (activityFilterDateFromNext.disabled) return;
        activityFilterDateFromCalendarViewDate = new Date(
            activityFilterDateFromCalendarViewDate.getFullYear(),
            activityFilterDateFromCalendarViewDate.getMonth() + 1,
            1
        );
        renderActivityFilterDateCalendar('from');
    });
}

if (activityFilterDateFromGrid) {
    activityFilterDateFromGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-activity-filter-date-from]');
        if (!btn) return;
        const iso = btn.getAttribute('data-activity-filter-date-from');
        if (!iso) return;
        setActivityFilterDateInputValue('from', iso);
        applyActivityFiltersFromControls();
        closeActivityFilterDateCalendar('from');
    });
}

if (activityFilterDateFromClear) {
    activityFilterDateFromClear.addEventListener('click', () => {
        setActivityFilterDateInputValue('from', '');
        applyActivityFiltersFromControls();
        closeActivityFilterDateCalendar('from');
    });
}

if (activityFilterDateFromToday) {
    activityFilterDateFromToday.addEventListener('click', () => {
        setActivityFilterDateInputValue('from', toIsoLocalDate(new Date()));
        applyActivityFiltersFromControls();
        closeActivityFilterDateCalendar('from');
    });
}

if (activityFilterDateToPrev) {
    activityFilterDateToPrev.addEventListener('click', () => {
        activityFilterDateToCalendarViewDate = new Date(
            activityFilterDateToCalendarViewDate.getFullYear(),
            activityFilterDateToCalendarViewDate.getMonth() - 1,
            1
        );
        renderActivityFilterDateCalendar('to');
    });
}

if (activityFilterDateToNext) {
    activityFilterDateToNext.addEventListener('click', () => {
        if (activityFilterDateToNext.disabled) return;
        activityFilterDateToCalendarViewDate = new Date(
            activityFilterDateToCalendarViewDate.getFullYear(),
            activityFilterDateToCalendarViewDate.getMonth() + 1,
            1
        );
        renderActivityFilterDateCalendar('to');
    });
}

if (activityFilterDateToGrid) {
    activityFilterDateToGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-activity-filter-date-to]');
        if (!btn) return;
        const iso = btn.getAttribute('data-activity-filter-date-to');
        if (!iso) return;
        setActivityFilterDateInputValue('to', iso);
        applyActivityFiltersFromControls();
        closeActivityFilterDateCalendar('to');
    });
}

if (activityFilterDateToClear) {
    activityFilterDateToClear.addEventListener('click', () => {
        setActivityFilterDateInputValue('to', '');
        applyActivityFiltersFromControls();
        closeActivityFilterDateCalendar('to');
    });
}

if (activityFilterDateToToday) {
    activityFilterDateToToday.addEventListener('click', () => {
        setActivityFilterDateInputValue('to', toIsoLocalDate(new Date()));
        applyActivityFiltersFromControls();
        closeActivityFilterDateCalendar('to');
    });
}

if (btnActivityFiltersReset) {
    btnActivityFiltersReset.addEventListener('click', () => {
        resetActivityFilters();
    });
}

if (activityPageSizeSelect) {
    activityPageSizeSelect.addEventListener('change', () => {
        const selected = Number(activityPageSizeSelect.value);
        if ([10, 20, 30, 50].includes(selected)) {
            activityPageSize = selected;
            activityCurrentPage = 1;
            localStorage.setItem('activityPageSize', String(selected));
            renderActivityLogView();
        }
    });
}

if (activityPagePrevBtn) {
    activityPagePrevBtn.addEventListener('click', () => {
        activityCurrentPage = Math.max(1, activityCurrentPage - 1);
        renderActivityLogView();
    });
}

if (activityPageNextBtn) {
    activityPageNextBtn.addEventListener('click', () => {
        activityCurrentPage += 1;
        renderActivityLogView();
    });
}

if (activityDatePickerToggle) {
    activityDatePickerToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activityCalendarPopover && activityCalendarPopover.classList.contains('open')) {
            closeActivityCalendar();
        } else {
            closeActivityFilterDateCalendars();
            openActivityCalendar();
        }
    });
}

if (activityCalendarPrev) {
    activityCalendarPrev.addEventListener('click', () => {
        activityCalendarViewDate = new Date(activityCalendarViewDate.getFullYear(), activityCalendarViewDate.getMonth() - 1, 1);
        renderActivityCalendar();
    });
}

if (activityCalendarNext) {
    activityCalendarNext.addEventListener('click', () => {
        if (activityCalendarNext.disabled) return;
        activityCalendarViewDate = new Date(activityCalendarViewDate.getFullYear(), activityCalendarViewDate.getMonth() + 1, 1);
        renderActivityCalendar();
    });
}

if (activityCalendarGrid) {
    activityCalendarGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-calendar-date]');
        if (!btn) return;
        const iso = btn.getAttribute('data-calendar-date');
        if (!iso) return;
        activityDateFilter = iso;
        activityCurrentPage = 1;
        renderActivityLogView();
        closeActivityCalendar();
    });
}

if (activityCalendarClear) {
    activityCalendarClear.addEventListener('click', () => {
        activityDateFilter = '';
        activityCurrentPage = 1;
        renderActivityLogView();
        closeActivityCalendar();
    });
}

if (activityCalendarToday) {
    activityCalendarToday.addEventListener('click', () => {
        activityDateFilter = toIsoLocalDate(new Date());
        activityCurrentPage = 1;
        renderActivityLogView();
        closeActivityCalendar();
    });
}

if (swatchDatePickerToggle) {
    swatchDatePickerToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (swatchCalendarPopover && swatchCalendarPopover.classList.contains('open')) {
            closeSwatchCalendar();
        } else {
            openSwatchCalendar();
        }
    });
}

if (swatchDatePickerWrap) {
    swatchDatePickerWrap.addEventListener('click', (e) => {
        if (swatchCalendarPopover?.contains(e.target)) return;
        if (swatchDatePickerToggle?.contains(e.target)) return;
        if (swatchCalendarPopover && swatchCalendarPopover.classList.contains('open')) {
            closeSwatchCalendar();
        } else {
            openSwatchCalendar();
        }
    });
}

if (swatchCalendarPrev) {
    swatchCalendarPrev.addEventListener('click', () => {
        swatchCalendarViewDate = new Date(swatchCalendarViewDate.getFullYear(), swatchCalendarViewDate.getMonth() - 1, 1);
        renderSwatchCalendar();
    });
}

if (swatchCalendarNext) {
    swatchCalendarNext.addEventListener('click', () => {
        if (swatchCalendarNext.disabled) return;
        swatchCalendarViewDate = new Date(swatchCalendarViewDate.getFullYear(), swatchCalendarViewDate.getMonth() + 1, 1);
        renderSwatchCalendar();
    });
}

if (swatchCalendarGrid) {
    swatchCalendarGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-swatch-calendar-date]');
        if (!btn) return;
        const iso = btn.getAttribute('data-swatch-calendar-date');
        if (!iso) return;
        setSwatchDateInputValue(iso);
        closeSwatchCalendar();
    });
}

if (swatchCalendarClear) {
    swatchCalendarClear.addEventListener('click', () => {
        setSwatchDateInputValue('');
        closeSwatchCalendar();
    });
}

if (swatchCalendarToday) {
    swatchCalendarToday.addEventListener('click', () => {
        setSwatchDateInputValue(toIsoLocalDate(new Date()));
        closeSwatchCalendar();
    });
}

document.addEventListener('click', (e) => {
    if (activityCalendarPopover && activityDatePickerToggle && activityCalendarPopover.classList.contains('open')) {
        if (!activityCalendarPopover.contains(e.target) && !activityDatePickerToggle.contains(e.target)) {
            closeActivityCalendar();
        }
    }
    if (swatchCalendarPopover && swatchDatePickerWrap && swatchCalendarPopover.classList.contains('open')) {
        if (!swatchCalendarPopover.contains(e.target) && !swatchDatePickerWrap.contains(e.target)) {
            closeSwatchCalendar();
        }
    }
    if (activityFilterDateFromPopover && activityFilterDateFromWrap && activityFilterDateFromPopover.classList.contains('open')) {
        if (!activityFilterDateFromPopover.contains(e.target) && !activityFilterDateFromWrap.contains(e.target)) {
            closeActivityFilterDateCalendar('from');
        }
    }
    if (activityFilterDateToPopover && activityFilterDateToWrap && activityFilterDateToPopover.classList.contains('open')) {
        if (!activityFilterDateToPopover.contains(e.target) && !activityFilterDateToWrap.contains(e.target)) {
            closeActivityFilterDateCalendar('to');
        }
    }
    const tooltipTarget = e.target && e.target.closest
        ? e.target.closest('[data-insight-tooltip]')
        : null;
    if (!tooltipTarget) hideInsightsTooltip();
});

document.addEventListener('mouseover', (e) => {
    const target = e.target && e.target.closest ? e.target.closest('[data-insight-tooltip]') : null;
    if (!target) return;
    showInsightsTooltip(target, e.clientX, e.clientY);
});

document.addEventListener('mousemove', (e) => {
    if (!activeInsightsTooltipTarget) return;
    positionInsightsTooltip(e.clientX, e.clientY);
});

document.addEventListener('mouseout', (e) => {
    const target = e.target && e.target.closest ? e.target.closest('[data-insight-tooltip]') : null;
    if (!target) return;
    const next = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('[data-insight-tooltip]') : null;
    if (next === target) return;
    hideInsightsTooltip();
});

document.addEventListener('focusin', (e) => {
    const target = e.target && e.target.closest ? e.target.closest('[data-insight-tooltip]') : null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showInsightsTooltip(target, rect.left + (rect.width / 2), rect.top + (rect.height / 2));
});

document.addEventListener('focusout', (e) => {
    const target = e.target && e.target.closest ? e.target.closest('[data-insight-tooltip]') : null;
    if (!target) return;
    const next = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('[data-insight-tooltip]') : null;
    if (next) return;
    hideInsightsTooltip();
});

if (activityLogContainer) {
    activityLogContainer.addEventListener('click', async (e) => {
        if (!isManagerApp) return;
        const btn = e.target.closest('[data-delete-activity-id]');
        if (!btn) return;
        const activityId = btn.getAttribute('data-delete-activity-id');
        if (!(await confirmAction({
            title: 'Delete Activity Entry',
            message: 'Delete this activity entry?',
            destructive: true,
            buttons: ['Keep Entry', 'Delete Entry'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        }))) return;
        deleteActivityEntry(activityId);
    });
}

// Inks Filtering & Sorting Helpers
function getInkColorCategory(hex) {
    if (!hex) return 'Other';
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);

    // Convert to HSL
    let r_norm = r / 255, g_norm = g / 255, b_norm = b / 255;
    let max = Math.max(r_norm, g_norm, b_norm), min = Math.min(r_norm, g_norm, b_norm);
    let h_val, s, l = (max + min) / 2;

    if (max === min) {
        h_val = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r_norm: h_val = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
            case g_norm: h_val = (b_norm - r_norm) / d + 2; break;
            case b_norm: h_val = (r_norm - g_norm) / d + 4; break;
        }
        h_val /= 6;
    }

    h_val *= 360;
    s *= 100;
    l *= 100;

    // Categorization Logic (Expanded)
    if (l < 15) return 'Black';
    if (l > 85) return 'White';
    if (s < 12) return 'Grey';

    if (h_val < 15 || h_val >= 345) return 'Red';
    if (h_val < 45) {
        if (l < 40) return 'Brown';
        return 'Orange';
    }
    if (h_val < 75) {
        if (l < 30) return 'Brown';
        return 'Yellow';
    }
    if (h_val < 165) return 'Green';
    if (h_val < 255) return 'Blue';
    if (h_val < 300) return 'Purple';
    if (h_val < 345) return 'Pink';

    return 'Other';
}

function getColorHexForCategory(cat) {
    const map = {
        'Red': '#e74c3c', 'Orange': '#e67e22', 'Yellow': '#f1c40f',
        'Green': '#2ecc71', 'Blue': '#3498db', 'Purple': '#9b59b6',
        'Pink': '#fd79a8', 'Brown': '#8d6e63', 'Black': '#000000',
        'Grey': '#95a5a6', 'White': '#ffffff'
    };
    return map[cat] || '#ccc';
}

function togglePenFilterTag(category, value) {
    if (!activePensFilters[category]) activePensFilters[category] = [];
    const arr = activePensFilters[category];

    const index = arr.indexOf(value);
    if (index > -1) arr.splice(index, 1);
    else arr.push(value);

    renderPenFilters();
    renderPens(); // Dynamic application
}

function renderPenFilters() {
    const container = document.getElementById('pen-filter-options-container');
    if (!container) return;

    const previousScrollTop = container.scrollTop;

    const pens = appData.pens || [];
    const brands = [...new Set(pens.map(p => p.brand).filter(Boolean))].sort();
    const nibs = [...new Set(pens.map(p => p.nib).filter(Boolean))].sort();
    const nibMaterials = [...new Set(pens.map(p => p.nib_material).filter(Boolean))].sort();
    const materials = collectUniqueFromCsv(pens, 'material');
    const fillingSystems = collectUniqueFromCsv(pens, 'filling_system');
    const colors = collectUniqueFromCsv(pens, 'color');
    const statuses = ['Inked', 'Resting'];

    const createGroup = (label, html) => `
        <div class="filter-group">
            <label style="font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: none; letter-spacing: 0;">${escapeHtml(label)}</label>
            ${html}
        </div>
    `;

    const createTagList = (category, options) => `
        <div class="filter-tags">
            ${options.map((opt) => {
                const safeCategory = escapeHtml(category);
                const safeOpt = escapeHtml(opt);
                const safeOptHtml = escapeHtml(opt);
                return `<span class="filter-tag ${(activePensFilters[category] || []).includes(opt) ? 'active' : ''}" data-filter-category="${safeCategory}" data-filter-value="${safeOpt}">${safeOptHtml}</span>`;
            }).join('')}
        </div>
    `;

    container.innerHTML = `
        ${createGroup('Status', createTagList('status', statuses))}
        ${createGroup('Brand', createTagList('brand', brands))}
        ${createGroup('Nib Size', createTagList('nib', nibs))}
        ${createGroup('Nib Material', createTagList('nib_material', nibMaterials))}
        ${createGroup('Body Material', createTagList('material', materials))}
        ${createGroup('Filling System', createTagList('filling_system', fillingSystems))}
        ${createGroup('Color', createTagList('color', colors))}
    `;

    if (previousScrollTop > 0) {
        container.scrollTop = previousScrollTop;
    }
}

function toggleFilterTag(category, value) {
    if (!activeInksFilters[category]) activeInksFilters[category] = [];
    const arr = activeInksFilters[category];
    if (category === 'color') {
        // Binary selection for color: if clicking the same one, deselect. If new one, replace.
        if (arr.includes(value)) {
            activeInksFilters[category] = [];
        } else {
            activeInksFilters[category] = [value];
        }
    } else {
        // Multi-select for others
        const index = arr.indexOf(value);
        if (index > -1) arr.splice(index, 1);
        else arr.push(value);
    }
    renderFilters();
    renderInks(); // Dynamic application
}

function toggleSwatchFilterTag(category, value) {
    if (!activeSwatchesFilters[category]) activeSwatchesFilters[category] = [];
    const arr = activeSwatchesFilters[category];

    if (category === 'color') {
        if (arr.includes(value)) {
            activeSwatchesFilters[category] = [];
        } else {
            activeSwatchesFilters[category] = [value];
        }
    } else {
        const index = arr.indexOf(value);
        if (index > -1) arr.splice(index, 1);
        else arr.push(value);
    }

    renderSwatchFilters();
    renderSwatches(); // Dynamic application
}

function renderFilters() {
    const container = document.getElementById('filter-options-container');
    if (!container) return;

    // Save scroll position to prevent jumping
    const previousScrollTop = container.scrollTop;

    const inks = getLibraryInks();
    const brands = [...new Set(inks.map(i => i.brand).filter(Boolean))].sort();
    const lines = [...new Set(inks.map(i => i.line).filter(Boolean))].sort();
    const types = ['Bottle', 'Sample', 'Cartridge'];
    const flowOpts = ['Dry', 'Average', 'Wet'];
    const lubOpts = ['None', 'Low', 'Medium', 'High'];
    const dryTimeOpts = ['Fast', 'Average', 'Slow'];
    const baseTypes = [...new Set(inks.flatMap(i => i.base_type || []))].sort();
    const permanences = [...new Set(inks.map(i => i.permanence).filter(Boolean))].sort();
    const papers = [...new Set(inks.flatMap(i => i.paper_compatibility || []))].sort();
    const volumes = [...new Set(inks.map(i => (i.cl || '').toString().trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const colorHexes = new Set();
    inks.forEach(ink => {
        if (ink.color_base) colorHexes.add(ink.color_base);
    });

    const getHue = (hex) => {
        if (!hex) return 0;
        const h = hex.replace('#', '');
        if (h.length !== 6) return 0;
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let hue = 0;
        if (max === min) hue = 0;
        else if (max === r) hue = (g - b) / (max - min);
        else if (max === g) hue = 2 + (b - r) / (max - min);
        else hue = 4 + (r - g) / (max - min);
        hue *= 60;
        if (hue < 0) hue += 360;
        return hue;
    };

    let colors = Array.from(colorHexes).sort((a, b) => getHue(a) - getHue(b));

    const createGroup = (label, html) => `
        <div class="filter-group">
            <label style="font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: none; letter-spacing: 0;">${escapeHtml(label)}</label>
            ${html}
        </div>
    `;

    const createTagList = (category, options) => `
        <div class="filter-tags">
            ${options.map((opt) => {
                const safeCategory = escapeHtml(category);
                const safeOpt = escapeHtml(opt);
                const safeOptHtml = escapeHtml(opt);
                return `<span class="filter-tag ${(activeInksFilters[category] || []).includes(opt) ? 'active' : ''}" data-filter-category="${safeCategory}" data-filter-value="${safeOpt}">${safeOptHtml}</span>`;
            }).join('')}
        </div>
    `;

    const createVolumeTagList = (options) => `
        <div class="filter-tags">
            ${options.map((opt) => {
                const safeOpt = escapeHtml(opt);
                const safeOptHtml = escapeHtml(opt);
                return `<span class="filter-tag ${(activeInksFilters.volume || []).includes(opt) ? 'active' : ''}" data-filter-category="volume" data-filter-value="${safeOpt}">${safeOptHtml} cl</span>`;
            }).join('')}
        </div>
    `;

    container.innerHTML = `
        ${createGroup('Brand', createTagList('brand', brands))}
        ${createGroup('Color Group', `
            <div class="color-chips" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; min-height: 24px;">
                ${colors.length > 0 ? colors.map(c => `
                    <div class="color-chip ${(activeInksFilters.color || []).includes(c) ? 'active' : ''}"
                         style="background: ${c}; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(0,0,0,0.3); box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex-shrink: 0;"
                         data-filter-category="color"
                         data-filter-value="${escapeHtml(c)}"
                         title="${escapeHtml(c)}"></div>
                `).join('') : '<span style="color: #999; font-size: 13px; font-style: italic; display: block;">No colors detected.</span>'}
            </div>
        `)}
        ${createGroup('Line', createTagList('line', lines))}
        ${createGroup('Volume', createVolumeTagList(volumes))}
        ${createGroup('Properties', createTagList('properties', ['Shading', 'Sheen', 'Shimmer']))}
        ${createGroup('Flow', createTagList('flow', flowOpts))}
        ${createGroup('Lubrication', createTagList('lubrication', lubOpts))}
        ${createGroup('Dry Time', createTagList('dryTime', dryTimeOpts))}
        ${createGroup('Type', createTagList('type', types))}
        ${createGroup('Base Type', createTagList('baseType', baseTypes))}
        ${createGroup('Permanence', createTagList('permanence', permanences))}
        ${createGroup('Paper Compatibility', createTagList('paper', papers))}
    `;

    if (previousScrollTop > 0) {
        container.scrollTop = previousScrollTop;
    }
}

function renderSwatchFilters() {
    const container = document.getElementById('swatch-filter-options-container');
    if (!container) return;

    const previousScrollTop = container.scrollTop;

    const swatches = getAllSwatches()
        .map((swatch) => ({ swatch, ink: getInkById(swatch.ink_id) }))
        .filter((item) => item.ink && item.swatch && item.swatch.image);
    const brands = [...new Set(swatches.map(({ ink }) => ink.brand).filter(Boolean))].sort();
    const types = ['Bottle', 'Sample', 'Cartridge'];
    const flowOpts = ['Dry', 'Average', 'Wet'];
    const lubOpts = ['None', 'Low', 'Medium', 'High'];
    const dryTimeOpts = ['Fast', 'Average', 'Slow'];
    const baseTypes = [...new Set(swatches.flatMap(({ ink }) => ink.base_type || []))].sort();
    const permanences = [...new Set(swatches.map(({ ink }) => ink.permanence).filter(Boolean))].sort();
    const lightingValues = [...new Set(
        swatches
            .map(({ swatch }) => String((swatch && swatch.swatch_lighting) || 'Unknown').trim())
            .filter(Boolean)
    )].sort((a, b) => {
        if (a === 'Unknown') return -1;
        if (b === 'Unknown') return 1;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    const nibs = [...new Set(
        swatches.flatMap(({ swatch }) => normalizeCsvValues((swatch && swatch.swatch_nib) || ''))
    )].sort();
    const papers = [...new Set(
        swatches.flatMap(({ swatch }) => normalizeCsvValues((swatch && swatch.swatch_paper) || ''))
    )].sort();

    const colorHexes = new Set();
    swatches.forEach(({ ink }) => { if (ink.color_base) colorHexes.add(ink.color_base); });

    const getHue = (hex) => {
        if (!hex) return 0;
        const h = hex.replace('#', '');
        if (h.length !== 6) return 0;
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let hue = 0;
        if (max === min) hue = 0;
        else if (max === r) hue = (g - b) / (max - min);
        else if (max === g) hue = 2 + (b - r) / (max - min);
        else hue = 4 + (r - g) / (max - min);
        hue *= 60;
        if (hue < 0) hue += 360;
        return hue;
    };

    let colors = Array.from(colorHexes).sort((a, b) => getHue(a) - getHue(b));

    const createGroup = (label, html) => `
        <div class="filter-group">
            <label style="font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: none; letter-spacing: 0;">${escapeHtml(label)}</label>
            ${html}
        </div>
    `;

    const createTagList = (category, options) => `
        <div class="filter-tags">
            ${options.map((opt) => {
                const safeCategory = escapeHtml(category);
                const safeOpt = escapeHtml(opt);
                const safeOptHtml = escapeHtml(opt);
                return `<span class="filter-tag ${(activeSwatchesFilters[category] || []).includes(opt) ? 'active' : ''}" data-filter-category="${safeCategory}" data-filter-value="${safeOpt}">${safeOptHtml}</span>`;
            }).join('')}
        </div>
    `;

    const sections = [];
    sections.push(createGroup('Brand', createTagList('brand', brands)));
    sections.push(createGroup('Color Group', `
            <div class="color-chips" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; min-height: 24px;">
                ${colors.length > 0 ? colors.map(c => `
                    <div class="color-chip ${(activeSwatchesFilters.color || []).includes(c) ? 'active' : ''}"
                         style="background: ${c}; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(0,0,0,0.3); box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex-shrink: 0;"
                         data-filter-category="color"
                         data-filter-value="${escapeHtml(c)}"
                         title="${escapeHtml(c)}"></div>
                `).join('') : '<span style="color: #999; font-size: 13px; font-style: italic; display: block;">No colors detected.</span>'}
            </div>
    `));
    sections.push(createGroup('Flow', createTagList('flow', flowOpts)));
    sections.push(createGroup('Lubrication', createTagList('lubrication', lubOpts)));
    sections.push(createGroup('Dry Time', createTagList('dryTime', dryTimeOpts)));
    sections.push(createGroup('Type', createTagList('type', types)));
    sections.push(createGroup('Base Type', createTagList('baseType', baseTypes)));
    sections.push(createGroup('Permanence', createTagList('permanence', permanences)));
    sections.push(createGroup('Lighting', createTagList('lighting', lightingValues)));
    if (nibs.length > 0) sections.push(createGroup('Nib Used', createTagList('nib', nibs)));
    if (papers.length > 0) sections.push(createGroup('Paper', createTagList('paper', papers)));

    container.innerHTML = sections.join('');

    if (previousScrollTop > 0) container.scrollTop = previousScrollTop;
}

function renderInks() {
    const grid = document.getElementById('inks-grid');
    if (!grid) return;
    grid.innerHTML = '';

    try {
        let inks = [...getLibraryInks()];

        // 1. Apply Filtering
        inks = inks.filter(ink => {
            // Apply Search Filter
            if (searchInksQuery) {
                const q = searchInksQuery.toLowerCase();
                const matchesSearch =
                    ink.name.toLowerCase().includes(q) ||
                    (ink.brand && ink.brand.toLowerCase().includes(q)) ||
                    (ink.line && ink.line.toLowerCase().includes(q)) ||
                    (ink.notes && ink.notes.toLowerCase().includes(q));

                if (!matchesSearch) return false;
            }

            if (activeInksFilters.brand.length > 0 && !activeInksFilters.brand.includes(ink.brand)) return false;
            if (activeInksFilters.line.length > 0 && !activeInksFilters.line.includes(ink.line)) return false;
            if (activeInksFilters.type.length > 0 && !activeInksFilters.type.includes(normalizeInkType(ink.type))) return false;
            if (activeInksFilters.permanence.length > 0 && !activeInksFilters.permanence.includes(ink.permanence)) return false;
            if (activeInksFilters.flow.length > 0 && !activeInksFilters.flow.includes(ink.flow)) return false;
            if (activeInksFilters.lubrication.length > 0 && !activeInksFilters.lubrication.includes(ink.lubrication)) return false;
            if (activeInksFilters.dryTime.length > 0 && !activeInksFilters.dryTime.includes(ink.dry_time)) return false;

            // Color Detection (Aggregated multi-tone)
            if (activeInksFilters.color.length > 0) {
                // Exact match for base color
                if (!activeInksFilters.color.includes(ink.color_base)) {
                    return false;
                }
            }

            if (activeInksFilters.volume && activeInksFilters.volume.length > 0) {
                const inkVolume = (ink.cl || '').toString().trim();
                if (!activeInksFilters.volume.includes(inkVolume)) return false;
            }

            if (activeInksFilters.properties.length > 0) {
                if (activeInksFilters.properties.includes('Shading') && (!ink.shading || ink.shading === 'None' || ink.shading === 'Low')) return false;
                if (activeInksFilters.properties.includes('Sheen') && (!ink.sheen || ink.sheen === 'None')) return false;
                if (activeInksFilters.properties.includes('Shimmer') && (!ink.shimmer || ink.shimmer === 'None')) return false;
            }

            if (activeInksFilters.baseType.length > 0) {
                const intersect = (ink.base_type || []).filter(bt => activeInksFilters.baseType.includes(bt));
                if (intersect.length === 0) return false;
            }

            if (activeInksFilters.paper.length > 0) {
                const intersect = (ink.paper_compatibility || []).filter(p => activeInksFilters.paper.includes(p));
                if (intersect.length === 0) return false;
            }

            return true;
        });

        // 2. Apply Sorting
        inks.sort((a, b) => {
            if (activeInksSort === 'name-asc') return a.name.localeCompare(b.name);
            if (activeInksSort === 'name-desc') return b.name.localeCompare(a.name);
            if (activeInksSort === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
            if (activeInksSort === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
            if (activeInksSort === 'newest') return b.id.localeCompare(a.id); // Assuming ID has timestamp
            if (activeInksSort === 'oldest') return a.id.localeCompare(b.id);
            return 0;
        });

        if (inks.length === 0) {
            grid.innerHTML = `<div class="empty-state">No matching inks found.</div>`;
            return;
        }

        inks.forEach(ink => {
            const card = document.createElement('div');
            card.className = 'inked-card glass-panel';
            card.style.cursor = 'pointer';
            card.onclick = () => {
                if (isManagerApp && shouldOpenCardsInEditMode()) {
                    openInkModal(ink.id);
                } else {
                    openSwatchDetailModal(ink.id, 'inks');
                }
            };

            // Consistently use gradient for list view
            const bgStyle = `background: linear-gradient(135deg, ${ink.color_base || '#ccc'}, ${ink.color_accent || ink.color_base || '#999'})`;

            const swatchCount = getSwatchesForInk(ink.id).length;
            const hasSwatch = swatchCount > 0
                ? `<span style="color: var(--color-text-muted); margin-left: auto; font-size: 12px; font-weight: 700;">${swatchCount}</span>`
                : '';
            const safeInkName = escapeHtml(ink.name || '');
            const safeInkBrand = escapeHtml(ink.brand || '');

            card.innerHTML = `
                <div class="ink-swatch-bg" style="${bgStyle}; height: 100px;"></div>
                <div class="card-content">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <div class="pen-name" style="font-size: 15px; font-weight: 600;">${safeInkName}</div>
                            <div class="pen-detail" style="font-size: 12px; color: var(--color-text-muted);">${safeInkBrand}</div>
                        </div>
                        ${hasSwatch}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error("Inks Render Failed:", e);
        grid.innerHTML = `<div style="color: red; padding: 20px;">Error rendering inks.</div>`;
    }
}

function renderSwatches() {
    const grid = document.getElementById('swatches-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let swatches = getAllSwatches()
        .map((swatch) => ({ swatch, ink: getInkById(swatch.ink_id) }))
        .filter((item) => item.ink && item.swatch && item.swatch.image);

    if (searchSwatchesQuery) {
        const q = searchSwatchesQuery.toLowerCase();
        swatches = swatches.filter(({ swatch, ink }) =>
            (ink.name || '').toLowerCase().includes(q) ||
            (ink.brand || '').toLowerCase().includes(q) ||
            (swatch.swatch_paper || '').toLowerCase().includes(q) ||
            (swatch.swatch_nib || '').toLowerCase().includes(q)
        );
    }

    swatches = swatches.filter(({ swatch, ink }) => {
        if (activeSwatchesFilters.brand.length > 0 && !activeSwatchesFilters.brand.includes(ink.brand)) return false;
        if (activeSwatchesFilters.type.length > 0 && !activeSwatchesFilters.type.includes(normalizeInkType(ink.type))) return false;
        if (activeSwatchesFilters.flow.length > 0 && !activeSwatchesFilters.flow.includes(ink.flow)) return false;
        if (activeSwatchesFilters.lubrication.length > 0 && !activeSwatchesFilters.lubrication.includes(ink.lubrication)) return false;
        if (activeSwatchesFilters.dryTime.length > 0 && !activeSwatchesFilters.dryTime.includes(ink.dry_time)) return false;
        if (activeSwatchesFilters.permanence.length > 0 && !activeSwatchesFilters.permanence.includes(ink.permanence)) return false;
        if (activeSwatchesFilters.color.length > 0 && !activeSwatchesFilters.color.includes(ink.color_base)) return false;
        if (activeSwatchesFilters.lighting.length > 0) {
            const swatchLighting = String((swatch && swatch.swatch_lighting) || 'Unknown').trim() || 'Unknown';
            if (!activeSwatchesFilters.lighting.includes(swatchLighting)) return false;
        }
        if (activeSwatchesFilters.nib.length > 0) {
            const swatchNibs = normalizeCsvValues((swatch && swatch.swatch_nib) || '');
            if (!activeSwatchesFilters.nib.some((nib) => swatchNibs.includes(nib))) return false;
        }
        if (activeSwatchesFilters.paper.length > 0) {
            const swatchPapers = normalizeCsvValues((swatch && swatch.swatch_paper) || '');
            if (!activeSwatchesFilters.paper.some((paper) => swatchPapers.includes(paper))) return false;
        }

        if (activeSwatchesFilters.baseType.length > 0) {
            const inkBaseTypes = ink.base_type || [];
            if (!activeSwatchesFilters.baseType.some(bt => inkBaseTypes.includes(bt))) return false;
        }
        return true;
    });

    swatches.sort((a, b) => {
        if (activeSwatchesSort === 'name-asc') return (a.ink.name || '').localeCompare(b.ink.name || '');
        if (activeSwatchesSort === 'name-desc') return (b.ink.name || '').localeCompare(a.ink.name || '');
        if (activeSwatchesSort === 'brand-asc') return (a.ink.brand || '').localeCompare(b.ink.brand || '');
        if (activeSwatchesSort === 'brand-desc') return (b.ink.brand || '').localeCompare(a.ink.brand || '');
        if (activeSwatchesSort === 'newest') return getSwatchTimestamp(b.swatch) - getSwatchTimestamp(a.swatch);
        if (activeSwatchesSort === 'oldest') return getSwatchTimestamp(a.swatch) - getSwatchTimestamp(b.swatch);
        return 0;
    });

    if (swatches.length === 0) {
        grid.innerHTML = `<div class="empty-state">No swatches found.</div>`;
        return;
    }

    swatches.forEach(({ swatch, ink }) => {
        const card = document.createElement('div');
        card.className = 'inked-card glass-panel';
        card.style.cursor = 'pointer';
        card.onclick = () => {
            if (isManagerApp && shouldOpenCardsInEditMode()) {
                openEditSwatchModal(swatch.id);
            } else {
                openSwatchDetailModal(swatch.id, 'swatches');
            }
        };

        const imagePath = resolveImageSource(swatch.image);
        const safeInkName = escapeHtml(ink.name || '');
        const safeInkBrand = escapeHtml(ink.brand || '');
        const safeSwatchNib = swatch.swatch_nib ? escapeHtml(swatch.swatch_nib) : '';

        card.innerHTML = `
            <div class="ink-swatch-bg" style="height: 150px; background-size: cover; background-position: center;"></div>
            <div class="card-content">
                <div class="pen-name" style="font-weight: 600;">${safeInkName}</div>
                <div class="pen-detail" style="font-size: 12px; color: var(--color-text-muted);">${safeInkBrand}${safeSwatchNib ? ` • ${safeSwatchNib}` : ''}</div>
            </div>
        `;
        const swatchVisual = card.querySelector('.ink-swatch-bg');
        if (swatchVisual) swatchVisual.style.backgroundImage = `url(${JSON.stringify(imagePath)})`;
        grid.appendChild(card);
    });
}

function isModalVisible(modalEl) {
    return !!(modalEl && getComputedStyle(modalEl).display !== 'none');
}

window.addEventListener('resize', () => {
    if (isDetailImageLightboxOpen()) {
        requestAnimationFrame(fitDetailImageLightboxToViewport);
    }
    if (isModalVisible(modalSwatchDetail)) {
        requestAnimationFrame(updateInkDetailMetadataLayout);
    }
});

function getFilteredSortedPensForDetails() {
    let pens = [...(appData.pens || [])];

    if (searchPensQuery) {
        const q = searchPensQuery.toLowerCase();
        pens = pens.filter(p =>
            p.model.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            (p.nib && p.nib.toLowerCase().includes(q)) ||
            (p.material && p.material.toLowerCase().includes(q)) ||
            (p.notes && p.notes.toLowerCase().includes(q))
        );
    }

    pens = pens.filter(pen => {
        if (activePensFilters.brand.length > 0 && !activePensFilters.brand.includes(pen.brand)) return false;
        if (activePensFilters.nib.length > 0 && !activePensFilters.nib.includes(pen.nib)) return false;
        if (activePensFilters.nib_material.length > 0 && !activePensFilters.nib_material.includes(pen.nib_material)) return false;
        if (activePensFilters.material.length > 0 && !activePensFilters.material.includes(pen.material)) return false;
        if (!valueMatchesFilter(pen.filling_system, activePensFilters.filling_system)) return false;
        if (!valueMatchesFilter(pen.color, activePensFilters.color)) return false;

        if (activePensFilters.status.length > 0) {
            const isInked = (appData.currently_inked || []).some(i => i.pen_id === pen.id);
            const status = isInked ? 'Inked' : 'Resting';
            if (!activePensFilters.status.includes(status)) return false;
        }
        return true;
    });

    pens.sort((a, b) => {
        if (activePensSort === 'model-asc') return a.model.localeCompare(b.model);
        if (activePensSort === 'model-desc') return b.model.localeCompare(a.model);
        if (activePensSort === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
        if (activePensSort === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
        if (activePensSort === 'newest') return b.id.localeCompare(a.id);
        if (activePensSort === 'oldest') return a.id.localeCompare(b.id);
        return 0;
    });

    return pens;
}

function getFilteredSortedInksForDetails() {
    let inks = [...getLibraryInks()];

    inks = inks.filter(ink => {
        if (searchInksQuery) {
            const q = searchInksQuery.toLowerCase();
            const matchesSearch =
                ink.name.toLowerCase().includes(q) ||
                (ink.brand && ink.brand.toLowerCase().includes(q)) ||
                (ink.line && ink.line.toLowerCase().includes(q)) ||
                (ink.notes && ink.notes.toLowerCase().includes(q));
            if (!matchesSearch) return false;
        }

        if (activeInksFilters.brand.length > 0 && !activeInksFilters.brand.includes(ink.brand)) return false;
        if (activeInksFilters.line.length > 0 && !activeInksFilters.line.includes(ink.line)) return false;
        if (activeInksFilters.type.length > 0 && !activeInksFilters.type.includes(normalizeInkType(ink.type))) return false;
        if (activeInksFilters.permanence.length > 0 && !activeInksFilters.permanence.includes(ink.permanence)) return false;
        if (activeInksFilters.flow.length > 0 && !activeInksFilters.flow.includes(ink.flow)) return false;
        if (activeInksFilters.lubrication.length > 0 && !activeInksFilters.lubrication.includes(ink.lubrication)) return false;
        if (activeInksFilters.dryTime.length > 0 && !activeInksFilters.dryTime.includes(ink.dry_time)) return false;
        if (activeInksFilters.color.length > 0 && !activeInksFilters.color.includes(ink.color_base)) return false;

        if (activeInksFilters.volume && activeInksFilters.volume.length > 0) {
            const inkVolume = (ink.cl || '').toString().trim();
            if (!activeInksFilters.volume.includes(inkVolume)) return false;
        }

        if (activeInksFilters.properties.length > 0) {
            if (activeInksFilters.properties.includes('Shading') && (!ink.shading || ink.shading === 'None' || ink.shading === 'Low')) return false;
            if (activeInksFilters.properties.includes('Sheen') && (!ink.sheen || ink.sheen === 'None')) return false;
            if (activeInksFilters.properties.includes('Shimmer') && (!ink.shimmer || ink.shimmer === 'None')) return false;
        }

        if (activeInksFilters.baseType.length > 0) {
            const intersect = (ink.base_type || []).filter(bt => activeInksFilters.baseType.includes(bt));
            if (intersect.length === 0) return false;
        }

        if (activeInksFilters.paper.length > 0) {
            const intersect = (ink.paper_compatibility || []).filter(p => activeInksFilters.paper.includes(p));
            if (intersect.length === 0) return false;
        }

        return true;
    });

    inks.sort((a, b) => {
        if (activeInksSort === 'name-asc') return a.name.localeCompare(b.name);
        if (activeInksSort === 'name-desc') return b.name.localeCompare(a.name);
        if (activeInksSort === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
        if (activeInksSort === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
        if (activeInksSort === 'newest') return b.id.localeCompare(a.id);
        if (activeInksSort === 'oldest') return a.id.localeCompare(b.id);
        return 0;
    });

    return inks;
}

function getFilteredSortedSwatchesForDetails() {
    let swatches = getAllSwatches()
        .map((swatch) => ({ swatch, ink: getInkById(swatch.ink_id) }))
        .filter((item) => item.ink && item.swatch && item.swatch.image);

    if (searchSwatchesQuery) {
        const q = searchSwatchesQuery.toLowerCase();
        swatches = swatches.filter(({ swatch, ink }) =>
            (ink.name || '').toLowerCase().includes(q) ||
            (ink.brand || '').toLowerCase().includes(q) ||
            (swatch.swatch_paper || '').toLowerCase().includes(q) ||
            (swatch.swatch_nib || '').toLowerCase().includes(q)
        );
    }

    swatches = swatches.filter(({ swatch, ink }) => {
        if (activeSwatchesFilters.brand.length > 0 && !activeSwatchesFilters.brand.includes(ink.brand)) return false;
        if (activeSwatchesFilters.type.length > 0 && !activeSwatchesFilters.type.includes(normalizeInkType(ink.type))) return false;
        if (activeSwatchesFilters.flow.length > 0 && !activeSwatchesFilters.flow.includes(ink.flow)) return false;
        if (activeSwatchesFilters.lubrication.length > 0 && !activeSwatchesFilters.lubrication.includes(ink.lubrication)) return false;
        if (activeSwatchesFilters.dryTime.length > 0 && !activeSwatchesFilters.dryTime.includes(ink.dry_time)) return false;
        if (activeSwatchesFilters.permanence.length > 0 && !activeSwatchesFilters.permanence.includes(ink.permanence)) return false;
        if (activeSwatchesFilters.color.length > 0 && !activeSwatchesFilters.color.includes(ink.color_base)) return false;
        if (activeSwatchesFilters.lighting.length > 0) {
            const swatchLighting = String((swatch && swatch.swatch_lighting) || 'Unknown').trim() || 'Unknown';
            if (!activeSwatchesFilters.lighting.includes(swatchLighting)) return false;
        }
        if (activeSwatchesFilters.nib.length > 0) {
            const swatchNibs = normalizeCsvValues((swatch && swatch.swatch_nib) || '');
            if (!activeSwatchesFilters.nib.some((nib) => swatchNibs.includes(nib))) return false;
        }
        if (activeSwatchesFilters.paper.length > 0) {
            const swatchPapers = normalizeCsvValues((swatch && swatch.swatch_paper) || '');
            if (!activeSwatchesFilters.paper.some((paper) => swatchPapers.includes(paper))) return false;
        }
        if (activeSwatchesFilters.baseType.length > 0) {
            const inkBaseTypes = ink.base_type || [];
            if (!activeSwatchesFilters.baseType.some(bt => inkBaseTypes.includes(bt))) return false;
        }
        return true;
    });

    swatches.sort((a, b) => {
        if (activeSwatchesSort === 'name-asc') return (a.ink.name || '').localeCompare(b.ink.name || '');
        if (activeSwatchesSort === 'name-desc') return (b.ink.name || '').localeCompare(a.ink.name || '');
        if (activeSwatchesSort === 'brand-asc') return (a.ink.brand || '').localeCompare(b.ink.brand || '');
        if (activeSwatchesSort === 'brand-desc') return (b.ink.brand || '').localeCompare(a.ink.brand || '');
        if (activeSwatchesSort === 'newest') return getSwatchTimestamp(b.swatch) - getSwatchTimestamp(a.swatch);
        if (activeSwatchesSort === 'oldest') return getSwatchTimestamp(a.swatch) - getSwatchTimestamp(b.swatch);
        return 0;
    });

    return swatches.map((item) => item.swatch);
}

function navigateDetailModal(step) {
    if (isModalVisible(modalPenDetail) && currentPenDetailPenId) {
        const pens = getFilteredSortedPensForDetails();
        const ids = pens.map(p => p.id);
        const currentIndex = ids.indexOf(currentPenDetailPenId);
        if (currentIndex >= 0 && ids.length > 1) {
            const nextIndex = currentIndex + step;
            if (nextIndex < 0 || nextIndex >= ids.length) return;
            openPenDetailModal(ids[nextIndex], currentPenDetailSourceView || 'pens');
        }
        return;
    }

    if (isModalVisible(modalSwatchDetail) && currentSwatchDetailInkId) {
        const source = currentSwatchDetailSourceView || 'swatches';
        const items = source === 'inks' ? getFilteredSortedInksForDetails() : getFilteredSortedSwatchesForDetails();
        const ids = items.map(i => i.id);
        const currentIndex = ids.indexOf(currentSwatchDetailInkId);
        if (currentIndex >= 0 && ids.length > 1) {
            const nextIndex = currentIndex + step;
            if (nextIndex < 0 || nextIndex >= ids.length) return;
            openSwatchDetailModal(ids[nextIndex], source);
        }
    }
}

// (No content needed here, listeners moved up)


// Event Listeners for Filters/Sort (Inks)
function closeAllFilterSidebars() {
    [
        document.getElementById('filter-sidebar'),
        document.getElementById('filter-sidebar-pens'),
        document.getElementById('filter-sidebar-swatches')
    ].forEach((sidebar) => {
        if (!sidebar || !sidebar.classList.contains('active')) return;
        sidebar.classList.remove('active');
        setTimeout(() => {
            sidebar.style.display = 'none';
        }, 400);
    });
}

document.getElementById('btn-sort-inks')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllFilterSidebars();
    const dropdown = document.getElementById('sort-dropdown');
    if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.sort-option').forEach(btn => {
    btn.addEventListener('click', () => {
        activeInksSort = btn.dataset.sort;
        document.querySelectorAll('.sort-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('sort-dropdown').style.display = 'none';
        renderInks();
    });
});

// Event Listeners for Filters/Sort (Pens)
document.getElementById('btn-sort-pens')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllFilterSidebars();
    const dropdown = document.getElementById('sort-dropdown-pens');
    if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.sort-option-pens').forEach(btn => {
    btn.addEventListener('click', () => {
        activePensSort = btn.dataset.sort;
        document.querySelectorAll('.sort-option-pens').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('sort-dropdown-pens').style.display = 'none';
        renderPens();
    });
});

// Event Listeners for Filters/Sort (Swatches)
document.getElementById('btn-sort-swatches')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllFilterSidebars();
    const dropdown = document.getElementById('sort-dropdown-swatches');
    if (dropdown) dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.querySelectorAll('.sort-option-swatches').forEach(btn => {
    btn.addEventListener('click', () => {
        activeSwatchesSort = btn.dataset.sort;
        document.querySelectorAll('.sort-option-swatches').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('sort-dropdown-swatches').style.display = 'none';
        renderSwatches();
    });
});

document.getElementById('btn-filter-swatches')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar-swatches');
    if (sidebar) {
        sidebar.style.display = 'flex';
        setTimeout(() => sidebar.classList.add('active'), 10);
        renderSwatchFilters();
    }
});

document.getElementById('close-filters-swatches')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar-swatches');
    if (sidebar) {
        sidebar.classList.remove('active');
        setTimeout(() => sidebar.style.display = 'none', 400);
    }
});

document.getElementById('reset-filters-swatches')?.addEventListener('click', () => {
    activeSwatchesFilters = {
        brand: [], type: [], color: [], flow: [],
        lubrication: [], dryTime: [], baseType: [], permanence: [],
        lighting: [],
        nib: [], paper: []
    };
    renderSwatchFilters();
    renderSwatches();
});

document.getElementById('btn-filter-inks')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar');
    if (sidebar) {
        sidebar.style.display = 'flex';
        setTimeout(() => sidebar.classList.add('active'), 10);
        renderFilters();
    }
});

document.getElementById('close-filters')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar');
    if (sidebar) {
        sidebar.classList.remove('active');
        setTimeout(() => sidebar.style.display = 'none', 400);
    }
});

document.getElementById('btn-filter-pens')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar-pens');
    if (sidebar) {
        sidebar.style.display = 'flex';
        setTimeout(() => sidebar.classList.add('active'), 10);
        renderPenFilters();
    }
});

document.getElementById('close-filters-pens')?.addEventListener('click', () => {
    const sidebar = document.getElementById('filter-sidebar-pens');
    if (sidebar) {
        sidebar.classList.remove('active');
        setTimeout(() => sidebar.style.display = 'none', 400);
    }
});

// Apply logic removed - now dynamic

document.getElementById('reset-filters')?.addEventListener('click', () => {
    activeInksFilters = {
        brand: [], line: [], type: [], color: [],
        properties: [], flow: [], lubrication: [], dryTime: [],
        baseType: [], permanence: [],
        paper: [], volume: []
    };
    renderFilters();
    renderInks();
});

document.getElementById('reset-filters-pens')?.addEventListener('click', () => {
    activePensFilters = {
        brand: [], nib: [], nib_material: [], material: [],
        filling_system: [], color: [], status: []
    };
    renderPenFilters();
    renderPens();
});

function attachFilterTagDelegation(containerId, toggleHandler) {
    document.getElementById(containerId)?.addEventListener('click', (event) => {
        const tag = event.target.closest('[data-filter-category][data-filter-value]');
        if (!tag) return;
        event.preventDefault();
        toggleHandler(tag.dataset.filterCategory, tag.dataset.filterValue);
    });
}

attachFilterTagDelegation('pen-filter-options-container', togglePenFilterTag);
attachFilterTagDelegation('filter-options-container', toggleFilterTag);
attachFilterTagDelegation('swatch-filter-options-container', toggleSwatchFilterTag);

document.addEventListener('click', (e) => {
    const dropdownInk = document.getElementById('sort-dropdown');
    if (dropdownInk) dropdownInk.style.display = 'none';
    const dropdownPen = document.getElementById('sort-dropdown-pens');
    if (dropdownPen) dropdownPen.style.display = 'none';
    const dropdownSwatch = document.getElementById('sort-dropdown-swatches');
    if (dropdownSwatch) dropdownSwatch.style.display = 'none';

    // If target was removed from DOM (e.g. by re-render), ignore it
    if (!document.body.contains(e.target)) return;

    // Ink Filters Sidebar
    const sidebarInks = document.getElementById('filter-sidebar');
    const btnInks = document.getElementById('btn-filter-inks');
    if (sidebarInks && sidebarInks.classList.contains('active') && !sidebarInks.contains(e.target) && !btnInks.contains(e.target)) {
        sidebarInks.classList.remove('active');
        setTimeout(() => sidebarInks.style.display = 'none', 400);
    }

    // Pen Filters Sidebar
    const sidebarPens = document.getElementById('filter-sidebar-pens');
    const btnPens = document.getElementById('btn-filter-pens');
    if (sidebarPens && sidebarPens.classList.contains('active') && !sidebarPens.contains(e.target) && !btnPens.contains(e.target)) {
        sidebarPens.classList.remove('active');
        setTimeout(() => sidebarPens.style.display = 'none', 400);
    }

    // Swatch Filters Sidebar
    const sidebarSwatches = document.getElementById('filter-sidebar-swatches');
    const btnSwatches = document.getElementById('btn-filter-swatches');
    if (sidebarSwatches && sidebarSwatches.classList.contains('active') && !sidebarSwatches.contains(e.target) && !btnSwatches.contains(e.target)) {
        sidebarSwatches.classList.remove('active');
        setTimeout(() => sidebarSwatches.style.display = 'none', 400);
    }
});

// Search Event Listeners
document.getElementById('search-pens')?.addEventListener('input', (e) => {
    searchPensQuery = e.target.value;
    renderPens();
});

document.getElementById('search-inks')?.addEventListener('input', (e) => {
    searchInksQuery = e.target.value;
    renderInks();
});

document.getElementById('search-swatches')?.addEventListener('input', (e) => {
    searchSwatchesQuery = e.target.value;
    renderSwatches();
});

// Start
init();

// --- Utilities ---

function updatePenPreviewStyle(rotation) {
    if (!uploadPenPreview) return;
    const isRotated = rotation === 90 || rotation === 270;
    if (isRotated) {
        uploadPenPreview.className = 'pen-photo-rotated-contain';
        uploadPenPreview.style.transform = '';
        uploadPenPreview.style.width = ''; // Let CSS handle via variables
        uploadPenPreview.style.height = '';
        uploadPenPreview.style.top = '';
        uploadPenPreview.style.left = '';
        uploadPenPreview.style.setProperty('--rot', `${rotation}deg`);
        uploadPenPreview.style.setProperty('--p-width', '100cqh');
        uploadPenPreview.style.setProperty('--p-height', '100cqw');
    } else {
        uploadPenPreview.className = '';
        uploadPenPreview.style.transform = `rotate(${rotation}deg)`;
        uploadPenPreview.style.width = '100%';
        uploadPenPreview.style.height = '100%';
        uploadPenPreview.style.top = '0';
        uploadPenPreview.style.left = '0';
        // Reset variables just in case
        uploadPenPreview.style.removeProperty('--rot');
        uploadPenPreview.style.removeProperty('--p-width');
        uploadPenPreview.style.removeProperty('--p-height');
    }
}

function extractInkColors(imgElement) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;

        if (canvas.width === 0 || canvas.height === 0) return null;

        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        // Sampling rate for performance
        const step = 10;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        const colorMap = {};
        let maxCount = 0;
        let dominantRGB = null;

        for (let i = 0; i < imageData.length; i += 4 * step) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];

            if (a < 200) continue; // Ignore transparent/semi-transparent

            // --- Paper Filtering ---
            // Convert to HSL for better paper detection
            // HSL conversion simplified
            const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
            const max = Math.max(rNorm, gNorm, bNorm);
            const min = Math.min(rNorm, gNorm, bNorm);
            const l = (max + min) / 2;

            let s = 0;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            }

            // FILTER RULES:
            // 1. Too bright (Lightness > 0.93) -> Likely white paper
            // 2. Bright & Low Saturation (L > 0.85 && S < 0.15) -> Likely ivory/cream/grey paper
            if (l > 0.93) continue;
            if (l > 0.85 && s < 0.20) continue;

            // Quantize colors to group similar shades (bucket size 20)
            const q = 20;
            const rQ = Math.round(r / q) * q;
            const gQ = Math.round(g / q) * q;
            const bQ = Math.round(b / q) * q;

            const key = `${rQ},${gQ},${bQ}`;
            colorMap[key] = (colorMap[key] || 0) + 1;

            if (colorMap[key] > maxCount) {
                maxCount = colorMap[key];
                dominantRGB = { r: rQ, g: gQ, b: bQ };
            }
        }

        if (!dominantRGB) return null; // Couldn't find any non-paper colors

        // Helper: RGB to Hex
        const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, x)).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');

        const baseColor = rgbToHex(dominantRGB.r, dominantRGB.g, dominantRGB.b);

        // For accent, let's just make a complementary or darker variation for now
        // Or find the second most popular bucket that is distinct?
        // Let's create a simpler accent by tweaking the base
        // Darker version for contrast
        const darken = (val) => Math.round(val * 0.7);
        const accentColor = rgbToHex(darken(dominantRGB.r), darken(dominantRGB.g), darken(dominantRGB.b));

        return { base: baseColor, accent: accentColor };

    } catch (e) {
        console.error("Color extraction failed:", e);
        return null;
    }
}

function updateAutocompleteLists() {
    // Helper to get unique values
    const getUnique = (arr, key) => {
        if (!arr) return [];
        return [...new Set(arr.map(item => item[key]).filter(val => val && val.trim() !== ""))].sort();
    };
    const getUniqueCsv = (arr, key) => collectUniqueFromCsv(arr, key);
    const libraryInks = getLibraryInks();

    // Update global data object
    autocompleteData['ink-brand-input'] = getUnique(libraryInks, 'brand');
    autocompleteData['ink-name-input'] = getUnique(libraryInks, 'name');
    autocompleteData['ink-line-input'] = getUnique(libraryInks, 'line');
    autocompleteData['ink-cl-input'] = getUnique(libraryInks, 'cl');
    autocompleteData['ink-dry-time'] = getUnique(libraryInks, 'dry_time');

    autocompleteData['pen-brand-input'] = getUnique(appData.pens, 'brand');
    autocompleteData['pen-model-input'] = getUnique(appData.pens, 'model');
    autocompleteData['pen-nib-input'] = getUnique(appData.pens, 'nib');
    autocompleteData['pen-nib-material-input'] = getUnique(appData.pens, 'nib_material');
    autocompleteData['pen-material-input'] = getUniqueCsv(appData.pens, 'material');
    autocompleteData['pen-filling-system-input'] = getUniqueCsv(appData.pens, 'filling_system');
    autocompleteData['pen-color-input'] = getUniqueCsv(appData.pens, 'color');
}

function extractPenColors(imgElement) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const maxSide = 320;
        const scale = Math.min(1, maxSide / Math.max(imgElement.naturalWidth || 1, imgElement.naturalHeight || 1));
        canvas.width = Math.max(1, Math.round((imgElement.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((imgElement.naturalHeight || 1) * scale));
        if (canvas.width < 10 || canvas.height < 10) return null;

        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const idx = (x, y) => (y * width + x) * 4;
        const total = width * height;

        const borderSamples = [];
        const borderStep = Math.max(1, Math.floor(Math.min(width, height) / 60));
        for (let x = 0; x < width; x += borderStep) {
            const iTop = idx(x, 0);
            const iBottom = idx(x, height - 1);
            borderSamples.push([data[iTop], data[iTop + 1], data[iTop + 2]]);
            borderSamples.push([data[iBottom], data[iBottom + 1], data[iBottom + 2]]);
        }
        for (let y = 0; y < height; y += borderStep) {
            const iLeft = idx(0, y);
            const iRight = idx(width - 1, y);
            borderSamples.push([data[iLeft], data[iLeft + 1], data[iLeft + 2]]);
            borderSamples.push([data[iRight], data[iRight + 1], data[iRight + 2]]);
        }
        if (borderSamples.length < 8) return null;

        const sortNum = (a, b) => a - b;
        const getMedian = (arr) => {
            const sorted = [...arr].sort(sortNum);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
        };
        const bgR = getMedian(borderSamples.map(s => s[0]));
        const bgG = getMedian(borderSamples.map(s => s[1]));
        const bgB = getMedian(borderSamples.map(s => s[2]));

        const mask = new Uint8Array(total);
        const bgDistThreshold = 26;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const base = idx(x, y);
                const a = data[base + 3];
                if (a < 220) continue;

                const r = data[base];
                const g = data[base + 1];
                const b = data[base + 2];

                const dr = r - bgR;
                const dg = g - bgG;
                const db = b - bgB;
                const bgDist = Math.sqrt(dr * dr + dg * dg + db * db);

                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const sat = max === 0 ? 0 : (max - min) / max;
                const light = (max + min) / 510;

                // Keep likely foreground: distant from border background or sufficiently saturated.
                if (bgDist < bgDistThreshold && sat < 0.16) continue;
                if (light > 0.97) continue;

                mask[y * width + x] = 1;
            }
        }

        // Denoise and close tiny gaps.
        const refined = new Uint8Array(total);
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                let count = 0;
                for (let oy = -1; oy <= 1; oy += 1) {
                    for (let ox = -1; ox <= 1; ox += 1) {
                        count += mask[(y + oy) * width + (x + ox)];
                    }
                }
                const current = mask[y * width + x];
                refined[y * width + x] = current ? (count >= 3 ? 1 : 0) : (count >= 6 ? 1 : 0);
            }
        }

        // Connected components and pen-shape scoring.
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        const components = [];
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const start = y * width + x;
                if (!refined[start] || visited[start]) continue;

                let qh = 0;
                let qt = 0;
                queue[qt++] = start;
                visited[start] = 1;

                let area = 0;
                let minX = x, maxX = x, minY = y, maxY = y;
                let sumX = 0, sumY = 0;
                const points = [];

                while (qh < qt) {
                    const p = queue[qh++];
                    const px = p % width;
                    const py = (p / width) | 0;

                    area += 1;
                    sumX += px;
                    sumY += py;
                    points.push(p);
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;

                    for (const [dx, dy] of neighbors) {
                        const nx = px + dx;
                        const ny = py + dy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const np = ny * width + nx;
                        if (!refined[np] || visited[np]) continue;
                        visited[np] = 1;
                        queue[qt++] = np;
                    }
                }

                const bw = maxX - minX + 1;
                const bh = maxY - minY + 1;
                const major = Math.max(bw, bh);
                const minor = Math.max(1, Math.min(bw, bh));
                const elongation = major / minor;
                const fillRatio = area / Math.max(1, bw * bh);
                const areaNorm = area / total;
                const minorNorm = minor / Math.min(width, height);
                const cx = sumX / area;
                const cy = sumY / area;
                const centerDist = Math.hypot(cx - width / 2, cy - height / 2);
                const centerNorm = centerDist / Math.hypot(width / 2, height / 2);
                const centerScore = Math.max(0, 1 - centerNorm);

                // Prefer pen-like components: elongated, not too filled (unlike rectangular holders),
                // moderate area, centered, and not too thick.
                const areaScore = Math.exp(-Math.pow((areaNorm - 0.08) / 0.11, 2));
                const thickPenalty = Math.exp(-Math.pow((minorNorm - 0.14) / 0.10, 2));
                const fillPenalty = Math.exp(-Math.pow((fillRatio - 0.45) / 0.30, 2));
                const elongScore = Math.min(3.5, Math.max(1, elongation));

                const score = centerScore * areaScore * thickPenalty * fillPenalty * elongScore;
                components.push({ score, areaNorm, points });
            }
        }

        if (components.length === 0) return null;
        components.sort((a, b) => b.score - a.score);

        // Keep only plausible size components; then take best by score.
        let chosen = components.find(c => c.areaNorm > 0.01 && c.areaNorm < 0.45);
        if (!chosen) chosen = components[0];
        if (!chosen || chosen.points.length < 30) return null;

        const colorMap = Object.create(null);
        let dominant = null;
        let maxWeight = 0;
        const q = 16;

        for (let i = 0; i < chosen.points.length; i += 1) {
            const p = chosen.points[i];
            const base = p * 4;
            const r = data[base];
            const g = data[base + 1];
            const b = data[base + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const weight = 0.8 + sat * 1.4;

            const rQ = Math.round(r / q) * q;
            const gQ = Math.round(g / q) * q;
            const bQ = Math.round(b / q) * q;
            const key = `${rQ},${gQ},${bQ}`;
            const c = (colorMap[key] || 0) + weight;
            colorMap[key] = c;
            if (c > maxWeight) {
                maxWeight = c;
                dominant = { r: rQ, g: gQ, b: bQ };
            }
        }
        if (!dominant) return null;

        const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, x)).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');

        const entries = Object.keys(colorMap).map((key) => {
            const [r, g, b] = key.split(',').map(Number);
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            return { key, r, g, b, sat, count: colorMap[key] };
        }).sort((a, b) => b.count - a.count);

        const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
        let accent = entries.find(e => dist(e, dominant) > 32 && e.sat > 0.1);
        if (!accent) {
            accent = entries.find(e => dist(e, dominant) > 26);
        }
        if (!accent) {
            accent = {
                r: Math.max(0, Math.round(dominant.r * 0.72)),
                g: Math.max(0, Math.round(dominant.g * 0.72)),
                b: Math.max(0, Math.round(dominant.b * 0.72))
            };
        }

        const baseHex = rgbToHex(dominant.r, dominant.g, dominant.b);
        const accentHex = rgbToHex(accent.r, accent.g, accent.b);
        return {
            base: baseHex,
            accent: accentHex
        };
    } catch (e) {
        console.error("Pen color extraction failed:", e);
        return null;
    }
}

// Custom Control Logic
function setupCustomControls() {
    enhanceSettingsCustomSelects();
    enhanceActivityCustomSelects();

    // 1. Custom Selects
    document.querySelectorAll('.custom-select-trigger').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close other custom selects
            document.querySelectorAll('.custom-options').forEach(opt => {
                if (opt !== trigger.nextElementSibling) opt.classList.remove('show');
            });
            document.querySelectorAll('.custom-select-trigger').forEach(t => {
                if (t !== trigger) t.classList.remove('open');
            });

            // Close Multiselects
            document.querySelectorAll('.multiselect-dropdown.open').forEach(el => {
                el.classList.remove('open');
                const opts = el.querySelector('.multiselect-options');
                if (opts) opts.classList.remove('show');
            });

            trigger.classList.toggle('open');
            const options = trigger.nextElementSibling;
            if (options) options.classList.toggle('show');
        });
    });

    // Initialize Options CLICK
    document.querySelectorAll('.custom-options').forEach(optionsContainer => {
        setupCustomSelectOptions(optionsContainer);
    });

    // 2. Autocomplete Inputs
    const csvAutocompleteIds = new Set(['pen-material-input', 'pen-filling-system-input', 'pen-color-input']);
    document.querySelectorAll('.autocomplete-input').forEach(input => {
        const wrapper = input.parentElement;
        const list = wrapper.querySelector('.custom-options');

        if (!list) return;

        input.addEventListener('input', () => {
            const rawVal = input.value;
            const val = rawVal.toLowerCase().trim();
            const id = input.id; // e.g., ink-brand-input
            const data = autocompleteData[id] || [];
            const isCsvAutocomplete = csvAutocompleteIds.has(id);
            const currentTokenRaw = isCsvAutocomplete ? rawVal.split(',').pop() : rawVal;
            const token = (currentTokenRaw || '').trim().toLowerCase();

            if (!val || (isCsvAutocomplete && !token)) {
                list.classList.remove('show');
                return;
            }

            // Fuzzy Filter Logic: StartsWith Prio -> Includes
            const needle = isCsvAutocomplete ? token : val;
            const startsWith = data.filter(item => item.toLowerCase().startsWith(needle));
            const includes = data.filter(item => !item.toLowerCase().startsWith(needle) && item.toLowerCase().includes(needle));
            const matches = [...startsWith, ...includes];

            if (matches.length > 0) {
                list.innerHTML = matches.map(item => `<div class="custom-option">${escapeHtml(item)}</div>`).join('');
                list.classList.add('show');

                // Re-bind option clicks for new elements
                list.querySelectorAll('.custom-option').forEach(opt => {
                    opt.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (isCsvAutocomplete) {
                            const parts = input.value.split(',').map(p => p.trim()).filter(Boolean);
                            if (parts.length > 0) parts.pop();
                            parts.push(opt.textContent.trim());
                            input.value = parts.join(', ');
                        } else {
                            input.value = opt.textContent;
                        }
                        list.classList.remove('show');
                    });
                });
            } else {
                list.classList.remove('show');
            }
        });

        input.addEventListener('keydown', (e) => {
            if (!list.classList.contains('show')) return;

            const options = list.querySelectorAll('.custom-option');
            let selectedIndex = Array.from(options).findIndex(opt => opt.classList.contains('selected'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % options.length;
                updateSelection(options, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + options.length) % options.length;
                updateSelection(options, selectedIndex);
            } else if (e.key === 'Enter') {
                if (selectedIndex >= 0) {
                    e.preventDefault(); // Only prevent default if we actually selected something
                    e.stopPropagation(); // Stop propagation to prevent form submission logic
                    options[selectedIndex].click();
                }
                // If nothing selected, let event propagate (might save form)
            } else if (e.key === 'Escape') {
                list.classList.remove('show');
            }
        });

        function updateSelection(options, index) {
            options.forEach(opt => opt.classList.remove('selected'));
            if (options[index]) {
                options[index].classList.add('selected');
                options[index].scrollIntoView({ block: 'nearest' });
            }
        }

        // Hide on focus out
        input.addEventListener('blur', () => {
            // Delay to allow click events on the options to fire first
            setTimeout(() => {
                list.classList.remove('show');
            }, 200);
        });

        // Close on click outside is handled globally below
    });

    // Global Close
    document.addEventListener('click', (e) => {
        // Close custom selects when clicking outside any custom-select wrapper.
        // This allows clicks into text/autocomplete fields to dismiss open select menus.
        if (!e.target.closest('.custom-select-wrapper-outer')) {
            document.querySelectorAll('.custom-select-wrapper-outer .custom-options.show').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.custom-select-trigger.open').forEach(el => el.classList.remove('open'));
        }

        // Close autocomplete suggestion lists only when clicking outside autocomplete wrappers.
        if (!e.target.closest('.custom-autocomplete-wrapper')) {
            document.querySelectorAll('.custom-autocomplete-wrapper .custom-options.show').forEach(el => el.classList.remove('show'));
        }

        // Close Multiselects (Legacy dropdowns, if any)
        if (!e.target.closest('.multiselect-dropdown')) {
            document.querySelectorAll('.multiselect-dropdown.open').forEach(el => {
                el.classList.remove('open');
                const opts = el.querySelector('.multiselect-options');
                if (opts) opts.classList.remove('show');
            });
        }
    });

    setupPopoverMultiselects();
}

function setupPopoverMultiselects() {
    // Find all popover trigger buttons for multiselects using native Popover API
    const triggers = document.querySelectorAll('.multiselect-header[popovertarget]');

    triggers.forEach(trigger => {
        const popoverId = trigger.getAttribute('popovertarget');
        const popover = document.getElementById(popoverId);
        if (!popover) return;

        const placeholder = trigger.querySelector('.placeholder');
        // Store default text if not already stored
        if (placeholder && !placeholder.dataset.default) {
            placeholder.dataset.default = placeholder.textContent;
        }
        const defaultText = placeholder ? placeholder.dataset.default : '';

        const updateText = () => {
            const checkboxes = popover.querySelectorAll('input[type="checkbox"]');
            const selected = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.parentElement.textContent.trim());

            if (selected.length > 0) {
                if (placeholder) {
                    placeholder.textContent = selected.join(', ');
                    placeholder.classList.add('has-value');
                }
            } else {
                if (placeholder) {
                    placeholder.textContent = defaultText;
                    placeholder.classList.remove('has-value');
                }
            }
        };

        // Attach listener to popver container (delegation)
        // Ensure we don't attach multiple times if this runs again
        if (!popover.dataset.hasListener) {
            popover.addEventListener('change', updateText);
            popover.dataset.hasListener = 'true';
        }

        // Initial run
        updateText();
    });
}

function setupCustomSelectOptions(container) {
    if (!container) return;
    // We only attach listeners to static options here.
    // For dynamic options (pen ink list), we call this again.
    // Use delegation or re-bind? Re-bind is safer given the structure.

    // First remove old listeners? Hard to do without named functions.
    // simpler: clone node? No.
    // Let's just assume we are replacing innerHTML or finding fresh nodes.

    container.querySelectorAll('.custom-option').forEach(option => {
        // Remove existing listener to prevent doubles? 
        // cloneNode(true) strips listeners.
        // But doing that breaks references.
        // Let's just set onclick directly.
        option.onclick = (e) => {
            e.stopPropagation();
            const wrapper = container.parentElement;

            // This logic differs for Autocomplete vs Select
            // CHECK PARENT TYPE
            if (wrapper.classList.contains('custom-autocomplete-wrapper')) {
                // Handled in input listener mostly, but for static lists... 
                // Autocomplete lists are dynamic.
                return;
            }

            const trigger = wrapper.querySelector('.custom-select-trigger');
            const hiddenInput = wrapper.querySelector('input[type="hidden"]');
            const nativeSelect = wrapper.querySelector('select.activity-select');
            if (!trigger) return;

            const val = option.dataset.value;
            const text = option.textContent;
            const triggerLabel = trigger.querySelector('span');

            if (hiddenInput) hiddenInput.value = val;
            if (nativeSelect) {
                nativeSelect.value = val;
                nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (triggerLabel) triggerLabel.textContent = text;

            trigger.classList.remove('open');
            container.classList.remove('show');

            // Active state
            container.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        };
    });
}

function setCustomSelectValue(id, value) {
    const hiddenInput = document.getElementById(id);
    if (!hiddenInput) return;

    hiddenInput.value = value;

    // Update UI
    const wrapper = hiddenInput.parentElement;
    const trigger = wrapper.querySelector('.custom-select-trigger span');
    const options = wrapper.querySelector('.custom-options');

    if (options) {
        // Find option with matching value
        const matchingOption = Array.from(options.querySelectorAll('.custom-option')).find(opt => opt.dataset.value === value);
        if (matchingOption) {
            if (trigger) trigger.textContent = matchingOption.textContent;
            // Update selected state
            options.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            matchingOption.classList.add('selected');
        } else {
            // Fallback for custom values not in list? Or default.
            if (!value) {
                if (trigger) trigger.textContent = "Select...";
            }
        }
    }

}

// ----------------------------------------------------------------
//  Swatch Management Logic (New)
// ----------------------------------------------------------------

// DOM Elements
const modalAddSwatch = document.getElementById('modal-add-swatch');

const btnAddSwatchHeader = document.getElementById('btn-add-swatch-header');
// menuAddSwatch is already declared globally

let currentSwatchSource = 'auto';
let currentSwatchImageCandidate = null; // { type: 'url'|'upload', value: string }
let currentUploadPath = null;
let currentSwatchFormMode = 'create';
let currentEditingSwatchId = null;
const btnDeleteSwatchUnified = document.getElementById('btn-delete-swatch-unified');

// Event Listeners for Opening Source Modal
if (btnAddSwatchHeader) {
    btnAddSwatchHeader.addEventListener('click', () => {
        openAddSwatchModal();
    });
}
if (menuAddSwatch) {
    menuAddSwatch.addEventListener('click', (e) => {
        e.preventDefault();
        openAddSwatchModal();
    });
}

async function openAddSwatchModal() {
    if (!(await requestCloseAllModals())) return;
    if (modalAddSwatch) {
        activateModal(modalAddSwatch);
        populateInkSelect('fetch-swatch-ink-wrapper', 'fetch-swatch-ink-options', 'fetch-swatch-ink-input');
        resetSwatchForm('create');
        captureModalDraftSnapshot('swatch');
    }
}

function syncSettingsCustomSelectUI() {
    document.querySelectorAll('#view-settings .settings-custom-select-wrapper').forEach((wrapper) => {
        const select = wrapper.querySelector('select.activity-select');
        const triggerLabel = wrapper.querySelector('.custom-select-trigger .current-value');
        const options = wrapper.querySelector('.custom-options');
        if (!select || !triggerLabel || !options) return;

        const selectedOption = select.options[select.selectedIndex] || select.options[0];
        if (selectedOption) triggerLabel.textContent = selectedOption.textContent;

        options.querySelectorAll('.custom-option').forEach((opt) => {
            opt.classList.toggle('selected', opt.dataset.value === select.value);
        });
    });
}

function enhanceSettingsCustomSelects() {
    const settingsView = document.getElementById('view-settings');
    if (!settingsView) return;

    settingsView.querySelectorAll('select.activity-select').forEach((selectEl) => {
        if (selectEl.dataset.customEnhanced === '1') return;
        if (!selectEl.id) return;
        selectEl.dataset.customEnhanced = '1';

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper-outer settings-custom-select-wrapper';

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.tabIndex = 0;
        trigger.innerHTML = `<span class="current-value"></span><i class="ph ph-caret-down"></i>`;

        const options = document.createElement('div');
        options.className = 'custom-options settings-custom-options';
        options.dataset.target = selectEl.id;
        options.innerHTML = Array.from(selectEl.options).map((opt) => {
            const selectedClass = opt.selected ? ' selected' : '';
            return `<div class="custom-option${selectedClass}" data-value="${escapeHtml(opt.value)}">${escapeHtml(opt.textContent || '')}</div>`;
        }).join('');

        const parent = selectEl.parentElement;
        if (!parent) return;
        parent.insertBefore(wrapper, selectEl);
        wrapper.appendChild(selectEl);
        wrapper.appendChild(trigger);
        wrapper.appendChild(options);

        selectEl.classList.add('settings-native-select-hidden');
        selectEl.tabIndex = -1;
        selectEl.addEventListener('change', () => {
            syncSettingsCustomSelectUI();
        });
    });

    syncSettingsCustomSelectUI();
}

function syncActivityCustomSelectUI() {
    document.querySelectorAll('#view-activity .activity-custom-select-wrapper').forEach((wrapper) => {
        const select = wrapper.querySelector('select.activity-select');
        const triggerLabel = wrapper.querySelector('.custom-select-trigger .current-value');
        const options = wrapper.querySelector('.custom-options');
        if (!select || !triggerLabel || !options) return;

        options.innerHTML = Array.from(select.options).map((opt) => {
            const selectedClass = opt.selected ? ' selected' : '';
            return `<div class="custom-option${selectedClass}" data-value="${escapeHtml(opt.value)}">${escapeHtml(opt.textContent || '')}</div>`;
        }).join('');
        setupCustomSelectOptions(options);

        const selectedOption = select.options[select.selectedIndex] || select.options[0];
        if (selectedOption) triggerLabel.textContent = selectedOption.textContent;
    });
}

function enhanceActivityCustomSelects() {
    const activityView = document.getElementById('view-activity');
    if (!activityView) return;

    activityView.querySelectorAll('select.activity-select').forEach((selectEl) => {
        if (selectEl.dataset.customEnhancedActivity === '1') return;
        if (!selectEl.id) return;
        selectEl.dataset.customEnhancedActivity = '1';

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper-outer activity-custom-select-wrapper';

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.tabIndex = 0;
        trigger.innerHTML = '<span class="current-value"></span><i class="ph ph-caret-down"></i>';

        const options = document.createElement('div');
        options.className = 'custom-options';
        options.dataset.target = selectEl.id;

        const parent = selectEl.parentElement;
        if (!parent) return;
        parent.insertBefore(wrapper, selectEl);
        wrapper.appendChild(selectEl);
        wrapper.appendChild(trigger);
        wrapper.appendChild(options);

        selectEl.classList.add('activity-native-select-hidden');
        selectEl.tabIndex = -1;
        selectEl.addEventListener('change', () => {
            syncActivityCustomSelectUI();
        });
    });

    syncActivityCustomSelectUI();
}

function setSwatchFormMode(mode = 'create') {
    currentSwatchFormMode = mode === 'edit' ? 'edit' : 'create';
    const titleEl = document.getElementById('swatch-modal-title');
    const saveBtn = document.getElementById('btn-save-swatch-unified');
    const inkWrapper = document.getElementById('fetch-swatch-ink-wrapper');
    if (titleEl) titleEl.textContent = currentSwatchFormMode === 'edit' ? 'Edit Swatch' : 'Add Swatch';
    if (saveBtn) saveBtn.textContent = currentSwatchFormMode === 'edit' ? 'Save Changes' : 'Save Swatch';
    if (inkWrapper) {
        inkWrapper.style.pointerEvents = currentSwatchFormMode === 'edit' ? 'none' : '';
        inkWrapper.style.opacity = currentSwatchFormMode === 'edit' ? '0.75' : '';
    }
    if (btnDeleteSwatchUnified) {
        btnDeleteSwatchUnified.style.display = (isManagerApp && currentSwatchFormMode === 'edit') ? 'inline-block' : 'none';
    }
}

function setSwatchLinkedInkSelection(inkId = '') {
    const input = document.getElementById('fetch-swatch-ink-input');
    const wrapper = document.getElementById('fetch-swatch-ink-wrapper');
    const ink = getInkById(inkId);
    if (input) input.value = inkId || '';
    if (wrapper) {
        const cv = wrapper.querySelector('.current-value');
        if (cv) {
            cv.textContent = ink ? `${ink.brand ? `${ink.brand} ` : ''}${ink.name}` : 'Select an ink...';
        }
    }
}

function setSwatchValidation(message = '') {
    const validationMsg = document.getElementById('swatch-validation-msg');
    if (!validationMsg) return;
    if (!message) {
        validationMsg.style.display = 'none';
        validationMsg.textContent = '';
        return;
    }
    validationMsg.style.display = 'inline-block';
    validationMsg.textContent = message;
}

function setSwatchPreviewState(state, payload = {}) {
    const empty = document.getElementById('swatch-preview-empty');
    const loading = document.getElementById('swatch-preview-loading');
    const error = document.getElementById('swatch-preview-error');
    const errorText = document.getElementById('swatch-preview-error-text');
    const image = document.getElementById('swatch-preview-image');
    if (!empty || !loading || !error || !image) return;

    empty.style.display = state === 'empty' ? 'flex' : 'none';
    loading.style.display = state === 'loading' ? 'flex' : 'none';
    error.style.display = state === 'error' ? 'flex' : 'none';
    image.style.display = state === 'image' ? 'block' : 'none';
    if (state !== 'image') image.src = '';
    if (state === 'image' && payload.src) image.src = payload.src;
    if (state === 'error' && errorText) errorText.textContent = payload.message || 'Could not load image.';
}

function setSwatchSource(source) {
    currentSwatchSource = source;
    document.querySelectorAll('.swatch-source-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === source);
    });
    const auto = document.getElementById('swatch-source-auto');
    const manual = document.getElementById('swatch-source-manual');
    const upload = document.getElementById('swatch-source-upload');
    if (auto) auto.style.display = source === 'auto' ? 'block' : 'none';
    if (manual) manual.style.display = source === 'manual' ? 'block' : 'none';
    if (upload) upload.style.display = source === 'upload' ? 'block' : 'none';
}

function updateSwatchControlsState() {
    const inkId = document.getElementById('fetch-swatch-ink-input')?.value || '';
    const linked = !!inkId;
    document.querySelectorAll('.swatch-source-btn').forEach(btn => {
        btn.disabled = !linked;
    });
    ['btn-fetch-auto-swatch', 'btn-load-manual-swatch', 'btn-choose-upload-swatch'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !linked;
    });
}

function resetSwatchForm(mode = 'create') {
    setSwatchFormMode(mode);
    currentEditingSwatchId = null;
    currentSwatchSource = 'auto';
    currentSwatchImageCandidate = null;
    currentUploadPath = null;
    setSwatchValidation('');

    setSwatchLinkedInkSelection('');

    const nameAuto = document.getElementById('fetch-swatch-name-auto');
    if (nameAuto) nameAuto.value = '';
    const manualUrl = document.getElementById('fetch-swatch-url-manual');
    if (manualUrl) manualUrl.value = '';

    const paper = document.getElementById('swatch-paper-input');
    const nib = document.getElementById('swatch-nib-input');
    const notes = document.getElementById('swatch-notes-input');
    if (paper) paper.value = '';
    if (nib) nib.value = '';
    setSwatchDateInputValue(new Date().toISOString().slice(0, 10));
    if (notes) notes.value = '';
    setCustomSelectValue('swatch-lighting-input', 'Unknown');

    setSwatchSource('auto');
    setSwatchPreviewState('empty');
    updateSwatchControlsState();
}

async function openEditSwatchModal(swatchId) {
    const swatch = getSwatchById(swatchId);
    if (!swatch) return;
    const ink = getInkById(swatch.ink_id);
    if (!ink) return;

    if (!(await requestCloseAllModals())) return;
    if (!modalAddSwatch) return;

    activateModal(modalAddSwatch);
    populateInkSelect('fetch-swatch-ink-wrapper', 'fetch-swatch-ink-options', 'fetch-swatch-ink-input');
    resetSwatchForm('edit');

    currentEditingSwatchId = swatch.id;
    setSwatchLinkedInkSelection(ink.id);

    const paper = document.getElementById('swatch-paper-input');
    const nib = document.getElementById('swatch-nib-input');
    const notes = document.getElementById('swatch-notes-input');
    if (paper) paper.value = swatch.swatch_paper || '';
    if (nib) nib.value = swatch.swatch_nib || '';
    setSwatchDateInputValue(swatch.swatch_date || '');
    if (notes) notes.value = swatch.swatch_notes || '';
    setCustomSelectValue('swatch-lighting-input', swatch.swatch_lighting || 'Unknown');

    currentSwatchImageCandidate = null;
    setSwatchPreviewState('image', { src: resolveImageSource(swatch.image) });
    updateSwatchControlsState();
    captureModalDraftSnapshot('swatch');
}

function getSwatchMetadataPayload() {
    return {
        swatch_paper: document.getElementById('swatch-paper-input')?.value?.trim() || '',
        swatch_nib: document.getElementById('swatch-nib-input')?.value?.trim() || '',
        swatch_date: document.getElementById('swatch-date-input')?.value || '',
        swatch_lighting: document.getElementById('swatch-lighting-input')?.value || 'Unknown',
        swatch_notes: document.getElementById('swatch-notes-input')?.value || ''
    };
}

async function setSwatchPreviewFromUrl(url, showErrors = true) {
    if (!url) return false;
    setSwatchPreviewState('loading');
    if (isManagerApp && isHeicImagePath(url)) {
        try {
            const converted = await getConvertedRemoteHeicImage(url);
            if (converted && converted.objectUrl) {
                setSwatchPreviewState('image', { src: converted.objectUrl });
                currentSwatchImageCandidate = { type: 'url', value: url };
                updateSwatchControlsState();
                return true;
            }
        } catch (error) {
            console.error('Remote HEIC preview failed.', error);
        }
        if (showErrors) {
            setSwatchPreviewState('error', { message: 'Could not convert HEIC/HEIF image from URL.' });
        } else {
            setSwatchPreviewState('empty');
        }
        currentSwatchImageCandidate = null;
        updateSwatchControlsState();
        return false;
    }

    const preview = document.getElementById('swatch-preview-image');
    return await new Promise((resolve) => {
        if (!preview) return resolve(false);
        preview.onload = () => {
            preview.onload = null;
            preview.onerror = null;
            setSwatchPreviewState('image', { src: url });
            currentSwatchImageCandidate = { type: 'url', value: url };
            updateSwatchControlsState();
            resolve(true);
        };
        preview.onerror = () => {
            preview.onload = null;
            preview.onerror = null;
            if (showErrors) {
                setSwatchPreviewState('error', { message: 'Could not load image from URL.' });
            } else {
                setSwatchPreviewState('empty');
            }
            currentSwatchImageCandidate = null;
            updateSwatchControlsState();
            resolve(false);
        };
        preview.src = url;
    });
}

async function setSwatchPreviewFromUpload(path) {
    if (!path) return false;
    const previewUrl = await getLocalImagePreviewSource(path);
    const ok = await setSwatchPreviewFromUrl(previewUrl);
    if (ok) {
        currentSwatchImageCandidate = { type: 'upload', value: path };
        currentUploadPath = path;
        updateSwatchControlsState();
    }
    return ok;
}

function isHttpsUrl(value) {
    try {
        const parsed = new URL(String(value || ''));
        return parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Overwrite populateInkSelect to add click logic securely
function populateInkSelect(wrapperId, optionsId, inputId) {
    const optionsContainer = document.getElementById(optionsId);
    if (!optionsContainer) return;

    const sortedInks = [...getLibraryInks()].sort((a, b) => a.name.localeCompare(b.name));

    optionsContainer.innerHTML = sortedInks.map(ink =>
        `<div class="custom-option" data-value="${escapeHtml(ink.id || '')}">${escapeHtml(ink.brand ? ink.brand + ' ' : '')}${escapeHtml(ink.name || '')}</div>`
    ).join('');

    // Custom binding to handle the "Auto Search" logic for Fetch Modal
    const options = optionsContainer.querySelectorAll('.custom-option');
    options.forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            const text = opt.textContent;

            const wrapper = document.getElementById(wrapperId);
            wrapper.classList.remove('open');
            wrapper.querySelector('.current-value').textContent = text;
            optionsContainer.classList.remove('show');
            document.getElementById(inputId).value = val;
            updateSwatchControlsState();
            setSwatchValidation('');
        };
    });
}

async function handleFetchSearch(inkId, options = {}) {
    const ink = appData.inks.find(i => i.id === inkId);
    if (!ink) return;
    const query = `${ink.brand || ''} ${ink.name}`.trim();
    setSwatchValidation('');
    setSwatchPreviewState('loading');

    try {
        const result = await desktopAPI.fetchInkSwatch(query);
        if (result.success && result.imageUrl) {
            const foundName = (result.inkName || '').toLowerCase();
            const queryName = ink.name.toLowerCase();
            let match = false;
            if (foundName.includes(queryName)) match = true;
            if (queryName.includes(foundName)) match = true;
            if (!match) {
                const queryWords = queryName.split(/\s+/).filter(w => w.length > 2);
                const common = queryWords.filter(w => foundName.includes(w));
                if (common.length >= 1 && (queryWords.length <= 2 || common.length >= queryWords.length / 2)) {
                    match = true;
                }
            }

            if (!match && !options.allowMismatch) {
                setSwatchPreviewState('error', {
                    message: `Closest match "${result.inkName}" did not match this ink.`
                });
                currentSwatchImageCandidate = null;
                updateSwatchControlsState();
                return false;
            }

            const ok = await setSwatchPreviewFromUrl(result.imageUrl);
            const nameInput = document.getElementById('fetch-swatch-name-auto');
            if (nameInput) nameInput.value = result.inkName || 'Unknown';
            return ok;
        } else {
            setSwatchPreviewState('error', { message: result.message || 'No swatch found automatically.' });
            currentSwatchImageCandidate = null;
            updateSwatchControlsState();
            return false;
        }
    } catch (e) {
        console.error("Link Fetch Error", e);
        setSwatchPreviewState('error', { message: 'Failed to fetch swatch from InkSwatch.com.' });
        currentSwatchImageCandidate = null;
        updateSwatchControlsState();
        return false;
    }
}

document.querySelectorAll('.swatch-source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.disabled) return;
        setSwatchSource(btn.dataset.source);
        setSwatchValidation('');
    });
});

document.getElementById('btn-fetch-auto-swatch')?.addEventListener('click', async () => {
    const inkId = document.getElementById('fetch-swatch-ink-input')?.value;
    if (!inkId) {
        setSwatchValidation('Please select an ink first.');
        return;
    }
    await handleFetchSearch(inkId);
});

document.getElementById('btn-load-manual-swatch')?.addEventListener('click', async () => {
    const inkId = document.getElementById('fetch-swatch-ink-input')?.value;
    const url = document.getElementById('fetch-swatch-url-manual')?.value?.trim();
    if (!inkId) {
        setSwatchValidation('Please select an ink first.');
        return;
    }
    if (!url) {
        setSwatchValidation('Please enter an image URL.');
        return;
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') throw new Error('Invalid protocol');
    } catch (_) {
        setSwatchValidation('Enter a valid https URL.');
        return;
    }
    setSwatchValidation('');
    await setSwatchPreviewFromUrl(url);
});

document.getElementById('fetch-swatch-url-manual')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-load-manual-swatch')?.click();
    }
});

document.getElementById('btn-choose-upload-swatch')?.addEventListener('click', async () => {
    const inkId = document.getElementById('fetch-swatch-ink-input')?.value;
    if (!inkId) {
        setSwatchValidation('Please select an ink first.');
        return;
    }
    let path = null;
    try {
        path = await desktopAPI.selectImage();
    } catch (error) {
        setSwatchValidation(`Image selection failed: ${error && error.message ? error.message : error}`);
        return;
    }
    if (!path) return;
    setSwatchValidation('');
    await setSwatchPreviewFromUpload(path);
});

document.getElementById('btn-save-swatch-unified')?.addEventListener('click', async () => {
    const inkId = document.getElementById('fetch-swatch-ink-input')?.value;
    if (!inkId && currentSwatchFormMode !== 'edit') {
        setSwatchValidation('Please select an ink.');
        return;
    }
    if (currentSwatchFormMode !== 'edit' && !currentSwatchImageCandidate) {
        setSwatchValidation('Please add a swatch image.');
        return;
    }

    const ink = appData.inks.find(i => i.id === inkId);
    const imageMetadata = ink ? { brand: ink.brand, model: ink.name } : { brand: 'unknown', model: 'ink' };
    const swatchMetadata = getSwatchMetadataPayload();
    const isEditMode = currentSwatchFormMode === 'edit';

    if (isEditMode) {
        const swatch = getSwatchById(currentEditingSwatchId);
        if (!swatch) {
            setSwatchValidation('Swatch not found.');
            return;
        }
        const linkedInk = getInkById(swatch.ink_id);
        const editMetadata = linkedInk ? { brand: linkedInk.brand, model: linkedInk.name } : imageMetadata;
        let newFilename = swatch.image || '';
        let oldFilenameToDelete = '';

        if (currentSwatchImageCandidate) {
            if (currentSwatchImageCandidate.type === 'upload') {
                newFilename = await saveManagedImage(currentSwatchImageCandidate.value, 'swatch', editMetadata);
            } else if (currentSwatchImageCandidate.type === 'url') {
                if (!isHttpsUrl(currentSwatchImageCandidate.value)) {
                    setSwatchValidation('Only https URLs are allowed for swatch images.');
                    return;
                }
                const result = await saveRemoteImageUrl(currentSwatchImageCandidate.value, 'swatch', editMetadata);
                if (result && result.success) newFilename = result.filename;
            }
            if (!newFilename) {
                setSwatchValidation('Failed to save swatch image.');
                return;
            }
            if (swatch.image && swatch.image !== newFilename) {
                oldFilenameToDelete = swatch.image;
            }
        }

        swatch.image = newFilename;
        swatch.swatch_paper = swatchMetadata.swatch_paper || '';
        swatch.swatch_nib = swatchMetadata.swatch_nib || '';
        swatch.swatch_date = swatchMetadata.swatch_date || '';
        swatch.swatch_lighting = swatchMetadata.swatch_lighting || 'Unknown';
        swatch.swatch_notes = swatchMetadata.swatch_notes || '';

        const targetInk = getInkById(swatch.ink_id);
        if (targetInk) {
            logActivity('updated', 'swatch', `Updated swatch for ${formatInkName(targetInk)}.`, {
                entityId: swatch.id,
                metadata: buildSwatchActivityMetadata(swatch, targetInk)
            });
        }

        await persistDataAndRefresh({
            refresh: {
                dashboard: true,
                swatches: true,
                inks: true,
                activity: true,
                autocomplete: true
            },
            onSuccess: async () => {
                if (oldFilenameToDelete) {
                    await disposeReplacedManagedImage(oldFilenameToDelete);
                }
                closeAllModals();
                switchView('swatches');
                renderSwatches();
            },
            onErrorMessage: 'Failed to update swatch!'
        });
        return;
    }

    let savedFilename = null;
    if (currentSwatchImageCandidate.type === 'upload') {
        savedFilename = await saveManagedImage(currentSwatchImageCandidate.value, 'swatch', imageMetadata);
    } else if (currentSwatchImageCandidate.type === 'url') {
        if (!isHttpsUrl(currentSwatchImageCandidate.value)) {
            setSwatchValidation('Only https URLs are allowed for swatch images.');
            return;
        }
        const result = await saveRemoteImageUrl(currentSwatchImageCandidate.value, 'swatch', imageMetadata);
        if (result && result.success) savedFilename = result.filename;
    }
    if (!savedFilename) {
        setSwatchValidation('Failed to save swatch image.');
        return;
    }

    await updateInkWithImage(inkId, savedFilename, swatchMetadata);
    closeAllModals();
    switchView('swatches');
    renderSwatches();
});

if (btnDeleteSwatchUnified) {
    btnDeleteSwatchUnified.addEventListener('click', async () => {
        if (currentSwatchFormMode !== 'edit') return;
        const swatchId = currentEditingSwatchId || '';
        const swatch = getSwatchById(swatchId);
        if (!swatch) return;
        const ink = getInkById(swatch.ink_id);
        const inkName = ink ? formatInkName(ink) : 'this ink';

        if (!(await confirmAction({
            title: 'Delete Swatch',
            message: `Delete swatch for ${inkName}?`,
            destructive: true,
            buttons: ['Keep Swatch', 'Delete Swatch'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        }))) return;

        const swatchImagePath = swatch.image || '';
        appData.swatches = getAllSwatches().filter((item) => item.id !== swatchId);
        logActivity('deleted', 'swatch', `Deleted swatch for ${inkName}.`, {
            entityId: swatchId,
            metadata: buildSwatchActivityMetadata(swatch, ink)
        });

        await persistDataAndRefresh({
            refresh: {
                dashboard: true,
                inks: true,
                swatches: true,
                activity: true,
                autocomplete: true
            },
            onSuccess: async () => {
                if (swatchImagePath) {
                    await desktopAPI.deleteImage(swatchImagePath);
                }
                closeAllModals();
                switchView('swatches');
                renderSwatches();
            },
            onErrorMessage: 'Failed to delete swatch!'
        });
    });
}

function makeClientId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Helper to Update App Data
async function updateInkWithImage(inkId, filename, swatchMetadata = null) {
    const ink = appData.inks.find(i => i.id === inkId);
    if (!ink) return;

    const payload = swatchMetadata || {};
    appData.swatches = Array.isArray(appData.swatches) ? appData.swatches : [];
    const newSwatch = {
        id: makeClientId('swatch'),
        ink_id: inkId,
        image: filename,
        swatch_paper: payload.swatch_paper || '',
        swatch_nib: payload.swatch_nib || '',
        swatch_date: payload.swatch_date || '',
        swatch_lighting: payload.swatch_lighting || 'Unknown',
        swatch_notes: payload.swatch_notes || '',
        created_at: Date.now()
    };
    appData.swatches.push(newSwatch);
    logActivity('created', 'swatch', `Added swatch for ${formatInkName(ink)}.`, {
        entityId: newSwatch.id,
        metadata: buildSwatchActivityMetadata(newSwatch, ink)
    });
    await persistDataAndRefresh({
        refresh: {
            dashboard: true,
            swatches: true,
            inks: true,
            activity: true,
            autocomplete: true
        },
        onErrorMessage: 'Failed to save swatch image data!'
    });
}

// DOM Elements


