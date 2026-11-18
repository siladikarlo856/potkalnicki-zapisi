import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type RouteRule = { prerender?: boolean }
type Config = {
  routeRules?: Record<string, RouteRule>
  nitro?: { routeRules?: Record<string, RouteRule>, prerender?: { routes?: string[], crawlLinks?: boolean } }
  hooks?: Record<string, unknown>
}

const databaseBackedPaths = [
  '/mjesta/',
  '/mjesta/grad-krizevci/',
  '/mjesta/grad-krizevci/potkalec/',
  '/bastina/potkalec/kapela/',
  '/osobe/ivan-horvat/',
  '/price-i-obicaji/',
  '/price-i-obicaji/price/vila/',
  '/govor/rec/',
  '/izazov/abc/'
]

function ruleMatches(pattern: string, path: string) {
  const wildcards: Record<string, string> = { '/**': '(?:/.*)?', '**': '.*', '*': '[^/]*' }
  const source = pattern.replace(/\/\*\*|\*\*|\*|[.+?^${}()|[\]\\]/g, token => wildcards[token] ?? `\\${token}`)
  return new RegExp(`^${source}/?$`).test(path)
}

let config: Config

beforeAll(async () => {
  vi.stubGlobal('defineNuxtConfig', (value: Config) => value)
  config = (await import('../nuxt.config')).default as Config
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('atlas prerender guard', () => {
  it('does not prerender database-backed public routes, so the slash-less 301 runs before any HTML', () => {
    const rules = { ...config.routeRules, ...config.nitro?.routeRules }
    for (const path of databaseBackedPaths) {
      const prerendered = Object.entries(rules)
        .filter(([pattern, rule]) => rule.prerender && ruleMatches(pattern, path))
        .map(([pattern]) => pattern)
      expect(prerendered, path).toEqual([])
    }
  })

  it('does not add prerender routes or crawling through nitro', () => {
    expect(config.nitro?.prerender?.routes ?? []).toEqual([])
    expect(config.nitro?.prerender?.crawlLinks ?? false).toBe(false)
    expect(config.hooks?.['nitro:config']).toBeUndefined()
  })
})
