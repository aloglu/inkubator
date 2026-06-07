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

    let mode = 'auto';
    try {
        mode = localStorage.getItem('inkubatorColorMode') || 'auto';
    } catch (_error) {
        mode = 'auto';
    }
    applyTheme(mode);
})();
