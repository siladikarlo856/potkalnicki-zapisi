#!/usr/bin/env node
/**
 * One-time import of the atlas content into the content tables (20261103010000_content_tables.sql).
 *
 * Reads content/atlas/*.json, the word-area keys in content/heritage/areas.json, the source dataset
 * (data/heritage/…json, for the fields the atlas import dropped: period, registry number, heritage status)
 * and the place catalog (server/data/places/hr.json, for each settlement's GeoNames id), and renders the
 * seed migration supabase/migrations/<version>_seed_content.sql.
 *
 *   node scripts/generate-content-seed.mjs            rewrite the seed migration
 *   node scripts/generate-content-seed.mjs --check    exit 1 when the committed migration differs
 *
 * Once the migration is applied anywhere it must not change; test/contentSeed.test.ts fails when the
 * JSON drifts from it. Content edits after the import belong in the database (the admin), not the JSON.
 *
 * Every imported row gets a deterministic id, contentUuid('<kind>:<import key>'), so local, CI and
 * production hold the same ids. The import key is the row's pre-UUID id and is recorded, together with any
 * other old id of the same row, in content_legacy_ids.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MIGRATIONS = join(ROOT, 'supabase/migrations')
const SEED_SUFFIX = '_seed_content.sql'
const DEFAULT_VERSION = '20261103020000'

/** The region the atlas covers; its members are every atlas municipality. */
const REGION = { key: 'potkalnicko-prigorje', name: 'Potkalničko prigorje', slug: 'potkalnicko-prigorje' }

