(function () {
    window.__INKUBATOR_DOCKER_MODE__ = true;

    function inferMode() {
        if (document.getElementById('docker-login-root')) return 'login';
        if (window.location.pathname.replace(/\/+$/, '') === '/admin' || window.location.pathname.startsWith('/admin/')) return 'admin';
        return 'public';
    }

    const mode = inferMode();

    function onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    function createSidebarAction(label, iconClass, className) {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || document.querySelector('.docker-sidebar-action')) return null;
        const wrap = document.createElement('div');
        wrap.className = 'docker-sidebar-action';
        const link = document.createElement('a');
        link.href = '#';
        link.className = `nav-item docker-sidebar-nav-item ${className || ''}`.trim();
        link.innerHTML = `<i class="ph ${iconClass}"></i><span>${label}</span>`;
        wrap.appendChild(link);
        sidebar.appendChild(wrap);
        return link;
    }

    async function logout() {
        try {
            await fetch('/auth/logout', { method: 'POST' });
        } finally {
            window.location.href = '/';
        }
    }

    function showLoginPanel() {
        let root = document.getElementById('docker-login-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'docker-login-root';
            document.body.appendChild(root);
        }
        if (!root) return;
        root.innerHTML = `
            <div class="modal-overlay docker-login-modal-overlay" id="docker-login-modal" style="display: flex;">
                <section class="modal glass-panel docker-login-card" aria-labelledby="docker-login-title">
                    <h2 id="docker-login-title" class="sr-only">Login</h2>
                    <form id="docker-login-form" class="docker-login-form">
                        <label>
                            <span>Username</span>
                            <input id="docker-login-username" name="username" type="text" autocomplete="username" required autofocus>
                        </label>
                        <label>
                            <span>Password</span>
                            <input id="docker-login-password" name="password" type="password" autocomplete="current-password" required>
                        </label>
                        <p id="docker-login-error" class="docker-login-error" role="alert"></p>
                        <div class="docker-login-actions">
                            <button type="submit">Login</button>
                            <button class="docker-login-cancel" type="button">Cancel</button>
                        </div>
                    </form>
                </section>
            </div>
        `;

        const modal = document.getElementById('docker-login-modal');
        const cancel = root.querySelector('.docker-login-cancel');
        const closeLogin = () => {
            root.innerHTML = '';
            document.removeEventListener('keydown', handleLoginKeydown);
            if (window.location.search.includes('login=1')) {
                window.history.replaceState({}, '', window.location.pathname || '/');
            }
        };
        const handleLoginKeydown = (event) => {
            if (event.key === 'Escape') closeLogin();
        };
        if (cancel) cancel.addEventListener('click', closeLogin);
        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeLogin();
            });
        }
        document.addEventListener('keydown', handleLoginKeydown);
        requestAnimationFrame(() => {
            const username = document.getElementById('docker-login-username');
            if (username) {
                username.focus();
                username.select();
            }
        });

        const form = document.getElementById('docker-login-form');
        const error = document.getElementById('docker-login-error');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            error.textContent = '';
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            button.textContent = 'Signing in...';
            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('docker-login-username').value,
                        password: document.getElementById('docker-login-password').value
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || 'Invalid username or password.');
                }
                window.location.href = '/admin/';
            } catch (loginError) {
                error.textContent = loginError && loginError.message ? loginError.message : 'Could not sign in.';
                button.disabled = false;
                button.textContent = 'Login';
            }
        });
    }

    function showStandaloneLoginPanel() {
        const root = document.getElementById('docker-login-root');
        if (!root) return;
        root.innerHTML = `
            <div class="docker-login-backdrop">
                <section class="docker-login-card docker-login-card-standalone" aria-labelledby="docker-login-title">
                    <div class="docker-login-brand">
                        <img src="/assets/brand/inkubator-logo-transparent.png" alt="" aria-hidden="true">
                        <h1 id="docker-login-title">Inkubator</h1>
                    </div>
                    <form id="docker-login-form" class="docker-login-form">
                        <label>
                            <span>Username</span>
                            <input id="docker-login-username" name="username" type="text" autocomplete="username" required autofocus>
                        </label>
                        <label>
                            <span>Password</span>
                            <input id="docker-login-password" name="password" type="password" autocomplete="current-password" required>
                        </label>
                        <p id="docker-login-error" class="docker-login-error" role="alert"></p>
                        <button type="submit">Login</button>
                    </form>
                </section>
            </div>
        `;

        const form = document.getElementById('docker-login-form');
        const error = document.getElementById('docker-login-error');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            error.textContent = '';
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            button.textContent = 'Signing in...';
            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: document.getElementById('docker-login-username').value,
                        password: document.getElementById('docker-login-password').value
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || 'Invalid username or password.');
                }
                window.location.href = '/admin/';
            } catch (loginError) {
                error.textContent = loginError && loginError.message ? loginError.message : 'Could not sign in.';
                button.disabled = false;
                button.textContent = 'Login';
            }
        });
    }

    onReady(() => {
        if (mode === 'public') {
            const button = createSidebarAction('Manage', 'ph-lock-key', 'docker-sidebar-button-manage');
            if (button) {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    showLoginPanel();
                });
            }
            if (new URLSearchParams(window.location.search).get('login') === '1') {
                showLoginPanel();
            }
        } else if (mode === 'admin') {
            const button = createSidebarAction('Logout', 'ph-sign-out', 'docker-sidebar-button-logout');
            if (button) {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    logout();
                });
            }
        } else if (mode === 'login') {
            showStandaloneLoginPanel();
        }
    });
})();
