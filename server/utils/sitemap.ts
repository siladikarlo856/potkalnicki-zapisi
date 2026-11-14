import { pzRoutes } from '../../shared/utils/appRoutes'
import { wordArchivePagePath } from '../../shared/utils/speech'
import { intangiblePath, narratorPath, themePath } from '../../shared/utils/intangiblePublic'
import { heritageItemPath, atlasMunicipalityPath, atlasPersonPath, atlasSettlementPath } from './publicRefs'
import type { PublicContent } from './publicContent'
import type { WordSitemapEntry } from './words'

// The sitemap built from the public content snapshot: the static pages, then every live town or
// municipality, settlement, indexable item and indexable person page, plus /osobe, and Priče i običaji: its list,
// every indexable Story, Custom, Folk text and Narrator, and each theme that has records. Drafts, archived rows,
// noindex rows and items without a settlement are left out. Served by server/routes/sitemap.xml.ts, which stays shadowed while
// public/sitemap.xml exists (static files win in Nitro).

export const SITE_URL = 'https://prigorje.karlo-siladi.from.hr'

export const STATIC_SITEMAP_PATHS = [
  pzRoutes.home,
  pzRoutes.games,
  pzRoutes.contribute,
  pzRoutes.about,
  pzRoutes.learn,
  `${pzRoutes.learn}/sesija`,
  pzRoutes.quiz,
  pzRoutes.privacy,
  pzRoutes.explore,
  pzRoutes.heritage,
  `${pzRoutes.home}/govor`
]

export interface SitemapEntry {
  path: string
  /** YYYY-MM-DD */
  lastmod?: string
}

export function sitemapEntries(content: PublicContent, words: readonly WordSitemapEntry[] = []): SitemapEntry[] {
  const day = (timestamp: string) => timestamp.slice(0, 10)
  return [
    ...STATIC_SITEMAP_PATHS.map(path => ({ path })),
    { path: pzRoutes.persons },
    { path: pzRoutes.intangible },
    ...words.map(w => ({ path: wordArchivePagePath(w.slug), lastmod: day(w.updatedAt) })),
    ...content.persons.filter(p => !p.noindex).map(p => ({ path: atlasPersonPath(p.slug), lastmod: day(p.updatedAt) })),
    ...content.intangible.records.filter(r => !r.noindex).map(r => ({ path: intangiblePath(r.kind, r.slug), lastmod: day(r.updatedAt) })),
    ...content.intangible.themes.filter(t => content.intangible.recordsByTheme.has(t.id)).map(t => ({ path: themePath(t.slug), lastmod: day(t.updatedAt) })),
    ...content.intangible.narrators.filter(n => !n.noindex).map(n => ({ path: narratorPath(n.slug), lastmod: day(n.updatedAt) })),
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

export function contentSitemap(content: PublicContent, words: readonly WordSitemapEntry[] = []) {
  if (words.length === 0) {
    let xml = rendered.get(content)
    if (xml === undefined) {
      xml = sitemapXml(sitemapEntries(content))
      rendered.set(content, xml)
    }
    return xml
  }
  return sitemapXml(sitemapEntries(content, words))
}
