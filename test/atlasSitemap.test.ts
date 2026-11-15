import { describe, expect, it } from 'vitest'
import { buildPublicContent } from '../server/utils/publicContent'
import { sitemapEntries, SITE_URL } from '../server/utils/sitemap'
import { getAtlas, settlementByCode } from './helpers/atlasFixtures'
import atlasPrerenderRoutes from './fixtures/atlas/prerender-routes.json'
import { fakeContentRows } from './helpers/fakeContentSeed'

describe('atlas sitemap parity (in-memory snapshot)', () => {
  const atlas = getAtlas()
  const content = buildPublicContent(fakeContentRows(), {})
  const urls = sitemapEntries(content).map(entry => SITE_URL + entry.path)

  it('matches prerender routes minus noindex item pages', () => {
    const noindexPaths = new Set(atlas.heritage
      .filter(item => item.noindex && item.settlementCode)
      .map(item => `/bastina/${settlementByCode(item.settlementCode!)!.slug}/${item.slug}`))
    const expected = [
      'https://prigorje.karlo-siladi.from.hr/govor',
      'https://prigorje.karlo-siladi.from.hr/osobe',
      'https://prigorje.karlo-siladi.from.hr/price-i-obicaji',
      ...atlasPrerenderRoutes.filter(path => !noindexPaths.has(path)).map(path => `https://prigorje.karlo-siladi.from.hr${path || '/'}`)
    ]
    expect(urls.sort()).toEqual(expected.sort())
  })
})
