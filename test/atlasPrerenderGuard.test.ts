import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('atlas prerender guard', () => {
  it('does not prerender database-backed atlas routes', () => {
    const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
    expect(config).not.toMatch(/\/mjesta/)
    expect(config).not.toMatch(/\/naselja/)
    expect(config).not.toMatch(/['"]\/bastina\//)
    expect(config).not.toMatch(/['"]\/osobe\//)
    expect(config).not.toMatch(/['"]\/govor\//)
    expect(config).not.toMatch(/['"]\/izazov\//)
    expect(config).not.toMatch(/prerender-routes\.json/)
    expect(config).not.toMatch(/nitro:config/)
  })
})
