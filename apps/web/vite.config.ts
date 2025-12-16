import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // ─────────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT
  // ─────────────────────────────────────────────────────────────────────────────
  // Points to monorepo root where .env files live
  // Without this, Vite would only look for .env in apps/web/
  envDir: '../../',

  // ─────────────────────────────────────────────────────────────────────────────
  // PLUGINS
  // ─────────────────────────────────────────────────────────────────────────────
  plugins: [
    // SWC-based React plugin (20x faster than Babel)
    // SWC is a Rust-based compiler that replaces Babel for transforming JSX/TSX
    // Result: Faster dev server startup and hot module replacement (HMR)
    react(),

    // Tailwind CSS v4 native Vite plugin
    // Processes CSS with Tailwind at build time, no PostCSS config needed
    tailwindcss(),

    // Progressive Web App (PWA) support
    // Allows the app to work offline and be installed on devices
    VitePWA({
      // Auto-update the service worker when new content is available
      registerType: 'autoUpdate',
      // Static assets to cache for offline use
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      // PWA manifest - defines how the app appears when installed
      manifest: {
        name: 'Portfolio Aggregator',
        short_name: 'Portfolio',
        description: 'Track your investments across all brokers',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone', // Hides browser UI when installed
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      // Workbox config - controls service worker caching strategies
      workbox: {
        // Which files to pre-cache (available offline immediately)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime caching - how to handle requests that aren't pre-cached
        runtimeCaching: [
          {
            // Cache API calls with network-first strategy
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst', // Try network, fall back to cache
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 24 hours
            },
          },
        ],
      },
    }),
  ],

  // ─────────────────────────────────────────────────────────────────────────────
  // DEV SERVER
  // ─────────────────────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    strictPort: true, // Fail if port is taken (don't auto-increment)
    // Pre-transform frequently used files on startup
    // This "warms up" the server so first page load is faster
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/components/*.tsx'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BUILD (Production)
  // ─────────────────────────────────────────────────────────────────────────────
  build: {
    // Target modern browsers only (smaller, faster code)
    // 'esnext' means latest ECMAScript features, no legacy transforms
    target: 'esnext',

    // Generate source maps for debugging production issues
    // true = separate .map files (doesn't bloat main bundle)
    sourcemap: true,

    // Rollup is the bundler Vite uses for production builds
    rollupOptions: {
      output: {
        // Manual chunk splitting - controls how code is split into files
        // This improves caching: vendor code changes rarely, your code changes often
        manualChunks: {
          // Put React in its own chunk - it rarely changes
          // Users cache it once and don't re-download on your updates
          vendor: ['react', 'react-dom'],
          // Put TanStack libraries together - they're closely related
          tanstack: ['@tanstack/react-query', '@tanstack/react-router'],
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DEPENDENCY OPTIMIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  optimizeDeps: {
    // Pre-bundle these dependencies on dev server startup
    // Vite converts CommonJS deps to ESM and bundles them for faster loading
    // Without this, Vite discovers deps lazily which causes waterfall requests
    include: ['react', 'react-dom', '@tanstack/react-query', '@tanstack/react-router'],
  },
});
