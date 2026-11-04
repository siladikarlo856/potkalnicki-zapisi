import { pzRoutes } from '../../shared/utils/appRoutes'
import { heritageItemPath, atlasMunicipalityPath, atlasPersonPath, atlasSettlementPath } from './publicAtlas'
import type { PublicContent } from './publicContent'

// The sitemap built from the public content snapshot: the static pages, then every live town or
// municipality, settlement, indexable item and indexable person page, plus /osobe. Drafts, archived rows, noindex items and items without
// a settlement are left out. Served by server/routes/sitemap.xml.ts, which stays shadowed while
// public/sitemap.xml exists (static files win in Nitro).

export const SITE_URL = 'https://karlo-siladi.from.hr'

export const STATIC_SITEMAP_PATHS = [
  '/',
  '/en',
  pzRoutes.home,
  pzRoutes.games,
  pzRoutes.contribute,
  pzRoutes.about,
  pzRoutes.learn,
  `${pzRoutes.learn}/sesija`,
  pzRoutes.quiz,
  pzRoutes.privacy,
  pzRoutes.explore,
  pzRoutes.heritage
]

export interface SitemapEntry {
  path: string
  /** YYYY-MM-DD */
  lastmod?: string
}

export function sitemapEntries(content: PublicContent): SitemapEntry[] {
  const day = (timestamp: string) => timestamp.slice(0, 10)
  return [
    ...STATIC_SITEMAP_PATHS.map(path => ({ path })),
    { path: pzRoutes.persons },
    ...content.persons.filter(p => !p.noindex).map(p => ({ path: atlasPersonPath(p.slug), lastmod: day(p.updatedAt) })),
    ...content.municipalities.map(m => ({ path: atlasMunicipalityPath(m.slug), lastmod: day(m.updatedAt) })),
    ...content.settlements.map(s => ({ path: atlasSettlementPath(s.slug), lastmod: day(s.updatedAt) })),
    ...content.items.flatMap((item) => {
      const path = heritageItemPath(content, item)
      return path && !item.noindex ? [{ path, lastmod: day(item.updatedAt) }] : []
    })
  ]
}

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, c => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', '\'': 'apos', '"': 'quot' }[c]};`)

export function sitemapXml(entries: readonly SitemapEntry[], base = SITE_URL) {
  const urls = entries.map(({ path, lastmod }) =>
    `  <url>\n    <loc>${escapeXml(base + path)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

// One rendering per snapshot: a new snapshot (TTL refresh or invalidation after a write) renders anew.
const rendered = new WeakMap<PublicContent, string>()

export function contentSitemap(content: PublicContent) {
  let xml = rendered.get(content)
  if (xml === undefined) {
    xml = sitemapXml(sitemapEntries(content))
    rendered.set(content, xml)
  }
  return xml
}
