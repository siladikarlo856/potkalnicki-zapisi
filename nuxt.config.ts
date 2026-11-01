// https://nuxt.com/docs/api/configuration/nuxt-config
import atlasPrerenderRoutes from './content/atlas/prerender-routes.json'

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

  // Pages are prerendered to static HTML; the /api routes run in the Node server build.
  routeRules: {
    '/': { prerender: true },
    '/en': { prerender: true },
    '/potkalnicko-prigorje': { prerender: true },
    '/potkalnicko-prigorje/igre/kartice': { prerender: true },
    '/potkalnicko-prigorje/igre/kviz': { prerender: true },
    '/potkalnicko-prigorje/igre/**': { prerender: true },
    '/potkalnicko-prigorje/doprinesi': { prerender: true },
    '/potkalnicko-prigorje/o-projektu': { prerender: true },
    '/potkalnicko-prigorje/privatnost': { prerender: true },
    '/potkalnicko-prigorje/istrazi': { prerender: true },
    '/potkalnicko-prigorje/istrazi/**': { prerender: true },
    '/potkalnicko-prigorje/naselja/**': { prerender: true },
    '/potkalnicko-prigorje/bastina': { prerender: true },
    '/potkalnicko-prigorje/bastina/**': { prerender: true },
    '/admin/**': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/api/**': { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } }
  },

  compatibilityDate: '2026-06-30',

  hooks: {
    'nitro:config'(nitroConfig) {
      nitroConfig.prerender = nitroConfig.prerender ?? {}
      const existing = nitroConfig.prerender.routes ?? []
      nitroConfig.prerender.routes = [...existing, ...atlasPrerenderRoutes]
    }
  },

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
