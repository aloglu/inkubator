(function () {
    function createModalLifecycle(options = {}) {
        const focusWindow = typeof options.focusWindow === 'function' ? options.focusWindow : null;

        function reviveModalInputs(modalEl) {
            if (!modalEl) return;
            modalEl.querySelectorAll('input, textarea, select, button').forEach(el => {
                el.disabled = false;
                el.readOnly = false;
                el.style.pointerEvents = 'auto';
            });
        }

        function closeAllModals(modals = []) {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }

            document.querySelectorAll('.custom-options.show').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.custom-select-trigger.open').forEach(el => el.classList.remove('open'));

            modals.forEach(modalEl => {
                if (!modalEl) return;
                modalEl.style.display = 'none';
                modalEl.style.pointerEvents = 'none';
            });
        }

        function resetOverlayState() {
            const dropdownInk = document.getElementById('sort-dropdown');
            if (dropdownInk) dropdownInk.style.display = 'none';
            const dropdownPen = document.getElementById('sort-dropdown-pens');
            if (dropdownPen) dropdownPen.style.display = 'none';
            const dropdownSwatch = document.getElementById('sort-dropdown-swatches');
            if (dropdownSwatch) dropdownSwatch.style.display = 'none';

            const sidebarInks = document.getElementById('filter-sidebar');
            if (sidebarInks) {
                sidebarInks.classList.remove('active');
                sidebarInks.style.display = 'none';
            }
            const sidebarPens = document.getElementById('filter-sidebar-pens');
            if (sidebarPens) {
                sidebarPens.classList.remove('active');
                sidebarPens.style.display = 'none';
            }
            const sidebarSwatches = document.getElementById('filter-sidebar-swatches');
            if (sidebarSwatches) {
                sidebarSwatches.classList.remove('active');
                sidebarSwatches.style.display = 'none';
            }

            document.querySelectorAll('.custom-options.show').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.custom-select-trigger.open').forEach(el => el.classList.remove('open'));

            document.querySelectorAll('.multiselect-dropdown.open').forEach(el => {
                el.classList.remove('open');
                const opts = el.querySelector('.multiselect-options');
                if (opts) opts.classList.remove('show');
            });

            document.querySelectorAll('[popover]').forEach(el => {
                if (typeof el.hidePopover === 'function') {
                    try {
                        el.hidePopover();
                    } catch (error) {
                        // Ignore if not open or unsupported.
                    }
                }
            });
        }

        function activateModal(modalEl) {
            if (!modalEl) return;
            if (typeof window.focus === 'function') {
                window.focus();
            }
            if (focusWindow) {
                focusWindow();
            }

            modalEl.style.display = 'flex';
            modalEl.style.pointerEvents = 'auto';
            modalEl.style.zIndex = '6000';

            const inner = modalEl.querySelector('.modal');
            if (inner) inner.style.zIndex = '6001';

            reviveModalInputs(modalEl);

            if (!modalEl.dataset.focusHandler) {
                modalEl.addEventListener('mousedown', (e) => {
                    const target = e.target.closest('input, textarea, select, button');
                    if (target) target.focus();
                });
                modalEl.dataset.focusHandler = 'true';
            }

            setTimeout(() => {
                const first = Array.from(modalEl.querySelectorAll('input, textarea, select, button')).find(el => {
                    if (el.disabled || el.readOnly) return false;
                    if (el.type === 'hidden') return false;
                    return el.offsetParent !== null;
                });
                if (first) first.focus();
            }, 0);
        }

        return {
            activateModal,
            closeAllModals,
            resetOverlayState,
            reviveModalInputs
        };
    }

    window.PenStationModalLifecycle = {
        createModalLifecycle
    };
})();
