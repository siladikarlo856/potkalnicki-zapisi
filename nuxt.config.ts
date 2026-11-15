// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n'
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
    public: {
      cloudflareAnalyticsToken: process.env.NUXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN || '56bd22857e3547448cffa5b62e2ffa7e'
    },
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
    '/en': { redirect: { to: '/', statusCode: 301 } },
    '/igre/kartice': { redirect: { to: '/uci?teme=rijeci', statusCode: 301 }, prerender: false },
    '/uci': { prerender: true },
    '/uci/sesija': { prerender: true },
    '/igre/kviz': { prerender: true },
    '/igre/kak-se-veli': { prerender: true },
    '/igre/opcine': { prerender: true },
    '/igre/sela-i-opcine': { prerender: true },
    '/igre/nabroji': { prerender: true },
    '/igre/grupiraj': { prerender: true },
    '/igre/bez-greske': { prerender: true },
    '/igre/karta': { prerender: true },
    '/igre/koje-je-selo': { prerender: true },
    '/igre/uci-kartu': { prerender: true },
    '/igre/gdje-je-crkva': { prerender: true },
    '/igre/spoji': { prerender: true },
    '/igre/rijeci': { redirect: { to: '/igre?tema=rijeci', statusCode: 301 } },
    '/igre/crkve': { redirect: { to: '/igre?tema=bastina', statusCode: 301 } },
    '/igre/zemljopis': { redirect: { to: '/igre?tema=mjesta', statusCode: 301 } },
    '/igre/poznati-ljudi': { redirect: { to: '/igre?tema=osobe', statusCode: 301 } },
    '/igre/legende': { redirect: { to: '/igre?tema=legende', statusCode: 301 } },
    '/igre/povijest': { redirect: { to: '/igre', statusCode: 301 } },
    '/igre/sport': { redirect: { to: '/igre', statusCode: 301 } },
    '/igre/**': { prerender: true },
    '/doprinesi': { prerender: true },
    '/o-projektu': { prerender: true },
    '/privatnost': { prerender: true },
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

  // @nuxt/fonts (loaded by Nuxt UI) finds the families in main.css. Source Serif 4 needs the
  // optical-size axis asked for by name, and the weights are pinned to the ones the pz type scale uses.
  fonts: {
    families: [
      { name: 'Inter', weights: [400, 500, 600, 700] },
      {
        name: 'Source Serif 4',
        weights: [400, 600, 700],
        providerOptions: { google: { experimental: { variableAxis: { opsz: [['8', '60']] } } } }
      }
    ]
  },

  i18n: {
    baseUrl: 'https://prigorje.karlo-siladi.from.hr',
    defaultLocale: 'hr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    locales: [
      { code: 'hr', language: 'hr-HR', name: 'Hrvatski', file: 'hr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' }
    ]
  }
})
