import { defineConfig, type ProxyOptions } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In development the Rust server runs separately (`cargo run -p inkubator-server`
// with PORT=18080); API, sign-in and showcase photo requests are forwarded to it.
// The proxy rewrites Host to the server's address, so the original host is
// passed on as X-Forwarded-Host for the server's same-origin check.
const server: ProxyOptions = {
  target: 'http://127.0.0.1:18080',
  configure: (proxy) => {
    proxy.on('proxyReq', (request, incoming) => {
      const host = incoming.headers.host;
      if (typeof host === 'string') request.setHeader('x-forwarded-host', host);
    });
  },
};

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/auth': server,
      '/public': server,
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
