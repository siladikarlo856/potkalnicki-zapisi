import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('igre topic redirects', () => {
  it('defines the seven legacy topic redirects in nuxt.config', () => {
    const config = readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/rijeci\': { redirect: { to: \'/potkalnicko-prigorje/igre?tema=rijeci\', statusCode: 301 } }')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/crkve\': { redirect: { to: \'/potkalnicko-prigorje/igre?tema=bastina\', statusCode: 301 } }')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/zemljopis\': { redirect: { to: \'/potkalnicko-prigorje/igre?tema=mjesta\', statusCode: 301 } }')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/poznati-ljudi\': { redirect: { to: \'/potkalnicko-prigorje/igre?tema=osobe\', statusCode: 301 } }')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/legende\': { redirect: { to: \'/potkalnicko-prigorje/igre?tema=legende\', statusCode: 301 } }')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/povijest\': { redirect: { to: \'/potkalnicko-prigorje/igre\', statusCode: 301 } }')
    expect(config).toContain('\'/potkalnicko-prigorje/igre/sport\': { redirect: { to: \'/potkalnicko-prigorje/igre\', statusCode: 301 } }')
  })
})
