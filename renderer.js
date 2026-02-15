// DOM Elements (Updated)
const viewDashboard = document.getElementById('view-dashboard');
const viewPens = document.getElementById('view-pens');
const viewActivity = document.getElementById('view-activity');
const navDashboard = document.getElementById('nav-dashboard');
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
const btnDeleteSwatchDetail = document.getElementById('btn-delete-swatch-detail');
const backupActions = document.getElementById('backup-actions');
const backupStatus = document.getElementById('backup-status');
const btnExportBackup = document.getElementById('btn-export-backup');
const btnImportBackup = document.getElementById('btn-import-backup');
const activityLogContainer = document.getElementById('activity-log-container');
const recentActivityList = document.getElementById('recent-activity-list');
const recentActivityCard = document.getElementById('recent-activity-card');
const recentPensViewAll = document.getElementById('recent-pens-view-all');
const recentInksViewAll = document.getElementById('recent-inks-view-all');
const recentSwatchesViewAll = document.getElementById('recent-swatches-view-all');
const recentActivityViewAll = document.getElementById('recent-activity-view-all');
const toggleActivityVisible = document.getElementById('toggle-activity-visible');
const toggleRecentActivityVisible = document.getElementById('toggle-recent-activity-visible');
const activityRetentionSelect = document.getElementById('activity-retention-select');
const activityDatePickerToggle = document.getElementById('activity-date-picker-toggle');
const activityCalendarPopover = document.getElementById('activity-calendar-popover');
const activityCalendarPrev = document.getElementById('activity-calendar-prev');
const activityCalendarNext = document.getElementById('activity-calendar-next');
const activityCalendarMonthLabel = document.getElementById('activity-calendar-month-label');
const activityCalendarGrid = document.getElementById('activity-calendar-grid');
const activityCalendarClear = document.getElementById('activity-calendar-clear');
const activityCalendarToday = document.getElementById('activity-calendar-today');
const activityDeleteOlderSelect = document.getElementById('activity-delete-older-select');
const btnDeleteOlderActivity = document.getElementById('btn-delete-older-activity');
const btnClearAllActivity = document.getElementById('btn-clear-all-activity');
const activityPagination = document.getElementById('activity-pagination');
const activityPageSizeSelect = document.getElementById('activity-page-size');
const activityPagePrevBtn = document.getElementById('activity-page-prev');
const activityPageNextBtn = document.getElementById('activity-page-next');
const activityPageStatus = document.getElementById('activity-page-status');
// State
let isElectron = false;
const MAX_ACTIVITY_ENTRIES = 5000;
const DASHBOARD_RECENT_LIMIT = 5;
let activityCurrentPage = 1;
let activityPageSize = 20;
let activityDateFilter = '';
let activityCalendarViewDate = new Date();
let appData = {
    pens: [],
    inks: [],
    currently_inked: [],
    activity_log: [],
    preferences: {
        show_activity_log: true,
        show_recent_activity: true,
        activity_retention_days: 365
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
    permanence: []
};
let activeSwatchesSort = 'newest';
let searchPensQuery = '';
let searchInksQuery = '';
let searchSwatchesQuery = '';
let currentSwatchDetailInkId = null;
let currentSwatchDetailSourceView = 'swatches';
let currentPenDetailPenId = null;
let currentPenDetailSourceView = 'pens';
const ENABLE_DEMO_ACTIVITY_SEED = true;
const renderScheduler = (window.PenStationRenderScheduler && window.PenStationRenderScheduler.createRenderScheduler)
    ? window.PenStationRenderScheduler.createRenderScheduler()
    : { schedule: (fn) => fn() };

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

// Global Error Handler for Debugging (Crucial for identifying "blank page" issues)
window.onerror = function (message, source, lineno, colno, error) {
    alert(`JS Error: ${message}\nAt: ${source}:${lineno}:${colno}`);
    console.error("Global Error:", error);
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

function ensureAppDataDefaults(data) {
    const safe = data && typeof data === 'object' ? data : {};
    safe.pens = Array.isArray(safe.pens) ? safe.pens : [];
    safe.inks = Array.isArray(safe.inks) ? safe.inks : [];
    safe.currently_inked = Array.isArray(safe.currently_inked) ? safe.currently_inked : [];
    safe.activity_log = Array.isArray(safe.activity_log) ? safe.activity_log : [];
    const incomingPrefs = (safe.preferences && typeof safe.preferences === 'object') ? safe.preferences : {};
    const allowedRetention = [0, 90, 180, 365];
    const incomingRetention = Number(incomingPrefs.activity_retention_days);
    safe.preferences = {
        show_activity_log: typeof incomingPrefs.show_activity_log === 'boolean' ? incomingPrefs.show_activity_log : true,
        show_recent_activity: typeof incomingPrefs.show_recent_activity === 'boolean' ? incomingPrefs.show_recent_activity : true,
        activity_retention_days: allowedRetention.includes(incomingRetention) ? incomingRetention : 365
    };
    return safe;
}

function getPreferences() {
    return ensureAppDataDefaults(appData).preferences;
}

function shouldHideActivityInShowcase() {
    return !isElectron && !getPreferences().show_activity_log;
}

function shouldHideRecentActivityInShowcase() {
    return !isElectron && !getPreferences().show_recent_activity;
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

function formatInkName(ink) {
    if (!ink) return 'Unknown ink';
    const name = [ink.brand || '', ink.name || ''].join(' ').trim();
    return name || 'Unnamed ink';
}

function formatActivityDateLabel(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (timestamp >= startOfDay) return 'Today';
    if (timestamp >= (startOfDay - oneDay)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatActivityTimestamp(timestamp) {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return 'Unknown time';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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

    activityCalendarMonthLabel.textContent = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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
        recent = false,
        pens = false,
        inks = false,
        swatches = false,
        activity = false,
        autocomplete = false
    } = options;

    if (dashboard) scheduleRender(renderDashboard);
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

    if (!isElectron) {
        alert("Saving is disabled in Showcase mode.");
        return false;
    }

    const result = await window.electronAPI.saveData(appData);
    if (result && result.success) {
        if (typeof onSuccess === 'function') {
            await onSuccess();
        }
        scheduleUiRefresh(refresh);
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
    return d.toLocaleString();
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
    if (!isElectron || !window.electronAPI || typeof window.electronAPI.backupStatus !== 'function') {
        return;
    }
    if (!backupStatus) return;
    try {
        const result = await window.electronAPI.backupStatus();
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
        if (window.electronAPI) {
            isElectron = true;
            console.log("%c Mode: Electron (Manager) ", "background: #2c3e50; color: #fff; font-weight: bold;");
            const data = await window.electronAPI.loadData();
            if (data) {
                appData = ensureAppDataDefaults(data);
            }
        } else {
            isElectron = false;
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

            try {
                const response = await fetch('./data.json');
                if (response.ok) appData = ensureAppDataDefaults(await response.json());
            } catch (e) { console.warn("Using defaults"); }
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
        if (isElectron) {
            refreshBackupStatus();
        }
        const retentionPrunedOnLoad = applyActivityRetention();
        const seededDemoActivity = maybeSeedDemoActivityLogs();
        if ((seededDemoActivity || retentionPrunedOnLoad) && isElectron && window.electronAPI && typeof window.electronAPI.saveData === 'function') {
            await window.electronAPI.saveData(appData);
        }

        // Persistence: Restore last view
        const lastView = localStorage.getItem('lastView') || 'dashboard';
        switchView(lastView === 'activity' && shouldHideActivityInShowcase() ? 'dashboard' : lastView);

        // Re-render based on restored view (Initial render)
        renderDashboard();
        if (lastView === 'pens') renderPens();
        else if (lastView === 'inks') renderInks();
        else if (lastView === 'swatches') renderSwatches();
        else if (lastView === 'activity') renderActivityLogView();
        renderActivityLogView();

    } catch (e) {
        console.error("Failed to load data:", e);
        // Fallback for local file:// testing where fetch might fail
        if (!window.electronAPI && window.location.protocol === 'file:') {
            alert("Note: To view your changes in a browser locally, you need a local server due to security settings. The Electron App is your local viewer!");
        }
    }
}


// Navigation Logic
function switchView(viewName) {
    if (viewName === 'activity' && shouldHideActivityInShowcase()) {
        viewName = 'dashboard';
    }

    // Hide all first
    if (viewDashboard) viewDashboard.style.display = 'none';
    if (viewPens) viewPens.style.display = 'none';
    if (viewActivity) viewActivity.style.display = 'none';
    const viewInks = document.getElementById('view-inks');
    const viewSwatches = document.getElementById('view-swatches');
    if (viewInks) viewInks.style.display = 'none';
    if (viewSwatches) viewSwatches.style.display = 'none';

    // Deactivate Navs
    if (navDashboard) navDashboard.classList.remove('active');
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
    if (navActivity) navActivity.style.display = hideActivityNav ? 'none' : '';
    if (navActivityDivider) navActivityDivider.style.display = hideActivityNav ? 'none' : '';

    // Save current view
    localStorage.setItem('lastView', viewName);
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

function renderStats() {
    // ... (Existing implementation)
    const inkedCount = appData.currently_inked.length;
    const pensCount = (appData.pens || []).length;
    const bottleCount = getLibraryInks().length;
    const swatchesCount = appData.inks.filter(ink => ink.image && ink.is_swatch).length;

    const numInked = document.getElementById('stat-inked');
    const numBottles = document.getElementById('stat-bottles');
    const numSwatches = document.getElementById('stat-swatches');

    if (numInked) numInked.textContent = pensCount;
    if (numBottles) numBottles.textContent = bottleCount;
    if (numSwatches) numSwatches.textContent = swatchesCount;

    const inkedSummary = document.getElementById('currently-inked-summary');
    if (inkedSummary) {
        const noun = inkedCount === 1 ? 'pen is' : 'pens are';
        inkedSummary.innerHTML = `<span style="font-weight: 800;">${inkedCount}</span> ${noun} currently inked`;
    }
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

            if (isElectron) {
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

            card.innerHTML = `
                <div class="ink-swatch-bg" style="${bgStyle}; height: 120px;"></div>
                <div class="card-content">
                    <div class="pen-name" style="font-size: 16px; font-weight: 600;">${penName}</div>
                    <div class="pen-detail" style="font-size: 12px; color: #666; margin-bottom: 8px;">${penDetail}</div>
                    <div class="ink-pairing" style="display: flex; align-items: center; gap: 8px;">
                        <div class="ink-dot" style="background-color: ${inkColor}; width: 12px; height: 12px; border-radius: 50%;"></div>
                        <span style="font-size: 13px; color: #444;">${inkName}</span>
                    </div>
                    <div class="card-meta" style="margin-top: 8px; font-size: 11px; color: #888;">Inked ${new Date(item.date_inked).toLocaleDateString()}</div>
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
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="color-circle" style="background-color: ${ink.color_base || '#ccc'}; border-color: ${ink.color_accent || ink.color_base || '#999'}"></div>
                <div class="item-info">
                    <div class="item-title">${ink.name}</div>
                    <div class="item-sub">${ink.brand || ''}</div>
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
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="color-circle" style="background-color: ${pen.hex_color || '#d8dde6'}; border-color: ${pen.hex_color || '#d8dde6'}"></div>
                <div class="item-info">
                    <div class="item-title">${pen.model || 'Unnamed Pen'}</div>
                    <div class="item-sub">${pen.brand || ''}${pen.nib ? ` • ${pen.nib}` : ''}</div>
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
        const swatches = appData.inks.filter(ink => ink && ink.image && ink.is_swatch);
        if (swatches.length === 0) return;

        const recent = [...swatches].reverse().slice(0, DASHBOARD_RECENT_LIMIT);
        recent.forEach(ink => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="color-circle" style="background-color: ${ink.color_base || '#d8dde6'}; border-color: ${ink.color_accent || ink.color_base || '#d8dde6'}"></div>
                <div class="item-info">
                    <div class="item-title">${ink.name || 'Unnamed Swatch'}</div>
                    <div class="item-sub">${ink.brand || ''}</div>
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
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="color-circle" style="background: ${iconSpec.bg}; border-color: ${iconSpec.border}; display: flex; align-items: center; justify-content: center;">
                <i class="ph ${iconSpec.icon}" style="font-size: 16px; color: ${iconSpec.color};"></i>
            </div>
            <div class="item-info">
                <div class="item-title">${entry.message || 'Activity recorded'}</div>
                <div class="item-sub">${formatActivityTimestamp(entry.timestamp)}</div>
            </div>
        `;
        recentActivityList.appendChild(div);
    });
}

function buildActivityLogbookHtml(items) {
    if (!items.length) {
        const fallbackDate = activityDateFilter
            ? parseIsoLocalDate(activityDateFilter)
            : new Date();
        const label = fallbackDate ? formatActivityDateLabel(fallbackDate.getTime()) : 'Today';
        return `
            <div class="activity-date-label">${label}</div>
            <div class="activity-logbook-item activity-logbook-empty glass-panel">
                <div class="activity-logbook-message">No activity has been recorded for this day.</div>
            </div>
        `;
    }

    let html = '';
    let lastDate = '';
    items.forEach((entry) => {
        const dateLabel = formatActivityDateLabel(entry.timestamp);
        if (dateLabel !== lastDate) {
            html += `<div class="activity-date-label">${dateLabel}</div>`;
            lastDate = dateLabel;
        }
        html += `
            <div class="activity-logbook-item glass-panel" data-activity-id="${entry.id}">
                <div class="activity-logbook-time">${formatActivityTimestamp(entry.timestamp)}</div>
                <div>
                    <div class="activity-logbook-message">${entry.message || 'Activity recorded'}</div>
                    <div class="activity-logbook-meta">${entry.category || 'system'} • ${entry.action || 'updated'}</div>
                </div>
                <button class="activity-delete-btn" data-delete-activity-id="${entry.id}" title="Delete entry">
                    <i class="ph ph-trash"></i>
                </button>
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

function renderActivityLogView() {
    if (!activityLogContainer) return;

    const prefs = getPreferences();
    if (toggleActivityVisible) toggleActivityVisible.checked = !!prefs.show_activity_log;
    if (toggleRecentActivityVisible) toggleRecentActivityVisible.checked = !!prefs.show_recent_activity;
    if (activityRetentionSelect) activityRetentionSelect.value = String(getActivityRetentionDays());
    const hideActivityNav = shouldHideActivityInShowcase();
    if (navActivity) navActivity.style.display = hideActivityNav ? 'none' : '';
    if (navActivityDivider) navActivityDivider.style.display = hideActivityNav ? 'none' : '';

    let items = [...(appData.activity_log || [])]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (activityDateFilter) {
        const selected = new Date(`${activityDateFilter}T00:00:00`);
        if (!Number.isNaN(selected.getTime())) {
            const startTs = selected.getTime();
            const endTs = startTs + (24 * 60 * 60 * 1000);
            items = items.filter(entry => {
                const ts = entry.timestamp || 0;
                return ts >= startTs && ts < endTs;
            });
        }
    }
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
                if (isElectron) {
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
                ? (pen.image.startsWith('data:') ? pen.image : `images/${pen.image}`)
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

            card.innerHTML = `
                <div class="pen-card-visual" style="${backgroundStyle}">
                    ${imagePath ? `<img src="${imagePath}" class="${imgClass}" style="${imgStyle}">` : `<i class="ph ph-pen-nib" style="font-size: 40px; color: rgba(0,0,0,0.1);"></i>`}
                </div>
                <div class="pen-card-info">
                    <div class="pen-card-brand">${pen.brand}</div>
                    <div class="pen-card-model">${pen.model}</div>
                    <div class="pen-card-meta">
                        <span>${pen.filling_system || 'Standard'}</span>
                        <span>${pen.nib}</span>
                        <span>${pen.nib_material || 'Steel'}</span>
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
const inkIsSwatchCheckbox = document.getElementById('ink-is-swatch-checkbox');
let currentSelectedImagePath = null;

if (inkImageArea) {
    inkImageArea.addEventListener('click', async () => {
        if (!isElectron) return alert("Upload is only available in the Manager app.");
        const filePath = await window.electronAPI.selectImage();
        if (filePath) {
            currentSelectedImagePath = filePath;
            inkImagePreview.onload = () => {
                const colors = extractInkColors(inkImagePreview);
                if (colors) {
                    currentInkColors = [];
                    if (colors.base) currentInkColors.push(colors.base);
                    if (colors.accent && colors.accent !== colors.base) currentInkColors.push(colors.accent);
                    renderInkColorSlots();
                }
                inkImagePreview.onload = null;
            };
            inkImagePreview.src = `file://${filePath}`;
            inkImagePreview.style.display = 'block';
            inkImageArea.querySelector('i').style.display = 'none';
            inkImageArea.querySelector('p').style.display = 'none';
        }
    });
}

function openInkModal(inkId = null) {
    closeAllModals(); // Ensure no other modals are conflicting
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
        inkImageArea.querySelector('i').style.display = 'block';
        inkImageArea.querySelector('p').style.display = 'block';
    }
    if (inkIsSwatchCheckbox) inkIsSwatchCheckbox.checked = false;

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

            if (ink.image && inkImagePreview) {
                inkImagePreview.src = ink.image.startsWith('data:') ? ink.image : `images/${ink.image}`;
                inkImagePreview.style.display = 'block';
                inkImageArea.querySelector('i').style.display = 'none';
                inkImageArea.querySelector('p').style.display = 'none';
            }
            if (inkIsSwatchCheckbox) inkIsSwatchCheckbox.checked = !!ink.is_swatch;

            // Initialize Colors
            initInkColors(ink.hex_colors, ink.color_base, ink.color_accent);

            // New Characteristics (Sorting as requested)
            setCustomSelectValue('ink-shading', ink.shading || 'None');
            setCustomSelectValue('ink-sheen', ink.sheen || 'None');
            setCustomSelectValue('ink-shimmer', ink.shimmer || 'None');
            setCustomSelectValue('ink-flow', ink.flow || 'Average');
            setCustomSelectValue('ink-lubrication', ink.lubrication || 'Medium');
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
        setCustomSelectValue('ink-type-input', 'Bottle');
        if (document.getElementById('ink-cl-input')) document.getElementById('ink-cl-input').value = '';
        if (document.getElementById('ink-amount-input')) document.getElementById('ink-amount-input').value = '1';

        setCustomSelectValue('ink-shading', 'None');
        setCustomSelectValue('ink-sheen', 'None');
        setCustomSelectValue('ink-shimmer', 'None');
        setCustomSelectValue('ink-flow', 'Average');
        setCustomSelectValue('ink-lubrication', 'Low');
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

    if (selected.length === 0) {
        placeholder.textContent = placeholder.dataset.default || 'Select properties...';
    } else {
        placeholder.textContent = selected.join(', ');
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

function openPenModal(penId = null) {
    closeAllModals(); // Ensure no other modals are conflicting
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
        let html = `<div class="custom-option" data-value="">Nothing (Clean)</div>`;
        getLibraryInks().forEach(ink => {
            html += `<div class="custom-option" data-value="${ink.id}">${ink.name} (${ink.brand})</div>`;
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
                const imagePath = pen.image.startsWith('data:') ? pen.image : `images/${pen.image}`;
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
        if (penNibInput) penNibInput.value = '';
        if (penNibMaterialInput) penNibMaterialInput.value = '';
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

        if (penInkSelect) setCustomSelectValue('pen-ink-select', "");

        btnSavePen.textContent = 'Add Pen';
        if (btnDeletePen) btnDeletePen.style.display = 'none';
        modalPen.querySelector('h2').textContent = 'Add New Pen';
    }
}

let modalLifecycle = null;

function getModalLifecycle() {
    if (modalLifecycle) return modalLifecycle;
    if (!window.PenStationModalLifecycle || typeof window.PenStationModalLifecycle.createModalLifecycle !== 'function') {
        return null;
    }
    modalLifecycle = window.PenStationModalLifecycle.createModalLifecycle({
        focusWindow: () => {
            if (window.electronAPI && typeof window.electronAPI.focusWindow === 'function') {
                window.electronAPI.focusWindow();
            }
        }
    });
    return modalLifecycle;
}

function closeAllModals() {
    const addSwatchModal = document.getElementById('modal-add-swatch');
    const lifecycle = getModalLifecycle();
    if (!lifecycle) return;
    lifecycle.closeAllModals([modalInk, modalPen, modalSwatchDetail, modalPenDetail, addSwatchModal]);
    currentSwatchDetailInkId = null;
    currentPenDetailPenId = null;
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

    if (isElectron && window.electronAPI && typeof window.electronAPI.confirmDialog === 'function') {
        const result = await window.electronAPI.confirmDialog({
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

function openSwatchDetailModal(inkId, sourceView = 'swatches') {
    if (!modalSwatchDetail) return;
    activateModal(modalSwatchDetail);
    const ink = appData.inks.find(i => i.id === inkId);
    if (!ink) return;
    currentSwatchDetailInkId = inkId;
    currentSwatchDetailSourceView = sourceView;
    if (btnDeleteSwatchDetail) {
        btnDeleteSwatchDetail.style.display = isElectron ? 'inline-block' : 'none';
    }

    const img = document.getElementById('swatch-detail-img');
    const layout = document.getElementById('swatch-detail-layout');
    const container = document.getElementById('swatch-detail-modal-container');
    const imageContainer = document.getElementById('swatch-detail-image-container');
    const contentArea = document.getElementById('swatch-detail-content');
    const name = document.getElementById('swatch-detail-name');
    const brand = document.getElementById('swatch-detail-brand');
    const standaloneBadge = document.getElementById('swatch-detail-standalone-badge');
    const c1 = document.getElementById('swatch-detail-color-1');
    const c2 = document.getElementById('swatch-detail-color-2');
    const props = document.getElementById('swatch-detail-properties');

    // 1. Hide modal immediately to prevent "ghost" content from previous ink
    modalSwatchDetail.style.display = 'none';
    if (contentArea) contentArea.scrollTop = 0;

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
    if (brand) brand.textContent = (ink.brand || 'Custom') + (ink.line ? ` - ${ink.line}` : '');
    if (standaloneBadge) {
        standaloneBadge.style.display = isOrphanSwatchInk(ink) ? 'inline-flex' : 'none';
    }

    // Handle Colors
    const detailColorsContainer = document.getElementById('swatch-detail-colors');
    if (detailColorsContainer) {
        detailColorsContainer.innerHTML = '';
        const colorsToShow = ink.hex_colors || [ink.color_base || '#ccc', ink.color_accent || ink.color_base || '#999'];
        colorsToShow.forEach(hex => {
            const chip = document.createElement('div');
            chip.style.width = '32px';
            chip.style.height = '32px';
            chip.style.borderRadius = '50%';
            chip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            chip.style.border = '2px solid #fff';
            chip.style.backgroundColor = hex;
            detailColorsContainer.appendChild(chip);
        });
    }

    const createSection = (label, value, extraStyle = '') => `
        <div style="margin: 0; padding: 0; ${extraStyle}">
            <h4 style="text-transform: uppercase; font-size: 11px; font-family: var(--font-body); letter-spacing: 1.5px; color: #aaa; margin: 0 0 4px 0; padding: 0; font-weight: 700; line-height: 1.2;">${label}</h4>
            <p style="font-size: 15px; color: #555; line-height: 1.6; font-family: var(--font-body) !important; font-weight: 400; margin: 0; padding: 0; text-transform: none !important; letter-spacing: normal !important;">${value || 'None'}</p>
        </div>
    `;

    const metadataArea = document.getElementById('swatch-detail-metadata');
    if (metadataArea) {
        const baseTypeVal = (Array.isArray(ink.base_type) ? ink.base_type : [ink.base_type || 'Dye']).join(', ');
        const paperVal = (ink.paper_compatibility || []).join(', ') || 'No specific data';

        metadataArea.innerHTML = `
            ${createSection('Base Type', baseTypeVal)}
            ${createSection('Shading', ink.shading)}
            ${createSection('Sheen', ink.sheen)}
            ${createSection('Flow', ink.flow)}
            ${createSection('Lubrication', ink.lubrication)}
            ${createSection('Dry Time', ink.dry_time)}
            ${createSection('Permanence', ink.permanence)}
            ${createSection('Paper', ink.swatch_paper || 'Not specified')}
            ${createSection('Nib Used', ink.swatch_nib || 'Not specified')}
            ${createSection('Date Sampled', ink.swatch_date || 'Not specified')}
            ${createSection('Lighting', ink.swatch_lighting || 'Unknown')}
            ${createSection('Paper Compatibility', paperVal, 'grid-column: span 2;')}
        `;
    }

    const notesArea = document.getElementById('swatch-detail-notes-area');
    const swatchNotes = (ink.swatch_notes && ink.swatch_notes.trim()) ? ink.swatch_notes : ink.notes;
    if (notesArea) {
        if (swatchNotes && swatchNotes.trim()) {
            notesArea.style.display = 'block';
            notesArea.innerHTML = createSection('Notes', swatchNotes);
        } else {
            notesArea.style.display = 'none';
        }
    }

    // 4. Handle Image and Layout Decision
    if (ink.image && img) {
        // Use images/ prefix only for local filenames, not data URLs
        const imagePath = ink.image.startsWith('data:') ? ink.image : `images/${ink.image}`;

        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio > 1.25) {
                if (layout) layout.style.flexDirection = 'column';
                if (container) container.style.width = '700px';
                if (imageContainer) {
                    imageContainer.style.flex = 'none';
                    imageContainer.style.height = '350px';
                    imageContainer.style.minHeight = 'auto';
                }
            }
            modalSwatchDetail.style.display = 'flex';
            img.onload = null;
            img.onerror = null;
        };

        img.onerror = () => {
            // If image fails, hide image area but still show modal
            if (imageContainer) imageContainer.style.display = 'none';
            if (container) container.style.width = '550px';
            modalSwatchDetail.style.display = 'flex';
            img.onload = null;
            img.onerror = null;
        };

        img.src = imagePath;
    } else {
        if (img) img.src = '';
        if (imageContainer) imageContainer.style.display = 'none';
        if (container) container.style.width = '550px';
        modalSwatchDetail.style.display = 'flex';
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
    const layout = document.getElementById('pen-detail-layout');
    const container = document.getElementById('pen-detail-modal-container');
    const visualContainer = document.getElementById('pen-detail-visual-container');

    // Reset scroll & layout
    const contentArea = document.getElementById('pen-detail-content');
    if (contentArea) contentArea.scrollTop = 0;
    if (layout) layout.style.flexDirection = 'row';
    if (container) container.style.width = '800px';
    if (visualContainer) {
        visualContainer.style.background = pen.hex_color || 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
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
            const chip = document.createElement('div');
            chip.style.width = '32px';
            chip.style.height = '32px';
            chip.style.borderRadius = '50%';
            chip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            chip.style.border = '2px solid #fff';
            chip.style.backgroundColor = hex;
            detailColorsContainer.appendChild(chip);
        });
    }

    const createSection = (label, value) => `
        <div style="margin: 0; padding: 0;">
            <h4 style="text-transform: uppercase; font-size: 11px; font-family: var(--font-body); letter-spacing: 1.5px; color: #aaa; margin: 0 0 4px 0; padding: 0; font-weight: 700; line-height: 1.2;">${label}</h4>
            <p style="font-size: 15px; color: #555; line-height: 1.6; font-family: var(--font-body) !important; font-weight: 400; margin: 0; padding: 0;">${value || 'None'}</p>
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
            ${createSection('Price', formatPrice(pen.price))}
            ${isMobileDetail && linkedInk ? `
            <div style="margin: 0; padding: 0;">
                <h4 style="text-transform: uppercase; font-size: 11px; font-family: var(--font-body); letter-spacing: 1.5px; color: #aaa; margin: 0 0 4px 0; padding: 0; font-weight: 700; line-height: 1.2;">Currently Inked With</h4>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${mobileCurrentInkColor}; box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,0.1);"></div>
                    <p style="font-size: 15px; color: #555; line-height: 1.6; font-family: var(--font-body) !important; font-weight: 400; margin: 0; padding: 0;">${mobileCurrentInkName}</p>
                </div>
            </div>` : ''}
        `;
    }

    // Check Currently Inked
    if (isMobileDetail) {
        if (inkArea) inkArea.style.display = 'none';
    } else if (ci) {
        if (linkedInk && inkArea) {
            inkArea.style.display = 'block';
            document.getElementById('pen-detail-ink-name').textContent = linkedInk.name;
            document.getElementById('pen-detail-ink-color').style.backgroundColor = linkedInk.color_base || '#ccc';
        } else if (inkArea) {
            inkArea.style.display = 'none';
        }
    } else {
        if (inkArea) inkArea.style.display = 'none';
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
        const imagePath = pen.image.startsWith('data:') ? pen.image : `images/${pen.image}`;

        penImg.onload = () => {
            // Force Portrait (Side-by-side) for pens, as they are normalized vertical
            if (layout) layout.style.flexDirection = 'row';
            if (container) container.style.width = '850px';

            if (visualContainer) {
                const rotation = pen.image_rotation || 0;
                const isRotated = rotation === 90 || rotation === 270;

                visualContainer.style.background = pen.hex_color || 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
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

    const validationMsg = document.getElementById('ink-validation-msg');
    validationMsg.style.display = 'none';

    if (!name) {
        validationMsg.textContent = 'Please enter an ink name';
        validationMsg.style.display = 'inline-block';
        return;
    }

    let imageFilename = null;
    if (currentSelectedImagePath && !currentSelectedImagePath.startsWith('images/')) {
        imageFilename = await window.electronAPI.saveImage(currentSelectedImagePath, 'ink', { brand, model: name });
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
            appData.inks[index].is_swatch = !!(document.getElementById('ink-is-swatch-checkbox')?.checked);
            appData.inks[index].is_orphan_swatch = false;

            if (imageFilename) {
                appData.inks[index].image = imageFilename;
            }


            // Technical Fields
            appData.inks[index].line = document.getElementById('ink-line-input')?.value;
            appData.inks[index].type = normalizeInkType(document.getElementById('ink-type-input')?.value) || 'Bottle';
            appData.inks[index].cl = document.getElementById('ink-cl-input')?.value;
            appData.inks[index].amount = document.getElementById('ink-amount-input')?.value;

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
            id: `ink_${Date.now()}`,
            name: name,
            brand: brand,
            line: document.getElementById('ink-line-input')?.value || '',
            type: normalizeInkType(document.getElementById('ink-type-input')?.value) || 'Bottle',
            cl: document.getElementById('ink-cl-input')?.value || '',
            amount: document.getElementById('ink-amount-input')?.value || '1',
            color_base: colorBase,
            color_accent: colorAccent,
            hex_colors: allColors,
            shading: document.getElementById('ink-shading')?.value || 'None',
            sheen: document.getElementById('ink-sheen')?.value || 'None',
            shimmer: document.getElementById('ink-shimmer')?.value || 'None',
            flow: document.getElementById('ink-flow')?.value || 'Average',
            lubrication: document.getElementById('ink-lubrication')?.value || 'Low',
            dry_time: document.getElementById('ink-dry-time')?.value || '',
            base_type: Array.from(document.querySelectorAll('#base-type-popover input[type="checkbox"]')).filter(cb => cb.checked).map(cb => cb.value),
            permanence: document.getElementById('ink-permanence')?.value || 'None',
            paper_compatibility: Array.from(paperCheckboxes).filter(cb => cb.checked).map(cb => cb.value),
            notes: document.getElementById('ink-notes')?.value || '',
            image: imageFilename,
            is_swatch: !!(document.getElementById('ink-is-swatch-checkbox')?.checked),
            is_orphan_swatch: false
        };
        appData.inks.push(newInk);
        logActivity('created', 'ink', `Added ink: ${formatInkName(newInk)}.`, { entityId: newInk.id });
    }

    if (wasEdit && existingInk) {
        logActivity('updated', 'ink', `Updated ink: ${formatInkName(existingInk)}.`, { entityId: existingInk.id });
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
            closeAllModals();
        },
        onErrorMessage: 'Failed to save data!'
    });
}

async function saveNewPen() {
    const brand = penBrandInput.value;
    const model = penModelInput.value;
    const normalizedFillingSystem = normalizeCsvValues(penFillingSystemInput.value).join(', ');
    const normalizedPenColor = normalizeCsvValues(penColorInput.value).join(', ');
    const wasEdit = !!currentEditingId;
    const existingPen = wasEdit ? findPenById(currentEditingId) : null;
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
        } else if ((currentPenImagePath.includes('/') || currentPenImagePath.includes('\\')) && !currentPenImagePath.startsWith('images/')) {
              // It's a full path, save it
              const savedName = await window.electronAPI.saveImage(currentPenImagePath, 'pen', {
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
            appData.pens[index].material = penMaterialInput.value;
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
        targetPenId = `pen_${Date.now()}`;
        const newPen = {
            id: targetPenId,
            brand: brand,
            model: model,
            nib: penNibInput.value || 'M',
            nib_material: penNibMaterialInput.value || 'Steel',
            material: penMaterialInput.value || 'Standard',
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
                    id: `ci_${Date.now()}`,
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
    if (!wasEdit && targetPen) {
        logActivity('created', 'pen', `Added pen: ${formatPenName(targetPen)}.`, { entityId: targetPenId });
    } else if (wasEdit && targetPen) {
        logActivity('updated', 'pen', `Updated pen: ${formatPenName(targetPen)}.`, { entityId: targetPenId });
    }

    const currentLink = (appData.currently_inked || []).find(ci => ci.pen_id === targetPenId);
    const currentInkId = currentLink ? currentLink.ink_id : '';
    if (previousInkId !== currentInkId && targetPen) {
        const previousInk = findInkById(previousInkId);
        const currentInk = findInkById(currentInkId);
        if (!previousInkId && currentInkId && currentInk) {
            logActivity('inked', 'pen', `Inked ${formatPenName(targetPen)} with ${formatInkName(currentInk)}.`, { entityId: targetPenId });
        } else if (previousInkId && !currentInkId) {
            logActivity('cleaned', 'pen', `Emptied ${formatPenName(targetPen)} (${formatInkName(previousInk)} removed).`, { entityId: targetPenId });
        } else if (previousInkId && currentInkId && currentInk) {
            logActivity('reinked', 'pen', `Changed ink in ${formatPenName(targetPen)} to ${formatInkName(currentInk)}.`, {
                entityId: targetPenId,
                metadata: {
                    previous_ink_id: previousInkId,
                    new_ink_id: currentInkId
                }
            });
        }
    }

    await persistDataAndRefresh({
        refresh: {
            pens: true,
            dashboard: true,
            activity: true,
            autocomplete: true
        },
        onSuccess: async () => {
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
        buttons: ['Keep Ink', 'Delete Ink'],
        defaultId: 0,
        cancelId: 0,
        confirmedIndex: 1
    }))) return;

    const inkToDelete = appData.inks.find(i => i.id === currentEditingId);
    if (!inkToDelete) return;
    const hasLinkedSwatch = !!(inkToDelete.image && inkToDelete.is_swatch);
    let deleteLinkedSwatch = true;

    if (hasLinkedSwatch) {
        deleteLinkedSwatch = await confirmAction({
            title: 'Delete Linked Swatch?',
            message: 'This ink has a linked swatch.',
            detail: 'Choose "Delete Ink Only" to keep the swatch as a standalone entry.',
            buttons: ['Delete Ink Only', 'Delete Ink + Swatch'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        });
    }

    const inkImagePath = inkToDelete.image || null;
    appData.currently_inked = appData.currently_inked.filter(ci => ci.ink_id !== currentEditingId);

    if (!deleteLinkedSwatch && hasLinkedSwatch) {
        inkToDelete.is_orphan_swatch = true;
        logActivity('deleted', 'ink', `Deleted ink only and kept swatch: ${formatInkName(inkToDelete)}.`, { entityId: currentEditingId });
    } else {
        appData.inks = appData.inks.filter(i => i.id !== currentEditingId);
        logActivity('deleted', 'ink', `Deleted ink: ${formatInkName(inkToDelete)}.`, { entityId: currentEditingId });
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
            if (deleteLinkedSwatch && inkImagePath) {
                await window.electronAPI.deleteImage(inkImagePath);
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
        buttons: ['Keep Pen', 'Delete Pen'],
        defaultId: 0,
        cancelId: 0,
        confirmedIndex: 1
    }))) return;

    // Get image path before deleting
    const penToDelete = appData.pens.find(p => p.id === currentEditingId);
    const penImagePath = penToDelete ? penToDelete.image : null;

    // Remove from pens
    appData.pens = appData.pens.filter(p => p.id !== currentEditingId);
    // Remove from currently inked
    appData.currently_inked = appData.currently_inked.filter(ci => ci.pen_id !== currentEditingId);
    if (penToDelete) {
        logActivity('deleted', 'pen', `Deleted pen: ${formatPenName(penToDelete)}.`, { entityId: currentEditingId });
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
                await window.electronAPI.deleteImage(penImagePath);
            }
            closeAllModals();
            currentEditingId = null;
        },
        onErrorMessage: 'Failed to delete pen!'
    });
}

async function deleteCurrentSwatch() {
    if (!currentSwatchDetailInkId) return;
    const swatchInk = appData.inks.find(i => i.id === currentSwatchDetailInkId);
    if (!swatchInk || !swatchInk.image || !swatchInk.is_swatch) return;

    if (!(await confirmAction({
        title: 'Delete Swatch',
        message: 'Delete this swatch image?',
        buttons: ['Keep Swatch', 'Delete Swatch'],
        defaultId: 0,
        cancelId: 0,
        confirmedIndex: 1
    }))) return;

    const swatchImagePath = swatchInk.image;
    if (isOrphanSwatchInk(swatchInk)) {
        appData.inks = appData.inks.filter(i => i.id !== currentSwatchDetailInkId);
        logActivity('deleted', 'swatch', `Deleted standalone swatch: ${formatInkName(swatchInk)}.`, { entityId: currentSwatchDetailInkId });
    } else {
        swatchInk.image = '';
        swatchInk.is_swatch = false;
        swatchInk.is_orphan_swatch = false;
        logActivity('deleted', 'swatch', `Deleted swatch image for ${formatInkName(swatchInk)}.`, { entityId: currentSwatchDetailInkId });
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
            if (swatchImagePath) {
                await window.electronAPI.deleteImage(swatchImagePath);
            }
            if (modalSwatchDetail) {
                modalSwatchDetail.style.display = 'none';
            }
            currentSwatchDetailInkId = null;
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
window.addEventListener('click', (e) => {
    // 1. Dropdown outside click
    if (dropdownMenu && btnAddMenu && !btnAddMenu.contains(e.target) && dropdownMenu.classList.contains('show')) {
        dropdownMenu.classList.remove('show');
    }

    // 2. Modal outside click (close on overlay click)
    if (e.target === modalInk || e.target === modalPen || e.target === modalSwatchDetail || e.target === modalPenDetail ||
        e.target === document.getElementById('modal-add-swatch')) {
        closeAllModals();
    }

    // 3. Global Close Button Handler
    if (e.target.closest('.close-modal')) {
        closeAllModals();
    }
});

document.addEventListener('keydown', (e) => {
    const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    const typingInField = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT';
    const detailOpen = isModalVisible(modalSwatchDetail) || isModalVisible(modalPenDetail);
    if (!detailOpen) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeDetailModals();
        return;
    }

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
    if (isModalVisible(modalSwatchDetail)) modalSwatchDetail.style.display = 'none';
    if (isModalVisible(modalPenDetail)) modalPenDetail.style.display = 'none';
    currentSwatchDetailInkId = null;
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
            if (!isModalVisible(overlay) || !e.touches || e.touches.length !== 1) return;
            const t = e.touches[0];
            startX = t.clientX;
            startY = t.clientY;
            startTs = Date.now();
            tracking = true;
        }, { passive: true });

        target.addEventListener('touchend', (e) => {
            if (!tracking || !isModalVisible(overlay) || !e.changedTouches || e.changedTouches.length === 0) return;
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



if (uploadPenPhotoArea) {
    uploadPenPhotoArea.onclick = async () => {
        if (!isElectron) return alert("Upload is only available in the Manager (Electron) app.");
        const filePath = await window.electronAPI.selectImage();
        if (filePath) {
            currentPenImagePath = filePath;
            if (uploadPenPreview) {
                // Setup onload BEFORE setting src to avoid race condition
                uploadPenPreview.onload = async () => {
                    let colors = null;
                    if (isElectron && window.electronAPI && typeof window.electronAPI.detectPenColors === 'function') {
                        try {
                            const result = await window.electronAPI.detectPenColors(filePath);
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
                };

                if (penPhotoControls) penPhotoControls.style.display = 'flex';
            }

            // Set src (using file:// protocol as per established pattern)
            uploadPenPreview.src = `file://${filePath}`;
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
            buttons: ['Keep Photo', 'Remove Photo'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        })) {
            currentPenImagePath = null;
            penImageRemoved = true; // Mark as explicitly removed
            currentPenSuggestedColors = [];
            currentPenRotation = 0;
            if (uploadPenPreview) {
                uploadPenPreview.src = '';
                uploadPenPreview.style.display = 'none';
            }
            if (penPhotoControls) penPhotoControls.style.display = 'none';
            if (penPhotoIcon) penPhotoIcon.style.display = 'block';
            if (penPhotoText) penPhotoText.style.display = 'block';
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
        if (!isElectron || !window.electronAPI || typeof window.electronAPI.exportBackup !== 'function') return;
        const result = await window.electronAPI.exportBackup();
        if (result && result.success) {
            refreshBackupStatus();
            alert(`Backup exported successfully:\n${result.path}`);
        } else if (!(result && result.canceled)) {
            alert(`Backup export failed: ${result && result.message ? result.message : 'Unknown error.'}`);
        }
    });
}

if (btnImportBackup) {
    btnImportBackup.addEventListener('click', async () => {
        if (!isElectron || !window.electronAPI || typeof window.electronAPI.importBackup !== 'function') return;
        const proceed = await confirmAction(
            'Importing a backup will replace your current data and may replace images. Continue?',
            'Import Backup'
        );
        if (!proceed) return;
        const result = await window.electronAPI.importBackup();
        if (result && result.success) {
            const reloaded = await window.electronAPI.loadData();
            if (reloaded) {
                appData = ensureAppDataDefaults(reloaded);
            }
            updateAutocompleteLists();
            renderDashboard();
            renderPens();
            renderInks();
            renderSwatches();
            renderActivityLogView();
            closeAllModals();
            refreshBackupStatus();
            alert('Backup imported successfully.');
        } else if (!(result && result.canceled)) {
            alert(`Backup import failed: ${result && result.message ? result.message : 'Unknown error.'}`);
        }
    });
}

if (btnSaveInk) btnSaveInk.addEventListener('click', saveNewInk);
if (btnSavePen) btnSavePen.addEventListener('click', saveNewPen);
if (btnDeleteInk) btnDeleteInk.addEventListener('click', deleteInk);
if (btnDeletePen) btnDeletePen.addEventListener('click', deletePen);
if (btnDeleteSwatchDetail) btnDeleteSwatchDetail.addEventListener('click', deleteCurrentSwatch);

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
    btn.addEventListener('click', closeAllModals);
});

// Nav Listeners
if (navDashboard) navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('dashboard');
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
if (recentActivityViewAll) {
    recentActivityViewAll.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('activity');
        renderActivityLogView();
    });
}
if (recentPensViewAll) {
    recentPensViewAll.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('pens');
        renderPens();
    });
}
if (recentInksViewAll) {
    recentInksViewAll.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('inks');
        renderInks();
    });
}
if (recentSwatchesViewAll) {
    recentSwatchesViewAll.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('swatches');
        renderSwatches();
    });
}

if (toggleActivityVisible) {
    toggleActivityVisible.addEventListener('change', () => {
        appData.preferences.show_activity_log = !!toggleActivityVisible.checked;
        if (shouldHideActivityInShowcase() && localStorage.getItem('lastView') === 'activity') {
            switchView('dashboard');
        }
        persistDataAndRefresh({
            refresh: {
                activity: true,
                dashboard: true
            },
            onErrorMessage: 'Failed to save activity visibility.'
        });
    });
}

if (toggleRecentActivityVisible) {
    toggleRecentActivityVisible.addEventListener('change', () => {
        appData.preferences.show_recent_activity = !!toggleRecentActivityVisible.checked;
        persistDataAndRefresh({
            refresh: {
                activity: true,
                dashboard: true
            },
            onErrorMessage: 'Failed to save dashboard activity visibility.'
        });
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
            buttons: ['Keep Logs', 'Clear All'],
            defaultId: 0,
            cancelId: 0,
            confirmedIndex: 1
        }))) return;

        appData.activity_log = [];
        persistActivityMaintenance('Failed to clear activity logs.');
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

document.addEventListener('click', (e) => {
    if (!activityCalendarPopover || !activityDatePickerToggle) return;
    if (!activityCalendarPopover.classList.contains('open')) return;
    if (activityCalendarPopover.contains(e.target) || activityDatePickerToggle.contains(e.target)) return;
    closeActivityCalendar();
});

if (activityLogContainer) {
    activityLogContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-delete-activity-id]');
        if (!btn) return;
        const activityId = btn.getAttribute('data-delete-activity-id');
        if (!(await confirmAction({
            title: 'Delete Activity Entry',
            message: 'Delete this activity entry?',
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
    const materials = [...new Set(pens.map(p => p.material).filter(Boolean))].sort();
    const fillingSystems = collectUniqueFromCsv(pens, 'filling_system');
    const colors = collectUniqueFromCsv(pens, 'color');
    const statuses = ['Inked', 'Resting'];

    const createGroup = (label, html) => `
        <div class="filter-group">
            <label style="font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: none; letter-spacing: 0;">${label}</label>
            ${html}
        </div>
    `;

    const createTagList = (category, options) => `
        <div class="filter-tags">
            ${options.map(opt => `<span class="filter-tag ${(activePensFilters[category] || []).includes(opt) ? 'active' : ''}" onclick="togglePenFilterTag('${category}', '${opt}')">${opt}</span>`).join('')}
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
    const lubOpts = ['Low', 'Medium', 'High'];
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
            <label style="font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: none; letter-spacing: 0;">${label}</label>
            ${html}
        </div>
    `;

    const createTagList = (category, options) => `
        <div class="filter-tags">
            ${options.map(opt => `<span class="filter-tag ${(activeInksFilters[category] || []).includes(opt) ? 'active' : ''}" onclick="toggleFilterTag('${category}', '${opt}')">${opt}</span>`).join('')}
        </div>
    `;

    const createVolumeTagList = (options) => `
        <div class="filter-tags">
            ${options.map(opt => `<span class="filter-tag ${(activeInksFilters.volume || []).includes(opt) ? 'active' : ''}" onclick="toggleFilterTag('volume', '${opt}')">${opt} cl</span>`).join('')}
        </div>
    `;

    container.innerHTML = `
        ${createGroup('Brand', createTagList('brand', brands))}
        ${createGroup('Color Group', `
            <div class="color-chips" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; min-height: 24px;">
                ${colors.length > 0 ? colors.map(c => `
                    <div class="color-chip ${(activeInksFilters.color || []).includes(c) ? 'active' : ''}" 
                         style="background: ${c}; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(0,0,0,0.3); box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex-shrink: 0;" 
                         onclick="toggleFilterTag('color', '${c}')"
                         title="${c}"></div>
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

    const swatches = appData.inks.filter(i => i.image && i.is_swatch);
    const brands = [...new Set(swatches.map(i => i.brand).filter(Boolean))].sort();
    const types = ['Bottle', 'Sample', 'Cartridge'];
    const flowOpts = ['Dry', 'Average', 'Wet'];
    const lubOpts = ['Low', 'Medium', 'High'];
    const dryTimeOpts = ['Fast', 'Average', 'Slow'];
    const baseTypes = [...new Set(swatches.flatMap(i => i.base_type || []))].sort();
    const permanences = [...new Set(swatches.map(i => i.permanence).filter(Boolean))].sort();

    const colorHexes = new Set();
    swatches.forEach(s => { if (s.color_base) colorHexes.add(s.color_base); });

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
            <label style="font-size: 15px; font-weight: 700; color: var(--color-text-main); text-transform: none; letter-spacing: 0;">${label}</label>
            ${html}
        </div>
    `;

    const createTagList = (category, options) => `
        <div class="filter-tags">
            ${options.map(opt => `<span class="filter-tag ${(activeSwatchesFilters[category] || []).includes(opt) ? 'active' : ''}" onclick="toggleSwatchFilterTag('${category}', '${opt}')">${opt}</span>`).join('')}
        </div>
    `;

    container.innerHTML = `
        ${createGroup('Brand', createTagList('brand', brands))}
        ${createGroup('Color Group', `
            <div class="color-chips" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; min-height: 24px;">
                ${colors.length > 0 ? colors.map(c => `
                    <div class="color-chip ${(activeSwatchesFilters.color || []).includes(c) ? 'active' : ''}" 
                         style="background: ${c}; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(0,0,0,0.3); box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex-shrink: 0;" 
                         onclick="toggleSwatchFilterTag('color', '${c}')"
                         title="${c}"></div>
                `).join('') : '<span style="color: #999; font-size: 13px; font-style: italic; display: block;">No colors detected.</span>'}
            </div>
        `)}
        ${createGroup('Flow', createTagList('flow', flowOpts))}
        ${createGroup('Lubrication', createTagList('lubrication', lubOpts))}
        ${createGroup('Dry Time', createTagList('dryTime', dryTimeOpts))}
        ${createGroup('Type', createTagList('type', types))}
        ${createGroup('Base Type', createTagList('baseType', baseTypes))}
        ${createGroup('Permanence', createTagList('permanence', permanences))}
    `;

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
                if (isElectron) {
                    openInkModal(ink.id);
                } else {
                    openSwatchDetailModal(ink.id, 'inks');
                }
            };

            // Consistently use gradient for list view
            const bgStyle = `background: linear-gradient(135deg, ${ink.color_base || '#ccc'}, ${ink.color_accent || ink.color_base || '#999'})`;

            // Swatch Indicator
            const hasSwatch = (ink.image && ink.is_swatch) ? '<i class="ph-fill ph-image" style="color: var(--color-accent); margin-left: auto;"></i>' : '';

            card.innerHTML = `
                <div class="ink-swatch-bg" style="${bgStyle}; height: 100px;"></div>
                <div class="card-content">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <div class="pen-name" style="font-size: 15px; font-weight: 600;">${ink.name}</div>
                            <div class="pen-detail" style="font-size: 12px; color: #666;">${ink.brand || ''}</div>
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

    // Filter inks that have images AND are explicitly marked as swatches
    let swatches = appData.inks.filter(i => i.image && i.is_swatch);

    // 1. Apply Search Filter
    if (searchSwatchesQuery) {
        const q = searchSwatchesQuery.toLowerCase();
        swatches = swatches.filter(ink =>
            ink.name.toLowerCase().includes(q) ||
            (ink.brand && ink.brand.toLowerCase().includes(q))
        );
    }

    // 2. Apply Custom Filters
    swatches = swatches.filter(ink => {
        if (activeSwatchesFilters.brand.length > 0 && !activeSwatchesFilters.brand.includes(ink.brand)) return false;
        if (activeSwatchesFilters.type.length > 0 && !activeSwatchesFilters.type.includes(ink.type)) return false;
        if (activeSwatchesFilters.flow.length > 0 && !activeSwatchesFilters.flow.includes(ink.flow)) return false;
        if (activeSwatchesFilters.lubrication.length > 0 && !activeSwatchesFilters.lubrication.includes(ink.lubrication)) return false;
        if (activeSwatchesFilters.dryTime.length > 0 && !activeSwatchesFilters.dryTime.includes(ink.dry_time)) return false;
        if (activeSwatchesFilters.permanence.length > 0 && !activeSwatchesFilters.permanence.includes(ink.permanence)) return false;

        if (activeSwatchesFilters.color.length > 0 && !activeSwatchesFilters.color.includes(ink.color_base)) return false;

        if (activeSwatchesFilters.baseType.length > 0) {
            const inkBaseTypes = ink.base_type || [];
            if (!activeSwatchesFilters.baseType.some(bt => inkBaseTypes.includes(bt))) return false;
        }
        return true;
    });

    // 3. Apply Sorting
    swatches.sort((a, b) => {
        if (activeSwatchesSort === 'name-asc') return a.name.localeCompare(b.name);
        if (activeSwatchesSort === 'name-desc') return b.name.localeCompare(a.name);
        if (activeSwatchesSort === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
        if (activeSwatchesSort === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
        if (activeSwatchesSort === 'newest') return b.id.localeCompare(a.id);
        if (activeSwatchesSort === 'oldest') return a.id.localeCompare(b.id);
        return 0;
    });

    if (swatches.length === 0) {
        grid.innerHTML = `<div class="empty-state">No swatches found.</div>`;
        return;
    }

    swatches.forEach(ink => {
        const card = document.createElement('div');
        card.className = 'inked-card glass-panel';
        card.style.cursor = 'pointer';
        card.onclick = () => openSwatchDetailModal(ink.id, 'swatches');

        const imagePath = ink.image.startsWith('data:') ? ink.image : `images/${ink.image}`;

        card.innerHTML = `
            <div class="ink-swatch-bg" style="height: 150px; background-image: url('${imagePath}'); background-size: cover; background-position: center;"></div>
            <div class="card-content">
                <div class="pen-name" style="font-weight: 600;">${ink.name}</div>
                <div class="pen-detail" style="font-size: 12px; color: #666;">${ink.brand}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function isModalVisible(modalEl) {
    return !!(modalEl && getComputedStyle(modalEl).display !== 'none');
}

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
    let swatches = appData.inks.filter(i => i.image && i.is_swatch);

    if (searchSwatchesQuery) {
        const q = searchSwatchesQuery.toLowerCase();
        swatches = swatches.filter(ink =>
            ink.name.toLowerCase().includes(q) ||
            (ink.brand && ink.brand.toLowerCase().includes(q))
        );
    }

    swatches = swatches.filter(ink => {
        if (activeSwatchesFilters.brand.length > 0 && !activeSwatchesFilters.brand.includes(ink.brand)) return false;
        if (activeSwatchesFilters.type.length > 0 && !activeSwatchesFilters.type.includes(ink.type)) return false;
        if (activeSwatchesFilters.flow.length > 0 && !activeSwatchesFilters.flow.includes(ink.flow)) return false;
        if (activeSwatchesFilters.lubrication.length > 0 && !activeSwatchesFilters.lubrication.includes(ink.lubrication)) return false;
        if (activeSwatchesFilters.dryTime.length > 0 && !activeSwatchesFilters.dryTime.includes(ink.dry_time)) return false;
        if (activeSwatchesFilters.permanence.length > 0 && !activeSwatchesFilters.permanence.includes(ink.permanence)) return false;
        if (activeSwatchesFilters.color.length > 0 && !activeSwatchesFilters.color.includes(ink.color_base)) return false;
        if (activeSwatchesFilters.baseType.length > 0) {
            const inkBaseTypes = ink.base_type || [];
            if (!activeSwatchesFilters.baseType.some(bt => inkBaseTypes.includes(bt))) return false;
        }
        return true;
    });

    swatches.sort((a, b) => {
        if (activeSwatchesSort === 'name-asc') return a.name.localeCompare(b.name);
        if (activeSwatchesSort === 'name-desc') return b.name.localeCompare(a.name);
        if (activeSwatchesSort === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
        if (activeSwatchesSort === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
        if (activeSwatchesSort === 'newest') return b.id.localeCompare(a.id);
        if (activeSwatchesSort === 'oldest') return a.id.localeCompare(b.id);
        return 0;
    });

    return swatches;
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
document.getElementById('btn-sort-inks')?.addEventListener('click', (e) => {
    e.stopPropagation();
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

// Header buttons still active for their respective views
if (document.getElementById('btn-add-pen-header')) document.getElementById('btn-add-pen-header').onclick = () => openPenModal();
if (document.getElementById('btn-add-ink-header')) document.getElementById('btn-add-ink-header').onclick = () => openInkModal();



document.addEventListener('click', () => {
    const dropdownInk = document.getElementById('sort-dropdown');
    if (dropdownInk) dropdownInk.style.display = 'none';
    const dropdownPen = document.getElementById('sort-dropdown-pens');
    if (dropdownPen) dropdownPen.style.display = 'none';
    const dropdownSwatch = document.getElementById('sort-dropdown-swatches');
    if (dropdownSwatch) dropdownSwatch.style.display = 'none';
});

// Event Listeners for Filters/Sort (Swatches)
document.getElementById('btn-sort-swatches')?.addEventListener('click', (e) => {
    e.stopPropagation();
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
        lubrication: [], dryTime: [], baseType: [], permanence: []
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

// Click outside to close Filters
// Click outside to close Filters
document.addEventListener('click', (e) => {
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
    autocompleteData['pen-material-input'] = getUnique(appData.pens, 'material');
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
    document.querySelectorAll('.autocomplete-input').forEach(input => {
        const wrapper = input.parentElement;
        const list = wrapper.querySelector('.custom-options');

        if (!list) return;

        input.addEventListener('input', () => {
            const val = input.value.toLowerCase().trim();
            const id = input.id; // e.g., ink-brand-input
            const data = autocompleteData[id] || [];

            if (!val) {
                list.classList.remove('show');
                return;
            }

            // Fuzzy Filter Logic: StartsWith Prio -> Includes
            const startsWith = data.filter(item => item.toLowerCase().startsWith(val));
            const includes = data.filter(item => !item.toLowerCase().startsWith(val) && item.toLowerCase().includes(val));
            const matches = [...startsWith, ...includes];

            if (matches.length > 0) {
                list.innerHTML = matches.map(item => `<div class="custom-option">${item}</div>`).join('');
                list.classList.add('show');

                // Re-bind option clicks for new elements
                list.querySelectorAll('.custom-option').forEach(opt => {
                    opt.addEventListener('click', (e) => {
                        e.stopPropagation();
                        input.value = opt.textContent;
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
        // Close Custom Selects/Autocompletes
        if (!e.target.closest('.custom-select-wrapper-outer') && !e.target.closest('.custom-autocomplete-wrapper')) {
            document.querySelectorAll('.custom-options.show').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.custom-select-trigger.open').forEach(el => el.classList.remove('open'));
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

            if (trigger && hiddenInput) {
                const val = option.dataset.value;
                const text = option.textContent;

                hiddenInput.value = val;
                trigger.querySelector('span').textContent = text;

                trigger.classList.remove('open');
                container.classList.remove('show');

                // Active state
                container.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            }
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

function openAddSwatchModal() {
    closeAllModals(); // Close ink/pen modals if open
    if (modalAddSwatch) {
        activateModal(modalAddSwatch);
        populateInkSelect('fetch-swatch-ink-wrapper', 'fetch-swatch-ink-options', 'fetch-swatch-ink-input');
        resetSwatchForm();
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

function resetSwatchForm() {
    currentSwatchSource = 'auto';
    currentSwatchImageCandidate = null;
    currentUploadPath = null;
    setSwatchValidation('');

    const inkInput = document.getElementById('fetch-swatch-ink-input');
    if (inkInput) inkInput.value = '';
    const inkWrapper = document.getElementById('fetch-swatch-ink-wrapper');
    if (inkWrapper) {
        const cv = inkWrapper.querySelector('.current-value');
        if (cv) cv.textContent = 'Select an ink...';
    }

    const nameAuto = document.getElementById('fetch-swatch-name-auto');
    if (nameAuto) nameAuto.value = '';
    const manualUrl = document.getElementById('fetch-swatch-url-manual');
    if (manualUrl) manualUrl.value = '';

    const paper = document.getElementById('swatch-paper-input');
    const nib = document.getElementById('swatch-nib-input');
    const date = document.getElementById('swatch-date-input');
    const notes = document.getElementById('swatch-notes-input');
    if (paper) paper.value = '';
    if (nib) nib.value = '';
    if (date) date.value = new Date().toISOString().slice(0, 10);
    if (notes) notes.value = '';
    setCustomSelectValue('swatch-lighting-input', 'Unknown');

    setSwatchSource('auto');
    setSwatchPreviewState('empty');
    updateSwatchControlsState();
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
    const fileUrl = `file://${path}`;
    const ok = await setSwatchPreviewFromUrl(fileUrl);
    if (ok) {
        currentSwatchImageCandidate = { type: 'upload', value: path };
        currentUploadPath = path;
        updateSwatchControlsState();
    }
    return ok;
}

// Overwrite populateInkSelect to add click logic securely
function populateInkSelect(wrapperId, optionsId, inputId) {
    const optionsContainer = document.getElementById(optionsId);
    if (!optionsContainer) return;

    const sortedInks = [...getLibraryInks()].sort((a, b) => a.name.localeCompare(b.name));

    optionsContainer.innerHTML = sortedInks.map(ink =>
        `<div class="custom-option" data-value="${ink.id}">${ink.brand ? ink.brand + ' ' : ''}${ink.name}</div>`
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
        const result = await window.electronAPI.fetchInkSwatch(query);
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
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch (_) {
        setSwatchValidation('Enter a valid http/https URL.');
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
    const path = await window.electronAPI.selectImage();
    if (!path) return;
    setSwatchValidation('');
    await setSwatchPreviewFromUpload(path);
});

document.getElementById('btn-save-swatch-unified')?.addEventListener('click', async () => {
    const inkId = document.getElementById('fetch-swatch-ink-input')?.value;
    if (!inkId) {
        setSwatchValidation('Please select an ink.');
        return;
    }
    if (!currentSwatchImageCandidate) {
        setSwatchValidation('Please add a swatch image.');
        return;
    }

    const ink = appData.inks.find(i => i.id === inkId);
    const imageMetadata = ink ? { brand: ink.brand, model: ink.name } : { brand: 'unknown', model: 'ink' };
    const swatchMetadata = getSwatchMetadataPayload();
    let savedFilename = null;

    if (currentSwatchImageCandidate.type === 'upload') {
        savedFilename = await window.electronAPI.saveImage(currentSwatchImageCandidate.value, 'swatch', imageMetadata);
    } else if (currentSwatchImageCandidate.type === 'url') {
        const result = await window.electronAPI.saveImageUrl(currentSwatchImageCandidate.value, 'swatch', imageMetadata);
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

// Helper to Update App Data
async function updateInkWithImage(inkId, filename, swatchMetadata = null) {
    const inkIndex = appData.inks.findIndex(i => i.id === inkId);
    if (inkIndex !== -1) {
        appData.inks[inkIndex].image = filename;
        appData.inks[inkIndex].is_swatch = true; // Explicitly marked as swatch via swatch flow
        appData.inks[inkIndex].is_orphan_swatch = false;
        if (swatchMetadata) {
            appData.inks[inkIndex].swatch_paper = swatchMetadata.swatch_paper || '';
            appData.inks[inkIndex].swatch_nib = swatchMetadata.swatch_nib || '';
            appData.inks[inkIndex].swatch_date = swatchMetadata.swatch_date || '';
            appData.inks[inkIndex].swatch_lighting = swatchMetadata.swatch_lighting || 'Unknown';
            appData.inks[inkIndex].swatch_notes = swatchMetadata.swatch_notes || '';
        }
        logActivity('created', 'swatch', `Added swatch for ${formatInkName(appData.inks[inkIndex])}.`, { entityId: inkId });
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
}

// DOM Elements
