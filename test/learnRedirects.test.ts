import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('learn redirects', () => {
  it('redirects legacy kartice to uci with rijeci topics', () => {
    const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
    expect(config).toMatch(
      /'\/potkalnicko-prigorje\/igre\/kartice':\s*\{\s*redirect:\s*\{\s*to:\s*'\/potkalnicko-prigorje\/uci\?teme=rijeci',\s*statusCode:\s*301\s*\}/
    )
  })
})
