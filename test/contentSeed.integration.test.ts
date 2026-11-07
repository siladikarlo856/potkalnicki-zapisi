import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import municipalities from './fixtures/atlas/municipalities.json'
import settlements from './fixtures/atlas/settlements.json'
import sources from './fixtures/atlas/sources.json'
import heritage from './fixtures/atlas/heritage.json'
import wordAreas from './fixtures/heritage/areas.json'
import dataset from './fixtures/atlas/dataset.json'
import catalog from '../server/data/places/hr.json'
import { integrationDb } from './support/integrationDb'

// The atlas import (*_seed_content.sql) as applied to a real Postgres, checked field by field against the
// content files it came from. Run with `node scripts/test-challenges.mjs`, which applies every migration to
// a disposable Postgres; skipped everywhere else. Other suites add their own rows to the same tables, so
// every query here starts from the imported ids (through content_legacy_ids), never from table totals.
// The Croatian labels the import gave the ten heritage categories, in display order.
const HERITAGE_CATEGORY_LABELS: Record<string, string> = {
  'church': 'Crkva',
  'cathedral': 'Katedrala',
  'chapel': 'Kapela',
  'chapel-shrine': 'Kapela / svetište',
  'wayside-shrine': 'Kapelica / poklonac',
  'cross': 'Križ',
  'statue': 'Kip',
  'monastery': 'Samostan',
  'archaeological-site': 'Arheološki lokalitet',
  'historical-site': 'Povijesni lokalitet'
}

const db = await integrationDb()
const { sql } = db
// A database row as JSON; key is the old id it was looked up by.
type Row = Record<string, unknown> & { id: string, key: string }
const rows = <T = Record<string, unknown>>(query: string): T[] => JSON.parse(sql(`select coalesce(json_agg(t), '[]') from (${query}) t;`))
const list = (values: string[]) => values.map(v => `'${v.replace(/'/g, '\'\'')}'`).join(', ')
const byKey = <T>(values: T[], key: (value: T) => string) => new Map(values.map(v => [key(v), v]))

const migration = readdirSync(new URL('../supabase/migrations/', import.meta.url)).find(f => f.endsWith('_seed_content.sql'))!
const datasetItems = byKey(dataset.items, i => i.id)

// Imported rows, each joined to the old id it was imported under.
const AREAS = `select l.legacy_id as key, a.*, p.kind as parent_kind,
    (select array_agg(pl.legacy_id order by pl.legacy_id) from public.content_legacy_ids pl where pl.kind = 'area' and pl.entity_id = a.parent_id) as parent_keys,
    (select array_agg(r.slug) from public.area_regions ar join public.areas r on r.id = ar.region_id where ar.area_id = a.id) as regions
  from public.content_legacy_ids l join public.areas a on a.id = l.entity_id left join public.areas p on p.id = a.parent_id
  where l.kind = 'area'`

// The import key of every imported row (the alias rows for other old ids are left out).
const IMPORT_KEYS = [
  ...['hr', 'hr-kkz', 'potkalnicko-prigorje', ...municipalities.map(m => m.id), ...settlements.map(s => s.id)].map(k => ['area', k]),
  ...Object.keys(HERITAGE_CATEGORY_LABELS).map(k => ['heritage_category', k]),
  ...sources.map(s => ['source', s.id]),
  ...heritage.map(h => ['heritage_item', h.id])
]
const IMPORTED = `select l.* from public.content_legacy_ids l
  join (values ${IMPORT_KEYS.map(([kind, key]) => `('${kind}', '${key}')`).join(', ')}) k(kind, key) on k.kind = l.kind and k.key = l.legacy_id`

