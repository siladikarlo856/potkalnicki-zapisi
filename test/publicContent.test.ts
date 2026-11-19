import { describe, expect, it, vi } from 'vitest'
import {
  ATLAS_REGION_SLUG,
  PublicContentUnavailableError,
  buildPublicContent,
  createSnapshotStore,
  derive
} from '../server/utils/publicContent'
import type { AreaRow, ItemImageRow, ItemRow, PublicContentRows } from '../server/utils/publicContent'
import {
  archiveSearch,
  atlasOverview,
  contentTarget,
  heritageItemDetail,
  heritageList,
  heritageListItem,
  municipalityPage,
  photoCredits,
  resolveContentId,
  resolveHeritageItem,
  resolveMunicipality,
  resolveSettlement,
  settlementPage
} from '../server/utils/publicAtlas'
import { settlementAnswer } from '../server/utils/addressLookup'
import { contentSitemap, sitemapEntries, sitemapXml } from '../server/utils/sitemap'

// The public read layer without a database: snapshot rules, route resolution, API shapes, sitemap and the
// stale-while-revalidate store. test/publicContent.integration.test.ts runs the same layer on Postgres.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ID = {
  region: id(1), town: id(2), kalnik: id(3), archivedMunicipality: id(4), outside: id(5),
  krizevci: id(10), apatovec: id(11), kalnikSettlement: id(12), archivedSettlement: id(13), underArchived: id(14), draftSettlement: id(15), outsideSettlement: id(16),
  church: id(20), chapel: id(21), oldCategory: id(22),
  source: id(30), archivedSource: id(31),
  ana: id(40), kapela: id(41), loose: id(42), archivedItem: id(43), inArchived: id(44), oldCategoryItem: id(46), outsideItem: id(47)
}
const T = '2026-11-01T10:00:00+00:00'

function area(row: Partial<AreaRow> & Pick<AreaRow, 'id' | 'kind' | 'name'>): AreaRow {
  return { parent_id: null, slug: null, official_code: null, latitude: null, longitude: null, status: 'published', updated_at: T, ...row }
}
function item(row: Partial<ItemRow> & Pick<ItemRow, 'id' | 'name' | 'slug' | 'municipality_id'>): ItemRow {
  return {
    category_id: ID.church, settlement_id: null, locality: null, verification: 'unverified', heritage_status: null, registry_number: null,
    period: null, description: null, research_notes: '', latitude: null, longitude: null, noindex: false, credits: [], status: 'published',
    updated_at: T, ...row
  }
}

