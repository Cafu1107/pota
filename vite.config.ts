import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Plain ESM module shared with the standalone server (server/start.mjs).
import { createProxyMiddleware, prewarm } from './server/proxy.mjs';

// "/pota/" for the GitHub Pages build (project site), "/" everywhere else.
const base = process.env.VITE_BASE || '/';

/** When data comes from a hosted proxy (Pages build), open that connection before the app asks. */
function proxyPreconnect(): Plugin {
  return {
    name: 'pota-proxy-preconnect',
    transformIndexHtml() {
      const proxy = process.env.VITE_PROXY_BASE;
      if (!proxy || !/^https?:\/\//.test(proxy)) return;
      return [{ tag: 'link', attrs: { rel: 'preconnect', href: new URL(proxy).origin, crossorigin: '' }, injectTo: 'head-prepend' }];
    },
  };
}

function potaProxy(): Plugin {
  return {
    name: 'pota-proxy',
    configureServer(server) {
      server.middlewares.use(createProxyMiddleware());
      prewarm();
    },
    configurePreviewServer(server) {
      server.middlewares.use(createProxyMiddleware());
      prewarm();
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    potaProxy(),
    proxyPreconnect(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Pota — Basketbol skorları ve istatistikleri',
        short_name: 'Pota',
        description:
          'Canlı basketbol skorları, box score, şut haritası, puan durumu, takım ve oyuncu istatistikleri. BSL, EuroLeague, NBA ve daha fazlası.',
        lang: 'tr',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#101318',
        background_color: '#101318',
        categories: ['sports'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/\/proxy\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Browsers fetch font subsets on demand; only precache the ones Turkish/English text uses.
        globIgnores: ['**/*vietnamese*'],
        runtimeCaching: [
          {
            // Last known data for offline launches; live freshness comes from the network.
            urlPattern: ({ url }) => url.pathname.startsWith('/proxy/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pota-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 2 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'pota-images',
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