/** Croatian category labels, in display order (shared/utils/atlasData.ts HERITAGE_CATEGORY_LABELS). */
const CATEGORY_LABELS = {
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

/** Town or municipality, from the display name ("Grad Križevci" / "Općina Kalnik"). */
const LAU_PREFIXES = { town: 'Grad ', municipality: 'Općina ' }

/**
 * Node twin of public.content_uuid: MD5 of the name with the UUIDv8 version nibble and RFC 9562 variant bits.
 * @param {string} name
 */
export function contentUuid(name) {
  const b = createHash('md5').update(name).digest()
  b[6] = (b[6] & 0x0f) | 0x80
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = b.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** @param {string} path */
const readJson = path => JSON.parse(readFileSync(join(ROOT, path), 'utf8'))

/**
 * @param {boolean} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function check(condition, message) {
  if (!condition) throw new Error(`Content seed: ${message}`)
}

/**
 * Builds the rows to import from the content files. Throws when the files disagree with each other.
 * Rows use the content tables' column names.
 */
export function buildContentRows() {
  const municipalities = readJson('content/atlas/municipalities.json')
  const settlements = readJson('content/atlas/settlements.json')
  const sources = readJson('content/atlas/sources.json')
  const heritage = readJson('content/atlas/heritage.json')
  const wordAreas = readJson('content/heritage/areas.json')
  const dataset = readJson('data/heritage/heritage-sakralna-bastina-potkalnickog-prigorja.json')
  const catalog = readJson('server/data/places/hr.json')

  /** @type {Record<string, unknown>[]} */
  const areas = []
  /** @type {{ kind: string, legacy_id: string, entity_id: string }[]} */
  const legacyIds = []
  /** @param {string} kind @param {string} legacyId @param {string} entityId */
  const alias = (kind, legacyId, entityId) => legacyIds.push({ kind, legacy_id: legacyId, entity_id: entityId })
  const areaId = /** @param {string} key */ key => contentUuid(`area:${key}`)
  /** @param {Record<string, unknown>} row @param {string} key */
  const addArea = (row, key) => {
    const id = areaId(key)
    areas.push({
      id, kind: row.kind, parent_id: row.parent_id ?? null, name: row.name, slug: row.slug ?? null,
      official_code: row.official_code ?? null, geonames_id: row.geonames_id ?? null,
      latitude: row.latitude ?? null, longitude: row.longitude ?? null, status: 'published'
    })
    alias('area', key, id)
    return id
  }

  // Country and county: the roots of the word-area hierarchy, keyed as words use them today.
  const country = wordAreas.filter(a => a.kind === 'country')
  const county = wordAreas.filter(a => a.kind === 'county')
  check(country.length === 1 && county.length === 1 && county[0].parentId === country[0].id,
    'content/heritage/areas.json must hold one country and one county below it')
  addArea({ kind: 'country', name: country[0].name }, country[0].id)
  const countyId = addArea({ kind: 'county', parent_id: areaId(country[0].id), name: county[0].name }, county[0].id)
  const regionId = addArea({ kind: 'region', parent_id: countyId, name: REGION.name, slug: REGION.slug }, REGION.key)

  /** @type {Map<string, { id: string, kind: string, catalogName: string }>} */
  const lau = new Map()
  for (const m of municipalities) {
    const kind = Object.keys(LAU_PREFIXES).find(k => m.name === LAU_PREFIXES[k] + m.catalogName)
    check(Boolean(kind), `municipality ${m.id} name must be "Grad <catalog name>" or "Općina <catalog name>"`)
    // The stored name is the bare place name; "Grad"/"Općina" is derived from the kind for display.
    const id = addArea({ kind, parent_id: countyId, name: m.catalogName, slug: m.slug }, m.id)
    lau.set(m.id, { id, kind: /** @type {string} */ (kind), catalogName: m.catalogName })
  }
  const regionMembers = [...lau.values()].map(m => ({ area_id: m.id, region_id: regionId }))

  // Word usages point at town and municipality keys of their own (hr-kkz-krizevci); they name the same areas.
  for (const a of wordAreas.filter(a => a.kind !== 'country' && a.kind !== 'county')) {
    const match = [...lau.values()].find(m => m.kind === a.kind && m.catalogName === a.name)
    check(Boolean(match) && a.parentId === county[0].id, `word area ${a.id} matches no atlas town or municipality`)
    alias('area', a.id, /** @type {{ id: string }} */ (match).id)
  }

  /** @type {Map<string, { id: string, municipalityId: string }>} */
  const settlementByCode = new Map()
  for (const s of settlements) {
    const municipality = lau.get(s.municipalityId)
    check(Boolean(municipality), `settlement ${s.id} has unknown municipality ${s.municipalityId}`)
    const places = catalog.places.filter(p => p.active && p.countryCode === 'HR' && p.officialCode === s.id)
    check(places.length === 1, `settlement ${s.id} must match exactly one active catalog place, found ${places.length}`)
    const place = places[0]
    check(place.municipality === municipality.catalogName && place.id === `geonames:${place.sourceId}`,
      `catalog place for settlement ${s.id} is in ${place.municipality}, not ${municipality.catalogName}`)
    const id = addArea({
      kind: 'settlement', parent_id: municipality.id, name: s.name, slug: s.slug, official_code: s.id,
      geonames_id: place.sourceId, latitude: s.centroid?.lat ?? null, longitude: s.centroid?.lng ?? null
    }, s.id)
    settlementByCode.set(s.id, { id, municipalityId: s.municipalityId })
  }

  check(JSON.stringify(dataset.categories) === JSON.stringify(Object.keys(CATEGORY_LABELS)),
    'dataset categories differ from the category labels; add the new label here')
  const categories = Object.entries(CATEGORY_LABELS).map(([key, label], index) => {
    const id = contentUuid(`heritage_category:${key}`)
    alias('heritage_category', key, id)
    return { id, key, label_hr: label, label_en: null, sort: (index + 1) * 10, status: 'published' }
  })
  const categoryIds = new Map(categories.map(c => [c.key, c.id]))

  const sourceRows = sources.map((s) => {
    const id = contentUuid(`source:${s.id}`)
    alias('source', s.id, id)
    return { id, title: s.title, type: s.type, url: s.url ?? null, note: null, status: 'published' }
  })
  const sourceIds = new Map(sources.map((s, i) => [s.id, sourceRows[i].id]))

  const datasetItems = new Map(dataset.items.map(item => [item.id, item]))
  /** @type {{ item_id: string, source_id: string, position: number }[]} */
  const itemSources = []
  const items = heritage.map((item) => {
    const id = contentUuid(`heritage_item:${item.id}`)
    const source = datasetItems.get(item.legacyId)
    check(Boolean(source), `heritage item ${item.id} has no dataset record ${item.legacyId}`)
    const municipality = lau.get(item.municipalityId)
    check(Boolean(municipality), `heritage item ${item.id} has unknown municipality ${item.municipalityId}`)
    const settlement = item.settlementCode === null ? null : settlementByCode.get(item.settlementCode)
    check(settlement !== undefined, `heritage item ${item.id} has unknown settlement ${item.settlementCode}`)
    check(settlement === null || settlement.municipalityId === item.municipalityId,
      `heritage item ${item.id} settlement is outside its municipality`)
    check(categoryIds.has(item.category), `heritage item ${item.id} has unknown category ${item.category}`)
    item.sourceIds.forEach((sourceId, position) => {
      check(sourceIds.has(sourceId), `heritage item ${item.id} cites unknown source ${sourceId}`)
      itemSources.push({ item_id: id, source_id: /** @type {string} */ (sourceIds.get(sourceId)), position })
    })
    alias('heritage_item', item.id, id)
    if (item.legacyId !== item.id) alias('heritage_item', item.legacyId, id)
    return {
      id,
      name: item.name,
      slug: item.slug,
      category_id: categoryIds.get(item.category),
      municipality_id: municipality.id,
      settlement_id: settlement?.id ?? null,
      locality: item.locality ?? null,
      verification: item.status,
      heritage_status: source.heritageStatus ?? null,
      registry_number: source.registryNumber ?? null,
      period: source.period ?? null,
      description: source.description ?? null,
      research_notes: item.researchNotes,
      latitude: source.location?.latitude ?? null,
      longitude: source.location?.longitude ?? null,
      noindex: item.noindex,
      dataset_id: item.legacyId,
      status: 'published'
    }
  })

  return { areas, regionMembers, categories, sources: sourceRows, items, itemSources, legacyIds }
}

/** @param {unknown} value */
function literal(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') {
    check(Number.isFinite(value), `non-finite number ${value}`)
    return String(value)
  }
  return `'${String(value).replaceAll('\'', '\'\'')}'`
}

/**
 * One insert per row, so a review diff and a failure both point at a single row.
 * @param {string} table
 * @param {Record<string, unknown>[]} rows
 * @param {string} conflict
 */
function inserts(table, rows, conflict) {
  return rows.map((row) => {
    const columns = Object.keys(row)
    return `insert into public.${table} (${columns.join(', ')}) values (${columns.map(c => literal(row[c])).join(', ')}) on conflict ${conflict} do nothing;`
  }).join('\n')
}

/** Renders the seed migration. Pure: the same content files always give the same text. */
export function buildContentSeed() {
  const rows = buildContentRows()
  const count = /** @param {string} kind */ kind => rows.areas.filter(a => a.kind === kind).length
  return `-- One-time import of the atlas content into the content tables. Generated by scripts/generate-content-seed.mjs
-- from content/atlas/*.json, content/heritage/areas.json, the source dataset in data/heritage/ (period,
-- registry number, heritage status) and server/data/places/hr.json (GeoNames ids); do not edit by hand.
--
-- Rows: ${rows.areas.length} areas (${count('country')} country, ${count('county')} county, ${count('region')} region, ${count('town')} town, ${count('municipality')} municipalities, ${count('settlement')} settlements),
-- ${rows.regionMembers.length} region memberships, ${rows.categories.length} heritage categories, ${rows.sources.length} sources, ${rows.items.length} heritage items with ${rows.itemSources.length} ordered source links,
-- and ${rows.legacyIds.length} legacy ids. Every row is published.
--
-- Ids are deterministic, content_uuid('<kind>:<import key>'), so every environment holds the same ids. The import
-- key is the pre-UUID id: the word-area key for the country and county (hr, hr-kkz), the municipality key
-- (krizevci), the DGU code for settlements, the category key, the source id and the ASCII item id.
-- content_legacy_ids maps each of these, plus the word-area keys of towns and municipalities (hr-kkz-krizevci)
-- and the dataset item ids with diacritics, to the new id.
--
-- Additive and idempotent: inserts only, each with on conflict do nothing, so a replay never overwrites a
-- later edit. Nothing reads these tables yet, so the running app is unaffected. History rows are written
-- by the content triggers with actor 'import'.
begin;

set local app.actor = 'import';

-- Areas, parents first: country, county, region, towns and municipalities, settlements.
${inserts('areas', rows.areas, '(id)')}

-- Region membership: every atlas town and municipality belongs to ${REGION.name}.
${inserts('area_regions', rows.regionMembers, '(area_id, region_id)')}

-- Heritage categories.
${inserts('heritage_categories', rows.categories, '(id)')}

-- Sources.
${inserts('sources', rows.sources, '(id)')}

-- Heritage items.
${inserts('heritage_items', rows.items, '(id)')}

-- Ordered sources cited by each item.
${inserts('heritage_item_sources', rows.itemSources, '(item_id, source_id)')}

-- Old ids → new ids.
${inserts('content_legacy_ids', rows.legacyIds, '(kind, legacy_id)')}

commit;
`
}

/** The committed seed migration (the one *_seed_content.sql file), or a new path for the given version. */
export function seedMigrationPath(version = DEFAULT_VERSION) {
  const existing = readdirSync(MIGRATIONS).filter(f => f.endsWith(SEED_SUFFIX))
  check(existing.length <= 1, `more than one *${SEED_SUFFIX} migration: ${existing.join(', ')}`)
  return join(MIGRATIONS, existing[0] ?? `${version}${SEED_SUFFIX}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = seedMigrationPath()
  const sql = buildContentSeed()
  if (process.argv.includes('--check')) {
    let current = ''
    try {
      current = readFileSync(path, 'utf8')
    } catch { /* missing counts as different */ }
    if (current !== sql) {
      console.error(`${path} differs from the content files`)
      process.exitCode = 1
    }
  } else {
    writeFileSync(path, sql)
    console.log(`Wrote ${path}`)
  }
}