function rows(): PublicContentRows {
  return {
    areas: [
      area({ id: ID.region, kind: 'region', name: 'Potkalničko prigorje', slug: ATLAS_REGION_SLUG }),
      area({ id: ID.kalnik, kind: 'municipality', name: 'Kalnik', slug: 'opcina-kalnik' }),
      area({ id: ID.town, kind: 'town', name: 'Križevci', slug: 'grad-krizevci', updated_at: '2026-10-30T23:00:00+00:00' }),
      area({ id: ID.archivedMunicipality, kind: 'municipality', name: 'Stara', slug: 'opcina-stara', status: 'archived' }),
      area({ id: ID.outside, kind: 'municipality', name: 'Vani', slug: 'opcina-vani' }),
      area({ id: ID.krizevci, kind: 'settlement', name: 'Križevci', slug: 'krizevci', parent_id: ID.town, official_code: '032379', latitude: 46.02, longitude: 16.54 }),
      area({ id: ID.apatovec, kind: 'settlement', name: 'Apatovec', slug: 'apatovec', parent_id: ID.town, official_code: '000299' }),
      area({ id: ID.kalnikSettlement, kind: 'settlement', name: 'Kalnik', slug: 'kalnik', parent_id: ID.kalnik }),
      area({ id: ID.archivedSettlement, kind: 'settlement', name: 'Staro selo', slug: 'staro-selo', parent_id: ID.town, status: 'archived' }),
      area({ id: ID.underArchived, kind: 'settlement', name: 'Pod arhivom', slug: 'pod-arhivom', parent_id: ID.archivedMunicipality }),
      area({ id: ID.outsideSettlement, kind: 'settlement', name: 'Vanjsko', slug: 'vanjsko', parent_id: ID.outside })
    ],
    areaRegions: [ID.town, ID.kalnik, ID.archivedMunicipality].map(area_id => ({ area_id, region_id: ID.region })),
    categories: [
      { id: ID.church, key: 'church', label_hr: 'Crkva', sort: 1, status: 'published' },
      { id: ID.chapel, key: 'chapel', label_hr: 'Kapela', sort: 2, status: 'published' },
      { id: ID.oldCategory, key: 'old', label_hr: 'Staro', sort: 3, status: 'archived' }
    ],
    sources: [
      { id: ID.source, title: 'Registar', type: 'official_registry', url: 'https://example.com/r', status: 'published' },
      { id: ID.archivedSource, title: 'Stari izvor', type: 'other', url: null, status: 'archived' }
    ],
    items: [
      item({ id: ID.ana, name: 'Crkva sv. Ane', slug: 'crkva-sv-ane', municipality_id: ID.town, settlement_id: ID.krizevci, verification: 'verified', period: '18. st.', credits: [{ name: 'Ana', kind: 'contribution' }, { bad: true }, { name: ' ' }] }),
      item({ id: ID.kapela, name: 'Kapela sv. Marka', slug: 'kapela', category_id: ID.chapel, municipality_id: ID.town, settlement_id: ID.apatovec, noindex: true }),
      item({ id: ID.loose, name: 'Raspelo', slug: 'raspelo', category_id: ID.chapel, municipality_id: ID.kalnik }),
      item({ id: ID.archivedItem, name: 'Srušena', slug: 'srusena', municipality_id: ID.town, settlement_id: ID.krizevci, status: 'archived' }),
      item({ id: ID.inArchived, name: 'U starom', slug: 'u-staro', municipality_id: ID.town, settlement_id: ID.archivedSettlement }),
      item({ id: ID.oldCategoryItem, name: 'Bivša kategorija', slug: 'bivsa', category_id: ID.oldCategory, municipality_id: ID.kalnik, settlement_id: ID.kalnikSettlement }),
      item({ id: ID.outsideItem, name: 'Vanjska', slug: 'vanjska', municipality_id: ID.outside, settlement_id: ID.outsideSettlement })
    ],
    itemSources: [{ item_id: ID.ana, source_id: ID.source, position: 0 }, { item_id: ID.ana, source_id: ID.archivedSource, position: 1 }, { item_id: ID.ana, source_id: id(99), position: 2 }],
    clubs: [],
    clubSeasons: [],
    clubSources: [],
    legacyIds: [
      { kind: 'heritage_item', legacy_id: 'križevci-crkva-sv-ane', entity_id: ID.ana },
      { kind: 'heritage_item', legacy_id: 'krizevci-crkva-sv-ane', entity_id: ID.ana },
      { kind: 'heritage_item', legacy_id: 'staro', entity_id: ID.archivedItem },
      { kind: 'area', legacy_id: 'krizevci', entity_id: ID.town },
      { kind: 'area', legacy_id: '000299', entity_id: ID.apatovec },
      { kind: 'source', legacy_id: 'registar', entity_id: ID.source }
    ],
    slugHistory: [
      { kind: 'area', namespace: 'lau', scope_id: null, slug: 'grad-stari', entity_id: ID.town },
      { kind: 'area', namespace: 'settlement', scope_id: null, slug: 'stari-krizevci', entity_id: ID.krizevci },
      { kind: 'area', namespace: 'settlement', scope_id: null, slug: 'bivse', entity_id: ID.archivedSettlement },
      { kind: 'area', namespace: 'lau', scope_id: null, slug: 'apatovec-stari', entity_id: ID.apatovec },
      { kind: 'heritage_item', namespace: '', scope_id: ID.krizevci, slug: 'stara-crkva', entity_id: ID.ana },
      { kind: 'heritage_item', namespace: '', scope_id: ID.apatovec, slug: 'preseljena', entity_id: ID.ana },
      { kind: 'heritage_item', namespace: '', scope_id: ID.krizevci, slug: 'stara-srusena', entity_id: ID.archivedItem }
    ]
  }
}