describe.skipIf(!db.enabled)('atlas content import on Postgres', () => {
  it('imports the country, county, region and the five towns and municipalities', () => {
    const areas = byKey(rows<Row>(`${AREAS} and l.legacy_id in (${list(['hr', 'hr-kkz', 'potkalnicko-prigorje', ...municipalities.map(m => m.id)])})`), a => a.key)
    expect(areas.size).toBe(8)
    const country = wordAreas.find(a => a.kind === 'country')!
    const county = wordAreas.find(a => a.kind === 'county')!
    expect(areas.get('hr')).toMatchObject({ kind: 'country', name: country.name, parent_id: null, status: 'published' })
    expect(areas.get('hr-kkz')).toMatchObject({ kind: 'county', name: county.name, parent_keys: ['hr'], status: 'published' })
    expect(areas.get('potkalnicko-prigorje')).toMatchObject({ kind: 'region', name: 'Potkalničko prigorje', slug: 'potkalnicko-prigorje', parent_keys: ['hr-kkz'], status: 'published' })

    for (const m of municipalities) {
      const area = areas.get(m.id)!
      const kind = m.name.startsWith('Grad ') ? 'town' : 'municipality'
      expect(area, m.id).toMatchObject({
        kind, name: m.catalogName, slug: m.slug, parent_keys: ['hr-kkz'], regions: ['potkalnicko-prigorje'], status: 'published', revision: 1
      })
      // The public label ("Grad Križevci", "Općina Kalnik") is the kind prefix plus the stored name.
      expect(`${kind === 'town' ? 'Grad' : 'Općina'} ${String(area.name)}`).toBe(m.name)
    }
    expect(rows(`select ar.area_id from public.area_regions ar where ar.region_id = '${areas.get('potkalnicko-prigorje')!.id}'`)).toHaveLength(5)
  })

  it('imports all 135 settlements with their codes, GeoNames ids, centroids and municipality', () => {
    const areas = byKey(rows<Row>(`${AREAS} and l.legacy_id in (${list(settlements.map(s => s.id))})`), a => a.key)
    expect(areas.size).toBe(135)
    for (const s of settlements) {
      const area = areas.get(s.id)!
      const place = catalog.places.filter(p => p.active && p.officialCode === s.id)
      expect(place, s.id).toHaveLength(1)
      expect(area, s.id).toMatchObject({
        kind: 'settlement', name: s.name, slug: s.slug, official_code: s.id, geonames_id: place[0]!.sourceId,
        latitude: s.centroid?.lat ?? null, longitude: s.centroid?.lng ?? null, parent_kind: municipalities.find(m => m.id === s.municipalityId)!.name.startsWith('Grad ') ? 'town' : 'municipality',
        status: 'published', revision: 1
      })
      expect(area.parent_keys, s.id).toContain(s.municipalityId)
    }
  })

  it('maps the old word-area keys to the same towns and municipalities', () => {
    const resolve = (key: string) => sql(`select entity_id from public.content_legacy_ids where kind = 'area' and legacy_id = '${key}';`)
    expect(resolve('hr-kkz-krizevci')).toBe(resolve('krizevci'))
    expect(resolve('hr-kkz-sveti-petar-orehovec')).toBe(resolve('svetiPetarOrehovec'))
    expect(resolve('hr-kkz-krizevci')).not.toBe('')
  })

  it('imports the heritage categories with their labels in order', () => {
    const categories = rows<Row>(`select c.* from public.content_legacy_ids l join public.heritage_categories c on c.id = l.entity_id where l.kind = 'heritage_category' order by c.sort`)
      .filter(c => c.key in HERITAGE_CATEGORY_LABELS)
    expect(categories.map(c => [c.key, c.label_hr])).toEqual(Object.entries(HERITAGE_CATEGORY_LABELS))
    expect(categories.every(c => c.status === 'published' && c.label_en === null)).toBe(true)
  })

  it('imports the ten sources', () => {
    const imported = byKey(rows<Row>(`select l.legacy_id as key, s.* from public.content_legacy_ids l join public.sources s on s.id = l.entity_id where l.kind = 'source' and l.legacy_id in (${list(sources.map(s => s.id))})`), s => s.key)
    expect(imported.size).toBe(10)
    for (const s of sources) expect(imported.get(s.id), s.id).toMatchObject({ title: s.title, type: s.type, url: s.url, note: null, status: 'published' })
  })

  it('imports all 107 heritage items field by field, with the dataset fields and ordered sources', () => {
    const items = byKey(rows<Row>(`select l.legacy_id as key, i.*, c.key as category,
        m.legacy_id as municipality_key, s.official_code as settlement_code,
        (select array_agg(sl.legacy_id order by hs.position) from public.heritage_item_sources hs
          join public.content_legacy_ids sl on sl.kind = 'source' and sl.entity_id = hs.source_id where hs.item_id = i.id) as source_ids
      from public.content_legacy_ids l join public.heritage_items i on i.id = l.entity_id
      join public.heritage_categories c on c.id = i.category_id
      join public.content_legacy_ids m on m.kind = 'area' and m.entity_id = i.municipality_id and m.legacy_id in (${list(municipalities.map(m => m.id))})
      left join public.areas s on s.id = i.settlement_id
      where l.kind = 'heritage_item' and l.legacy_id in (${list(heritage.map(h => h.id))})`), i => i.key)
    expect(items.size).toBe(107)
    for (const h of heritage) {
      const item = items.get(h.id)!
      const source = datasetItems.get(h.legacyId)!
      expect(item, h.id).toMatchObject({
        name: h.name, slug: h.slug, category: h.category, municipality_key: h.municipalityId, settlement_code: h.settlementCode,
        locality: 'locality' in h ? h.locality : null, verification: h.status, research_notes: h.researchNotes, noindex: h.noindex,
        source_ids: h.sourceIds, dataset_id: h.legacyId, status: 'published', revision: 1,
        heritage_status: source.heritageStatus, registry_number: source.registryNumber, period: source.period,
        description: null, latitude: null, longitude: null, credits: []
      })
    }
    const values = [...items.values()]
    expect(values.filter(i => i.period !== null)).toHaveLength(7)
    expect(values.filter(i => i.registry_number !== null)).toHaveLength(19)
    expect(values.filter(i => i.heritage_status === 'historical_site')).toHaveLength(7)
    expect(values.filter(i => i.settlement_id === null)).toHaveLength(12)
    // The dataset ids with diacritics resolve to the same items.
    for (const h of heritage.filter(h => h.legacyId !== h.id)) {
      expect(sql(`select entity_id from public.content_legacy_ids where kind = 'heritage_item' and legacy_id = '${h.legacyId}';`), h.legacyId).toBe(items.get(h.id)!.id)
    }
  })

  it('uses deterministic ids, writes import history and keeps search text', () => {
    // Each import key gives the id content_uuid('<kind>:<key>').
    expect(sql(`select count(*), count(*) filter (where entity_id = public.content_uuid(kind || ':' || legacy_id)) from (${IMPORTED}) t;`)).toBe('270|270')

    const history = rows(`select r.entity_kind, string_agg(distinct r.revision || ' ' || r.action || ' ' || r.actor, ',') as actions, count(*)::int as n
      from (${IMPORTED}) t join public.content_revisions r on r.entity_id = t.entity_id group by r.entity_kind order by r.entity_kind`)
    expect(history).toEqual([
      { entity_kind: 'area', actions: '1 insert import', n: 143 },
      { entity_kind: 'heritage_category', actions: '1 insert import', n: 10 },
      { entity_kind: 'heritage_item', actions: '1 insert import', n: 107 },
      { entity_kind: 'source', actions: '1 insert import', n: 10 }
    ])
    expect(sql(`select search_text from public.heritage_items where id = public.content_uuid('heritage_item:krizevci-crkva-sv-ane');`)).toBe('crkva sv. ane crkva-sv-ane')
    expect(sql(`select search_text from public.areas where id = public.content_uuid('area:032379');`)).toBe('krizevci krizevci 032379 settlement')
  })

  it('replays as a no-op', () => {
    const snapshot = () => sql(`with imported as (${IMPORTED})
      select (select count(*) || ' ' || max(r.id) from public.content_revisions r join imported using (entity_id))
        || ' ' || (select count(*) from public.content_legacy_ids l where l.entity_id in (select entity_id from imported))
        || ' ' || (select md5(string_agg(a::text, ',' order by a.id)) from public.areas a join imported i on i.entity_id = a.id)
        || ' ' || (select md5(string_agg(c::text, ',' order by c.id)) from public.heritage_categories c join imported i on i.entity_id = c.id)
        || ' ' || (select md5(string_agg(s::text, ',' order by s.id)) from public.sources s join imported i on i.entity_id = s.id)
        || ' ' || (select md5(string_agg(h::text, ',' order by h.id)) from public.heritage_items h join imported i on i.entity_id = h.id)
        || ' ' || (select md5(string_agg(hs::text, ',' order by hs.item_id, hs.position)) from public.heritage_item_sources hs join imported i on i.entity_id = hs.item_id)
        || ' ' || (select count(*) from public.area_regions ar join imported i on i.entity_id = ar.area_id);`)
    const before = snapshot()
    sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'))
    expect(snapshot()).toBe(before)
  })
})
