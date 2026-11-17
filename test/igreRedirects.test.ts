import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('igre topic redirects', () => {
  it('defines the seven legacy topic redirects in nuxt.config', () => {
    const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
    expect(config).toContain('\'/igre/rijeci\': { redirect: { to: \'/igre?tema=rijeci\', statusCode: 301 } }')
    expect(config).toContain('\'/igre/crkve\': { redirect: { to: \'/igre?tema=bastina\', statusCode: 301 } }')
    expect(config).toContain('\'/igre/zemljopis\': { redirect: { to: \'/igre?tema=mjesta\', statusCode: 301 } }')
    expect(config).toContain('\'/igre/poznati-ljudi\': { redirect: { to: \'/igre?tema=osobe\', statusCode: 301 } }')
    expect(config).toContain('\'/igre/legende\': { redirect: { to: \'/igre?tema=legende\', statusCode: 301 } }')
    expect(config).toContain('\'/igre/povijest\': { redirect: { to: \'/igre\', statusCode: 301 } }')
    expect(config).toContain('\'/igre/sport\': { redirect: { to: \'/igre\', statusCode: 301 } }')
  })
})
