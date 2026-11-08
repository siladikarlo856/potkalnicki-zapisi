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
      .map(item => `/potkalnicko-prigorje/bastina/${settlementByCode(item.settlementCode!)!.slug}/${item.slug}`))
    const expected = [
      'https://karlo-siladi.from.hr/',
      'https://karlo-siladi.from.hr/en',
      'https://karlo-siladi.from.hr/potkalnicko-prigorje/govor',
      'https://karlo-siladi.from.hr/potkalnicko-prigorje/osobe',
      'https://karlo-siladi.from.hr/potkalnicko-prigorje/price-i-obicaji',
      ...atlasPrerenderRoutes.filter(path => !noindexPaths.has(path)).map(path => `https://karlo-siladi.from.hr${path}`)
    ]
    expect(urls.sort()).toEqual(expected.sort())
  })
})
