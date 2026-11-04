// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    'nuxt-umami'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  ui: {
    experimental: {
      // Generate styles only for Nuxt UI components found in the current application.
      componentDetection: true
    }
  },

  // Server-only settings. Set them with environment variables on the server, never in the repo
  // (NUXT_SUPABASE_URL, NUXT_REVIEW_SECRET, ...). See the README.
  runtimeConfig: {
    // Optional launch-day override (`NUXT_DAILY_WORD_EPOCH`); when empty the shared constant is used.
    dailyWordEpoch: '',
    supabase: {
      url: '',
      // Secret key for all database access. Server only, never expose it to the browser.
      serviceRoleKey: ''
    },
    reviewSecret: '',
    adminSessionPassword: '',
    challengeRateLimit: {
      create: 5,
      join: 20,
      action: 240,
      windowSeconds: 600
    },
    submissionRateLimit: {
      max: 10,
      windowSeconds: 600
    }
  },

  // Static marketing and games pages are prerendered at build time; atlas and other database-backed
  // routes render on the server per request. The /api routes run in the Node server build.
  routeRules: {
    '/': { prerender: true },
    '/en': { prerender: true },
    '/potkalnicko-prigorje/igre/kartice': { redirect: { to: '/potkalnicko-prigorje/uci?teme=rijeci', statusCode: 301 }, prerender: false },
    '/potkalnicko-prigorje/uci': { prerender: true },
    '/potkalnicko-prigorje/uci/sesija': { prerender: true },
    '/potkalnicko-prigorje/igre/kviz': { prerender: true },
    '/potkalnicko-prigorje/igre/kak-se-veli': { prerender: true },
    '/potkalnicko-prigorje/igre/grupiraj': { prerender: true },
    '/potkalnicko-prigorje/igre/bez-greske': { prerender: true },
    '/potkalnicko-prigorje/igre/karta': { prerender: true },
    '/potkalnicko-prigorje/igre/koje-je-selo': { prerender: true },
    '/potkalnicko-prigorje/igre/uci-kartu': { prerender: true },
    '/potkalnicko-prigorje/igre/rijeci': { redirect: { to: '/potkalnicko-prigorje/igre?tema=rijeci', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/crkve': { redirect: { to: '/potkalnicko-prigorje/igre?tema=bastina', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/zemljopis': { redirect: { to: '/potkalnicko-prigorje/igre?tema=mjesta', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/poznati-ljudi': { redirect: { to: '/potkalnicko-prigorje/igre?tema=osobe', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/legende': { redirect: { to: '/potkalnicko-prigorje/igre?tema=legende', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/povijest': { redirect: { to: '/potkalnicko-prigorje/igre', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/sport': { redirect: { to: '/potkalnicko-prigorje/igre', statusCode: 301 } },
    '/potkalnicko-prigorje/igre/**': { prerender: true },
    '/potkalnicko-prigorje/doprinesi': { prerender: true },
    '/potkalnicko-prigorje/o-projektu': { prerender: true },
    '/potkalnicko-prigorje/privatnost': { prerender: true },
    '/admin/**': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    // The unified inbox replaced the submissions list and the heritage corrections queue.
    '/admin/prilozi': { redirect: { to: '/admin/prijedlozi', statusCode: 301 } },
    '/admin/bastina-ispravci': { redirect: { to: '/admin/prijedlozi?targetKind=heritage_item&status=all', statusCode: 301 } },
    '/api/**': { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    baseUrl: 'https://karlo-siladi.from.hr',
    defaultLocale: 'hr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    locales: [
      { code: 'hr', language: 'hr-HR', name: 'Hrvatski', file: 'hr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' }
    ]
  },

  // Umami Cloud analytics, proxied through our own /api/savory route so ad blockers don't
  // drop it. The module auto-tracks; app/plugins/umami.client.ts disables it on /admin.
  umami: {
    id: 'c554cf77-732f-4f2d-bfbc-5f0b78492f4c',
    host: 'https://cloud.umami.is',
    proxy: 'cloak',
    domains: ['karlo-siladi.from.hr'],
    ignoreLocalhost: true
  }
})