const content = buildPublicContent(rows(), { loadedAt: 0 })

describe('public content snapshot', () => {
  it('keeps the region members in scope, towns first, with labels from kind and name', () => {
    expect(content.region).toEqual({ id: ID.region, slug: ATLAS_REGION_SLUG, name: 'Potkalničko prigorje' })
    expect(content.municipalities.map(m => [m.slug, m.label, m.kind])).toEqual([
      ['grad-krizevci', 'Grad Križevci', 'town'],
      ['opcina-kalnik', 'Općina Kalnik', 'municipality']
    ])
    expect(content.settlements.map(s => s.slug)).toEqual(['apatovec', 'kalnik', 'krizevci'])
    expect(content.settlementById.get(ID.krizevci)).toMatchObject({ code: '032379', centroid: { lat: 46.02, lng: 16.54 }, municipalityId: ID.town })
  })

  it('shows only published items under live places and remembers where archived ones were', () => {
    expect(content.items.map(i => i.slug)).toEqual(['bivsa', 'crkva-sv-ane', 'kapela', 'raspelo'])
    expect(content.gone.ids).toEqual(new Set([ID.archivedMunicipality, ID.archivedSettlement, ID.underArchived, ID.archivedSource, ID.archivedItem, ID.inArchived]))
    expect(content.gone.areas).toEqual(new Set(['lau/opcina-stara', 'settlement/staro-selo', 'settlement/pod-arhivom']))
    expect(content.gone.items).toEqual(new Set([`${ID.krizevci}/srusena`, `${ID.archivedSettlement}/u-staro`]))
  })

  it('uses the old item id as the correction ref, keeps published sources in order and only named credits', () => {
    const ana = content.itemById.get(ID.ana)!
    expect(ana.ref).toBe('krizevci-crkva-sv-ane')
    expect(content.itemById.get(ID.loose)!.ref).toBe(ID.loose)
    expect(ana.sourceIds).toEqual([ID.source])
    expect(ana.credits).toEqual([{ name: 'Ana', kind: 'contribution' }])
  })

  it('is empty without a published region', () => {
    const data = rows()
    data.areas[0]!.status = 'archived'
    const empty = buildPublicContent(data)
    expect(empty.region).toBeNull()
    expect([empty.municipalities, empty.settlements, empty.items].map(list => list.length)).toEqual([0, 0, 0])
    expect(atlasOverview(empty)).toBeNull()
  })
})

