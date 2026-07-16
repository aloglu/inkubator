(function () {
    function resolveMode(mode) {
        const normalized = String(mode || 'auto').toLowerCase();
        if (normalized === 'light' || normalized === 'dark') return normalized;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    }

    function applyTheme(mode) {
        if (!document.body) return;
        const effective = resolveMode(mode);
        document.body.classList.toggle('theme-dark', effective === 'dark');
        document.body.classList.toggle('theme-light', effective === 'light');
        document.body.setAttribute('data-theme', effective);
    }

    const publicMode = document.documentElement
        ? document.documentElement.getAttribute('data-inkubator-public-color-mode')
        : null;
    let mode = 'auto';
    try {
        mode = publicMode || window.__INKUBATOR_PUBLIC_COLOR_MODE__ || localStorage.getItem('inkubatorColorMode') || 'auto';
    } catch (_error) {
        mode = publicMode || window.__INKUBATOR_PUBLIC_COLOR_MODE__ || 'auto';
    }
    applyTheme(mode);
})();
