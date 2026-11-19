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

  app: {
    head: { htmlAttrs: { lang: 'hr' } }
  },

  css: ['~/assets/css/main.css'],

  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'],
      defaultVariants: { color: 'primary', size: 'xl' }
    },
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

  // Old addresses (the /potkalnicko-prigorje prefix, renamed sections, retired game topics, a missing trailing
  // slash) are redirected by server/middleware/canonical-address.ts. Nitro serves prerendered HTML before any
  // middleware runs, so a prerendered page could not answer 301 from its slash-less address: every public page
  // renders on the server per request instead. The /api routes run in the Node server build.
  routeRules: {
    '/en': { redirect: { to: '/', statusCode: 301 } },
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

  // @nuxt/fonts (loaded by Nuxt UI) self-hosts both Reljef families.
  fonts: {
    families: [
      { name: 'Atkinson Hyperlegible Next', weights: [400, 600, 700], styles: ['normal', 'italic'] },
      { name: 'Bricolage Grotesque', weights: [700, 800] }
    ],
    defaults: { subsets: ['latin', 'latin-ext'] }
  },

  i18n: {
    baseUrl: 'https://prigorje.karlo-siladi.from.hr',
    defaultLocale: 'hr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    // Every public address ends in a slash; localePath builds them that way (see shared/utils/appRoutes.ts).
    trailingSlash: true,
    locales: [
      { code: 'hr', language: 'hr-HR', name: 'Hrvatski', file: 'hr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' }
    ]
  },

  icon: { clientBundle: { scan: true } }
})