describe('heritage photos in the snapshot', () => {
  const MEDIA = 'https://abc.supabase.co'
  const file = (n: number) => `heritage/00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const image = (row: Partial<ItemImageRow> & Pick<ItemImageRow, 'item_id' | 'position'>): ItemImageRow => ({
    path: `${file(row.position + 1)}.webp`, thumb_path: `${file(row.position + 1)}-thumb.webp`, width: 1600, height: 1200,
    alt: 'Pročelje', caption: null, author: 'Ivan Horvat', author_url: null,
    source_url: 'https://commons.wikimedia.org/wiki/File:Ana.jpg', license: 'cc-by-sa-4.0', ...row
  })
  const withImages = (mediaBase?: string) => buildPublicContent({
    ...rows(),
    itemImages: [
      image({ item_id: ID.ana, position: 1, path: `${file(9)}.jpg`, thumb_path: `${file(9)}-thumb.jpg`, license: 'permission', source_url: null, author: 'Župa' }),
      image({ item_id: ID.ana, position: 0, caption: 'Oko 1910.', author_url: 'https://example.com/ivan' }),
      image({ item_id: ID.kapela, position: 0, license: 'all-rights-reserved' }),
      image({ item_id: ID.archivedItem, position: 0 })
    ]
  }, { loadedAt: 0, mediaBase })

  it('keeps photos in order with public URLs and the full credit, and drops unknown licences', () => {
    const snapshot = withImages(`${MEDIA}/`)
    const ana = heritageItemDetail(snapshot, snapshot.itemById.get(ID.ana)!)
    expect(ana.images).toEqual([
      {
        url: `${MEDIA}/storage/v1/object/public/heritage-media/${file(1)}.webp`,
        thumbUrl: `${MEDIA}/storage/v1/object/public/heritage-media/${file(1)}-thumb.webp`,
        width: 1600, height: 1200, alt: 'Pročelje', caption: 'Oko 1910.', author: 'Ivan Horvat', authorUrl: 'https://example.com/ivan',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ana.jpg', license: 'cc-by-sa-4.0', licenseLabel: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
      },
      expect.objectContaining({ author: 'Župa', license: 'permission', licenseLabel: 'Uz dopuštenje autora', licenseUrl: null, sourceUrl: null })
    ])
    expect(snapshot.itemById.get(ID.kapela)!.images).toEqual([])
  })

  it('gives list cards the main photo as a thumbnail with its credit', () => {
    const snapshot = withImages(MEDIA)
    expect(heritageListItem(snapshot, snapshot.itemById.get(ID.ana)!).thumb).toEqual({
      url: `${MEDIA}/storage/v1/object/public/heritage-media/${file(1)}-thumb.webp`,
      width: 1600, height: 1200, alt: 'Pročelje', author: 'Ivan Horvat', licenseLabel: 'CC BY-SA 4.0'
    })
    expect(heritageListItem(snapshot, snapshot.itemById.get(ID.kapela)!).thumb).toBeNull()
  })

  it('lists every photo of a live item on the credits page, never one of an archived item', () => {
    const { photos } = photoCredits(withImages(MEDIA))
    expect(photos.map(photo => [photo.item.name, photo.author])).toEqual([['Crkva sv. Ane', 'Ivan Horvat'], ['Crkva sv. Ane', 'Župa']])
    expect(photos[0]!.item).toEqual({ id: ID.ana, name: 'Crkva sv. Ane', path: '/bastina/krizevci/crkva-sv-ane/' })
  })

  it('shows no photos when the Storage URL is not configured or the table is not there yet', () => {
    expect(withImages().itemById.get(ID.ana)!.images).toEqual([])
    expect(content.itemById.get(ID.ana)!.images).toEqual([])
  })
})

describe('old settlement address /naselja/[naselje]', () => {
  it('answers 301 to the address under the settlement\'s municipality, for a current or an old slug', () => {
    expect(settlementAnswer(content, 'krizevci')).toEqual({ status: 'redirect', location: '/mjesta/grad-krizevci/krizevci/' })
    expect(settlementAnswer(content, 'kalnik')).toEqual({ status: 'redirect', location: '/mjesta/opcina-kalnik/kalnik/' })
    expect(settlementAnswer(content, 'stari-krizevci')).toEqual({ status: 'redirect', location: '/mjesta/grad-krizevci/krizevci/' })
  })

  it('answers 410 for a removed settlement and 404 for an unknown one', () => {
    for (const slug of ['staro-selo', 'pod-arhivom', 'bivse']) expect(settlementAnswer(content, slug), slug).toEqual({ status: 'gone' })
    for (const slug of ['vanjsko', 'nepostojece']) expect(settlementAnswer(content, slug), slug).toEqual({ status: 'not_found' })
  })
})

describe('public route resolution', () => {
  it('resolves towns and municipalities by current, old and archived slug', () => {
    expect(resolveMunicipality(content, 'grad-krizevci')).toMatchObject({ status: 'ok', value: { id: ID.town } })
    expect(resolveMunicipality(content, 'grad-stari')).toEqual({ status: 'redirect', path: '/mjesta/grad-krizevci/' })
    expect(resolveMunicipality(content, 'opcina-stara')).toEqual({ status: 'gone' })
    expect(resolveMunicipality(content, 'opcina-vani')).toEqual({ status: 'not_found' })
    // Slug history is per URL namespace: an old town slug does not answer for a settlement and vice versa.
    expect(resolveMunicipality(content, 'krizevci')).toEqual({ status: 'not_found' })
    expect(resolveMunicipality(content, 'apatovec-stari')).toEqual({ status: 'not_found' })
  })

  it('resolves settlements, including ones under an archived municipality', () => {
    expect(resolveSettlement(content, 'krizevci')).toMatchObject({ status: 'ok', value: { id: ID.krizevci } })
    expect(resolveSettlement(content, 'stari-krizevci')).toEqual({ status: 'redirect', path: '/mjesta/grad-krizevci/krizevci/' })
    for (const slug of ['staro-selo', 'pod-arhivom', 'bivse']) expect(resolveSettlement(content, slug), slug).toEqual({ status: 'gone' })
    for (const slug of ['vanjsko', 'nepostojece']) expect(resolveSettlement(content, slug), slug).toEqual({ status: 'not_found' })
  })

  it('redirects old settlement and item slugs and moved items to the current item page', () => {
    const current = '/bastina/krizevci/crkva-sv-ane/'
    expect(resolveHeritageItem(content, 'krizevci', 'crkva-sv-ane')).toMatchObject({ status: 'ok', value: { id: ID.ana } })
    expect(resolveHeritageItem(content, 'stari-krizevci', 'crkva-sv-ane')).toEqual({ status: 'redirect', path: current })
    expect(resolveHeritageItem(content, 'krizevci', 'stara-crkva')).toEqual({ status: 'redirect', path: current })
    expect(resolveHeritageItem(content, 'stari-krizevci', 'stara-crkva')).toEqual({ status: 'redirect', path: current })
    expect(resolveHeritageItem(content, 'apatovec', 'preseljena')).toEqual({ status: 'redirect', path: current })
  })

  it('answers gone for archived items and items under archived places, not found otherwise', () => {
    for (const [settlement, slug] of [['krizevci', 'srusena'], ['krizevci', 'stara-srusena'], ['staro-selo', 'u-staro'], ['bivse', 'u-staro']]) {
      expect(resolveHeritageItem(content, settlement!, slug!), `${settlement}/${slug}`).toEqual({ status: 'gone' })
    }
    for (const [settlement, slug] of [['krizevci', 'nema'], ['apatovec', 'crkva-sv-ane'], ['vanjsko', 'vanjska'], ['nema', 'crkva-sv-ane']]) {
      expect(resolveHeritageItem(content, settlement!, slug!), `${settlement}/${slug}`).toEqual({ status: 'not_found' })
    }
  })

  it('accepts UUIDs and old ids', () => {
    expect(resolveContentId(content, 'heritage_item', ID.ana.toUpperCase())).toBe(ID.ana)
    expect(resolveContentId(content, 'heritage_item', 'križevci-crkva-sv-ane')).toBe(ID.ana)
    expect(resolveContentId(content, 'area', 'krizevci')).toBe(ID.town)
    expect(resolveContentId(content, 'source', 'krizevci')).toBeNull()
  })
})

describe('public atlas API shapes', () => {
  it('summarizes the region with per-place counts', () => {
    expect(atlasOverview(content)).toEqual({
      region: content.region,
      totals: { municipalities: 2, settlements: 3, items: 4, settlementsWithItems: 3 },
      municipalities: [
        { id: ID.town, slug: 'grad-krizevci', name: 'Križevci', label: 'Grad Križevci', kind: 'town', path: '/mjesta/grad-krizevci/', stats: { settlements: 2, items: 2, settlementsWithItems: 2 } },
        { id: ID.kalnik, slug: 'opcina-kalnik', name: 'Kalnik', label: 'Općina Kalnik', kind: 'municipality', path: '/mjesta/opcina-kalnik/', stats: { settlements: 1, items: 2, settlementsWithItems: 1 } }
      ]
    })
  })

  it('builds the municipality page with settlement counts and filterable categories only', () => {
    const page = municipalityPage(content, content.municipalityById.get(ID.kalnik)!)
    expect(page.settlements).toEqual([{ id: ID.kalnikSettlement, slug: 'kalnik', name: 'Kalnik', code: null, path: '/mjesta/opcina-kalnik/kalnik/', itemCount: 1 }])
    expect(page.categories).toEqual([{ key: 'chapel', label: 'Kapela', count: 1 }])
  })

  it('builds the settlement page with its item list', () => {
    const page = settlementPage(content, content.settlementById.get(ID.krizevci)!)
    expect(page.municipality.label).toBe('Grad Križevci')
    expect(page.settlement.centroid).toEqual({ lat: 46.02, lng: 16.54 })
    expect(page.items).toEqual([{
      id: ID.ana, slug: 'crkva-sv-ane', name: 'Crkva sv. Ane', category: { key: 'church', label: 'Crkva' },
      municipality: { id: ID.town, slug: 'grad-krizevci', label: 'Grad Križevci' },
      settlement: { id: ID.krizevci, slug: 'krizevci', name: 'Križevci' },
      locality: null, verification: 'verified', noindex: false, path: '/bastina/krizevci/crkva-sv-ane/', thumb: null
    }])
  })

  it('filters the heritage list by municipality slug and category key and refuses unknown filters', () => {
    const all = heritageList(content)!
    expect(all.total).toBe(4)
    expect(all.categories).toEqual([{ key: 'chapel', label: 'Kapela', count: 2 }, { key: 'church', label: 'Crkva', count: 1 }])
    expect(all.municipalities).toEqual([{ slug: 'grad-krizevci', label: 'Grad Križevci' }, { slug: 'opcina-kalnik', label: 'Općina Kalnik' }])
    expect(heritageList(content, { municipality: 'opcina-kalnik', category: 'chapel' })!.items.map(i => [i.slug, i.path])).toEqual([['raspelo', null]])
    expect(heritageList(content, { municipality: 'krizevci' })).toBeNull()
    expect(heritageList(content, { category: 'old' })).toBeNull()
  })

  it('details an item with sources, dataset fields and the correction ref', () => {
    expect(heritageItemDetail(content, content.itemById.get(ID.ana)!)).toMatchObject({
      ref: 'krizevci-crkva-sv-ane', period: '18. st.', researchNotes: '', updatedAt: T,
      sources: [{ id: ID.source, title: 'Registar', type: 'official_registry', url: 'https://example.com/r' }]
    })
  })

  it('finds correction targets by old id or UUID and tells archived from unknown', () => {
    expect(contentTarget(content, 'heritage_item', 'krizevci-crkva-sv-ane')).toMatchObject({ status: 'ok', value: { kind: 'heritage_item', item: { id: ID.ana, ref: 'krizevci-crkva-sv-ane' } } })
    expect(contentTarget(content, 'area', 'krizevci')).toMatchObject({ status: 'ok', value: { area: { id: ID.town, areaKind: 'town', label: 'Grad Križevci' } } })
    expect(contentTarget(content, 'area', '000299')).toMatchObject({ status: 'ok', value: { area: { id: ID.apatovec, areaKind: 'settlement', label: 'Apatovec', path: '/mjesta/grad-krizevci/apatovec/' } } })
    expect(contentTarget(content, 'source', 'registar')).toEqual({ status: 'ok', value: { kind: 'source', source: { id: ID.source, title: 'Registar', type: 'official_registry', url: 'https://example.com/r' } } })
    expect(contentTarget(content, 'heritage_item', 'staro')).toEqual({ status: 'gone' })
    expect(contentTarget(content, 'source', ID.archivedSource)).toEqual({ status: 'gone' })
    expect(contentTarget(content, 'area', ID.archivedSettlement)).toEqual({ status: 'gone' })
    expect(contentTarget(content, 'heritage_item', ID.town)).toEqual({ status: 'not_found' })
    expect(contentTarget(content, 'heritage_item', 'nema')).toEqual({ status: 'not_found' })
  })
})

describe('content sitemap', () => {
  it('lists static pages, /osobe, /price-i-obicaji, live places and indexable item pages with lastmod', () => {
    const entries = sitemapEntries(content)
    expect(entries.slice(0, 3)).toEqual([
      { path: '/' },
      { path: '/igre/' },
      { path: '/doprinesi/' }
    ])
    expect(entries.slice(9, 13)).toEqual([
      { path: '/bastina/' },
      { path: '/govor/' },
      { path: '/osobe/' },
      { path: '/price-i-obicaji/' }
    ])
    expect(entries.slice(13)).toEqual([
      { path: '/mjesta/grad-krizevci/', lastmod: '2026-10-30' },
      { path: '/mjesta/opcina-kalnik/', lastmod: '2026-11-01' },
      { path: '/mjesta/grad-krizevci/apatovec/', lastmod: '2026-11-01' },
      { path: '/mjesta/opcina-kalnik/kalnik/', lastmod: '2026-11-01' },
      { path: '/mjesta/grad-krizevci/krizevci/', lastmod: '2026-11-01' },
      { path: '/bastina/kalnik/bivsa/', lastmod: '2026-11-01' },
      { path: '/bastina/krizevci/crkva-sv-ane/', lastmod: '2026-11-01' }
    ])
  })

  it('renders escaped XML once per snapshot', () => {
    expect(sitemapXml([{ path: '/a?b=1&c=2' }, { path: '/d', lastmod: '2026-11-02' }], 'https://x.test')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + '  <url>\n    <loc>https://x.test/a?b=1&amp;c=2</loc>\n  </url>\n'
      + '  <url>\n    <loc>https://x.test/d</loc>\n    <lastmod>2026-11-02</lastmod>\n  </url>\n</urlset>\n')
    expect(contentSitemap(content)).toBe(contentSitemap(content))
    expect(contentSitemap(content)).toContain('<loc>https://prigorje.karlo-siladi.from.hr/mjesta/grad-krizevci/krizevci/</loc>')
  })
})

describe('snapshot store', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
  function setup() {
    let clock = 0
    const loads: Array<ReturnType<typeof deferred<string>>> = []
    const onError = vi.fn()
    const store = createSnapshotStore<string>({
      ttlMs: 60_000, now: () => clock, onError,
      load: () => {
        const load = deferred<string>()
        loads.push(load)
        return load.promise
      }
    })
    const tick = (ms: number) => {
      clock += ms
    }
    return { store, loads, onError, tick }
  }

  it('shares one load on a cold start and serves the value while fresh', async () => {
    const { store, loads } = setup()
    const [a, b] = [store.get(), store.get()]
    expect(loads).toHaveLength(1)
    loads[0]!.resolve('v1')
    expect(await Promise.all([a, b])).toEqual(['v1', 'v1'])
    expect(await store.get()).toBe('v1')
    expect(loads).toHaveLength(1)
  })

  it('serves a stale value while one background refresh runs', async () => {
    const { store, loads, tick } = setup()
    const first = store.get()
    loads[0]!.resolve('v1')
    await first
    tick(60_000)
    expect(await store.get()).toBe('v1')
    expect(await store.get()).toBe('v1')
    expect(loads).toHaveLength(2)
    loads[1]!.resolve('v2')
    await loads[1]!.promise
    await Promise.resolve()
    expect(await store.get()).toBe('v2')
  })

  it('waits for a new load after invalidation and ignores an older load that finishes later', async () => {
    const { store, loads, tick } = setup()
    const first = store.get()
    loads[0]!.resolve('v1')
    await first
    tick(60_000)
    await store.get() // starts a background refresh (load 1)
    store.invalidate()
    const after = store.get() // must not reuse the pre-invalidation load
    expect(loads).toHaveLength(3)
    loads[2]!.resolve('after-write')
    expect(await after).toBe('after-write')
    loads[1]!.resolve('before-write')
    await loads[1]!.promise
    await Promise.resolve()
    expect(await store.get()).toBe('after-write')
  })

  it('keeps the last good value when a refresh fails and retries on the next request', async () => {
    const { store, loads, onError } = setup()
    const first = store.get()
    loads[0]!.resolve('v1')
    await first
    store.invalidate()
    const failed = store.get()
    loads[1]!.reject(new Error('database down'))
    expect(await failed).toBe('v1')
    expect(onError).toHaveBeenCalled()
    // Served as stale now: the next request answers at once and retries in the background.
    expect(await store.get()).toBe('v1')
    expect(loads).toHaveLength(3)
  })

  it('fails with PublicContentUnavailableError on a cold start without a database, then retries', async () => {
    const { store, loads } = setup()
    const cold = store.get()
    loads[0]!.reject(new Error('database down'))
    await expect(cold).rejects.toBeInstanceOf(PublicContentUnavailableError)
    const retry = store.get()
    loads[1]!.resolve('v1')
    expect(await retry).toBe('v1')
  })
})

describe('derive', () => {
  function setup() {
    let revision = 0
    const store = createSnapshotStore({ load: async () => ({ revision: ++revision }) })
    const computed: number[] = []
    const derived = derive(store, async (snapshot) => {
      computed.push(snapshot.revision)
      return `pool@${snapshot.revision}`
    })
    return { store, derived, computed }
  }

  it('recomputes on the next read after the snapshot is invalidated', async () => {
    const { store, derived } = setup()
    expect(await derived.get()).toBe('pool@1')
    store.invalidate()
    expect(await derived.get()).toBe('pool@2')
  })

  it('computes once per snapshot, however many reads follow', async () => {
    const { store, derived, computed } = setup()
    await derived.get()
    await derived.get()
    store.invalidate()
    await derived.get()
    await derived.get()
    expect(computed).toEqual([1, 2])
  })

  it('shares one computation between concurrent reads of the same snapshot', async () => {
    const { derived, computed } = setup()
    expect(await Promise.all([derived.get(), derived.get(), derived.get()])).toEqual(['pool@1', 'pool@1', 'pool@1'])
    expect(computed).toEqual([1])
  })

  it('keeps the newer value when a computation for a replaced snapshot finishes later', async () => {
    let revision = 0
    const store = createSnapshotStore({ load: async () => ({ revision: ++revision }) })
    const gates: Array<() => void> = []
    const derived = derive(store, snapshot => new Promise<string>((resolve) => {
      gates.push(() => resolve(`pool@${snapshot.revision}`))
    }))
    const before = derived.get()
    await vi.waitFor(() => expect(gates).toHaveLength(1))
    store.invalidate()
    const after = derived.get()
    await vi.waitFor(() => expect(gates).toHaveLength(2))
    gates[1]!()
    expect(await after).toBe('pool@2')
    gates[0]!()
    expect(await before).toBe('pool@1')
    expect(await derived.get()).toBe('pool@2')
    expect(gates).toHaveLength(2)
  })

  it('does not keep a failed computation, so the next read retries', async () => {
    const store = createSnapshotStore({ load: async () => ({ revision: 1 }) })
    let attempts = 0
    const derived = derive(store, () => {
      attempts++
      if (attempts === 1) throw new Error('words unavailable')
      return 'pool'
    })
    await expect(derived.get()).rejects.toThrow('words unavailable')
    expect(await derived.get()).toBe('pool')
    expect(attempts).toBe(2)
  })
})

describe('archive search folding', () => {
  it('finds đ with d and Đ with d, and the other way round', () => {
    const data = rows()
    data.areas.push(area({ id: id(90), kind: 'settlement', name: 'Đurđekovec', slug: 'durdekovec', parent_id: ID.town }))
    const built = buildPublicContent(data, { loadedAt: 0 })
    const titles = (q: string) => archiveSearch(built, q).groups.flatMap(g => g.hits.map(h => h.title))
    expect(titles('durdekovec')).toContain('Đurđekovec')
    expect(titles('ĐURĐEK')).toContain('Đurđekovec')
    expect(titles('đurđ')).toContain('Đurđekovec')
  })

  it('returns every hit of one group when asked for it', () => {
    const all = archiveSearch(content, 'k', 1)
    const only = archiveSearch(content, 'k', Number.MAX_SAFE_INTEGER, 'places')
    expect(only.groups.map(g => g.key)).toEqual(['places'])
    expect(only.groups[0]!.hits.length).toBe(only.groups[0]!.total)
    expect(all.groups.find(g => g.key === 'places')!.total).toBe(only.total)
  })
})
