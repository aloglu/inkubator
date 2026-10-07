/**
 * A small history router. Links with an `href` starting with "/" are handled
 * by `navigate`, so plain <a href> works. Addresses from 2.x and early 3.0
 * builds under /admin are redirected to the same page without it.
 */

class Router {
  path = $state(location.pathname);
  query = $state(new URLSearchParams(location.search));

  constructor() {
    this.sync();
    addEventListener('popstate', () => this.sync());
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
      event.preventDefault();
      this.navigate(url.pathname + url.search + url.hash);
    });
  }

  navigate(to: string, { replace = false } = {}) {
    if (to === location.pathname + location.search + location.hash) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', to);
    this.sync();
    if (!replace) scrollTo(0, 0);
  }

  private sync() {
    if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
      const path = location.pathname.slice('/admin'.length) || '/';
      history.replaceState(null, '', path + location.search + location.hash);
    }
    this.path = location.pathname;
    this.query = new URLSearchParams(location.search);
  }
}

/** Paths served by this app rather than by the server directly. */
function isAppPath(path: string) {
  return !path.startsWith('/api/') && !path.startsWith('/auth/') && !path.startsWith('/public/');
}

export const router = new Router();
