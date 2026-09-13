import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',

  devtools: { enabled: false },

  srcDir: 'app/',
  serverDir: 'server/',
  dir: { public: '../public' },

  modules: ['@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    pgliteDir: process.env.PGLITE_DIR || '.data/pglite',
    storePinHash: process.env.STORE_PIN_HASH || '',
    storeUsername: process.env.STORE_USERNAME || 'admin',
    storeDisplayName: process.env.STORE_DISPLAY_NAME || 'Administrator',
    storePasswordHash: process.env.STORE_PASSWORD_HASH || process.env.STORE_PIN_HASH || '',
    sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  },

  nitro: {
    experimental: {
      wasm: true,
    },
    // dir.public: '../public' below resolves against rootDir rather than
    // srcDir on this Nuxt/Nitro version, so the production build was
    // silently copying from a nonexistent <rootDir>/../public and shipping
    // with NO public assets at all - every icon and (now) font 404'd. This
    // pins the real, unambiguous location.
    publicAssets: [{ dir: fileURLToPath(new URL('./public', import.meta.url)) }],
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Tindahan',
      short_name: 'Tindahan',
      description: 'Inventory, sales, and profit tracking for your sari-sari store',
      theme_color: '#345b46',
      background_color: '#faf9f6',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'icons/storefront-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/storefront-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/storefront-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      // woff2 added for the self-hosted Plus Jakarta Sans files so the PWA
      // keeps its typeface offline instead of falling back to the system
      // stack once the network is gone.
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    },
    devOptions: {
      enabled: false,
    },
  },

  app: {
    head: {
      title: 'Tindahan',
      // titleTemplate needs a function (title) => string, which nuxt.config's
      // serializable app.head type doesn't accept - set at runtime instead,
      // in app/app.vue, right where the splash is also wired up.
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [{ name: 'theme-color', content: '#345b46' }],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/storefront-16.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/storefront-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/storefront-180.png' },
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/plus-jakarta-sans-latin.woff2', crossorigin: 'anonymous' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  typescript: {
    strict: true,
  },
})
