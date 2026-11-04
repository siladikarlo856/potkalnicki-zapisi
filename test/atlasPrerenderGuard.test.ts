import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('atlas prerender guard', () => {
  it('does not prerender database-backed atlas routes', () => {
    const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
    expect(config).not.toMatch(/potkalnicko-prigorje\/istrazi/)
    expect(config).not.toMatch(/potkalnicko-prigorje\/naselja/)
    expect(config).not.toMatch(/potkalnicko-prigorje\/bastina/)
    expect(config).not.toMatch(/potkalnicko-prigorje\/osobe/)
    expect(config).not.toMatch(/potkalnicko-prigorje\/izazov/)
    expect(config).not.toMatch(/prerender-routes\.json/)
    expect(config).not.toMatch(/nitro:config/)
  })
})
