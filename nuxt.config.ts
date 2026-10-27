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

  // Server-only settings. Set them with environment variables on the server, never in the repo
  // (NUXT_SUPABASE_URL, NUXT_REVIEW_SECRET, ...). See the README.
  runtimeConfig: {
    supabase: {
      url: '',
      // Public (anon) key: the form uses it, and the database only lets it insert.
      anonKey: '',
      // Secret key for the /review routes. Server only, never expose it to the browser.
      serviceRoleKey: ''
    },
    reviewSecret: '',
    submissionRateLimit: {
      max: 10,
      windowSeconds: 600
    }
  },

  // Pages are prerendered to static HTML; the /api routes run in the Node server build.
  routeRules: {
    '/': { prerender: true },
    '/en': { prerender: true },
    '/heritage': { prerender: true },
    '/en/heritage': { prerender: true },
    '/heritage/kartice': { prerender: true },
    '/en/heritage/kartice': { prerender: true },
    '/privacy': { prerender: true },
    '/en/privacy': { prerender: true },
    '/review': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/en/review': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
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
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
    ]
  }
})
