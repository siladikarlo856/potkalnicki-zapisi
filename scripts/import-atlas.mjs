#!/usr/bin/env node
/**
 * Re-import sacral heritage catalog → content/atlas/*.json, sitemap, prerender list.
 * Source: data/heritage/heritage-sakralna-bastina-potkalnickog-prigorja.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import catalog from '../server/data/places/hr.json' with { type: 'json' }

function atlasSlug(value) {
  return value
    .toLocaleLowerCase('hr')
    .replaceAll('đ', 'dj')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeHeritageId(legacyId) {
  return legacyId
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'dj')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SOURCE = join(ROOT, 'data/heritage/heritage-sakralna-bastina-potkalnickog-prigorja.json')
const OUT = join(ROOT, 'content/atlas')
const REPORT = join(ROOT, 'content/atlas/import-report.json')
const SITEMAP = join(ROOT, 'public/sitemap.xml')
const PRERENDER = join(ROOT, 'content/atlas/prerender-routes.json')

const CATALOG_MUNICIPALITIES = [
  'Križevci',
  'Kalnik',
  'Gornja Rijeka',
  'Sveti Petar Orehovec',
  'Sveti Ivan Žabno'
]

const MUNICIPALITIES = [
  { id: 'krizevci', slug: 'grad-krizevci', name: 'Grad Križevci', catalogName: 'Križevci' },
  { id: 'kalnik', slug: 'opcina-kalnik', name: 'Općina Kalnik', catalogName: 'Kalnik' },
  { id: 'gornjaRijeka', slug: 'opcina-gornja-rijeka', name: 'Općina Gornja Rijeka', catalogName: 'Gornja Rijeka' },
  { id: 'svetiPetarOrehovec', slug: 'opcina-sveti-petar-orehovec', name: 'Općina Sveti Petar Orehovec', catalogName: 'Sveti Petar Orehovec' },
  { id: 'svetiIvanZabno', slug: 'opcina-sveti-ivan-zabno', name: 'Općina Sveti Ivan Žabno', catalogName: 'Sveti Ivan Žabno' }
]

const JSON_MUNI_TO_ID = Object.fromEntries(
  MUNICIPALITIES.flatMap(m => [
    [`Grad ${m.catalogName === 'Križevci' ? 'Križevci' : m.catalogName}`, m.id],
    [`Općina ${m.catalogName}`, m.id]
  ])
)
JSON_MUNI_TO_ID['Grad Križevci'] = 'krizevci'

/** Certain typo fixes from scout report §7 */
const TYPO_FIX = new Map([
  ['Povelič', 'Povelić'],
  ['Raščani', 'Rašćani'],
  ['Donja Brckovština', 'Donja Brckovčina'],
  ['Poljana', 'Poljana Križevačka']
])

/** Unambiguous official settlement + locality label */
const LOCALITY_ON = new Map([
  ['Zaistovec – Bregi', { name: 'Zaistovec', locality: 'Bregi' }],
  ['Zaistovec – Dubravci', { name: 'Zaistovec', locality: 'Dubravci' }],
  ['Veliki Kalnik', { name: 'Kalnik', locality: 'Veliki Kalnik' }]
])

function fold(value, dj = false) {
  return value.toLocaleLowerCase('hr').replaceAll('đ', dj ? 'dj' : 'd')
    .normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim()
}

function dump(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const text = JSON.stringify(value, null, 2) + '\n'
  writeFileSync(path, text)
}

function dumpLines(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n')
}

function isThinGenericName(name) {
  if (/^(Raspelo|Poklonac|Kapela na groblju)([\s\d-]|$)/i.test(name)) return true
  return ['Raspelo', 'Poklonac', 'Kapela na groblju'].includes(name)
}

function mapResearchStatus(value) {
  if (value === 'partially_verified') return 'in_review'
  if (value === 'verified') return 'verified'
  return 'unverified'
}

const catalogPlaces = catalog.places.filter(
  p => p.active && p.countryCode === 'HR' && CATALOG_MUNICIPALITIES.includes(p.municipality)
)

const byName = new Map()
for (const place of catalogPlaces) {
  for (const label of [place.name, ...place.aliases]) {
    byName.set(fold(label), place)
    byName.set(fold(label, true), place)
  }
}

const settlements = catalogPlaces.map((place) => {
  const municipalityId = MUNICIPALITIES.find(m => m.catalogName === place.municipality).id
  return {
    id: place.officialCode,
    slug: atlasSlug(place.name),
    name: place.name,
    municipalityId,
    centroid: place.latitude != null && place.longitude != null
      ? { lat: place.latitude, lng: place.longitude }
      : null
  }
}).sort((a, b) => a.name.localeCompare(b.name, 'hr') || a.id.localeCompare(b.id))

const slugByCode = new Map(settlements.map(s => [s.id, s.slug]))

const src = JSON.parse(readFileSync(SOURCE, 'utf8'))
const report = {
  generatedAt: new Date().toISOString(),
  unmappedSettlements: [],
  localityOnly: [],
  notes: []
}

const sources = src.sources.map(s => ({
  id: s.id,
  title: s.title,
  type: s.type,
  url: s.url ?? null
}))

const sourceIds = new Set(sources.map(s => s.id))

const heritage = src.items.map((item) => {
  const municipalityId = JSON_MUNI_TO_ID[item.municipality]
  if (!municipalityId) throw new Error(`Unknown municipality: ${item.municipality}`)

  let settlementLabel = item.settlement
  if (TYPO_FIX.has(settlementLabel)) settlementLabel = TYPO_FIX.get(settlementLabel)

  let settlementCode = null
  let locality = undefined

  if (LOCALITY_ON.has(item.settlement)) {
    const { name, locality: loc } = LOCALITY_ON.get(item.settlement)
    const place = byName.get(fold(name)) || byName.get(fold(name, true))
    if (place && place.municipality === MUNICIPALITIES.find(m => m.id === municipalityId).catalogName) {
      settlementCode = place.officialCode
      locality = loc
      report.localityOnly.push({ itemId: item.id, settlement: item.settlement, official: name, locality: loc })
    } else {
      report.unmappedSettlements.push({ itemId: item.id, name: item.name, settlement: item.settlement, reason: 'locality mapping failed' })
    }
  } else {
    const place = byName.get(fold(settlementLabel)) || byName.get(fold(settlementLabel, true))
    if (place && place.municipality === MUNICIPALITIES.find(m => m.id === municipalityId).catalogName) {
      settlementCode = place.officialCode
    } else {
      report.unmappedSettlements.push({
        itemId: item.id,
        name: item.name,
        settlement: item.settlement,
        reason: place ? 'municipality mismatch' : 'no official settlement match'
      })
    }
  }

  for (const sid of item.sources) {
    if (!sourceIds.has(sid)) throw new Error(`Missing source ${sid} on ${item.id}`)
  }

  const id = normalizeHeritageId(item.id)
  const noindex = !item.description && isThinGenericName(item.name)

  return {
    id,
    legacyId: item.id,
    slug: item.slug,
    name: item.name,
    category: item.category,
    municipalityId,
    settlementCode,
    ...(locality ? { locality } : {}),
    sourceIds: item.sources,
    status: mapResearchStatus(item.researchStatus),
    researchNotes: item.researchNotes,
    noindex
  }
})

// Validate uniqueness (settlementCode, slug) for items that have settlement
const pairKeys = new Set()
for (const item of heritage) {
  if (!item.settlementCode) continue
  const key = `${item.settlementCode}:${item.slug}`
  if (pairKeys.has(key)) throw new Error(`Duplicate settlement slug: ${key}`)
  pairKeys.add(key)
}

dump(join(OUT, 'municipalities.json'), MUNICIPALITIES)
dumpLines(join(OUT, 'settlements.json'), settlements)
dump(join(OUT, 'sources.json'), sources)
dumpLines(join(OUT, 'heritage.json'), heritage)
dump(REPORT, report)

const base = 'https://karlo-siladi.from.hr'
const staticUrls = [
  '/',
  '/en',
  '/potkalnicko-prigorje',
  '/potkalnicko-prigorje/igre',
  '/potkalnicko-prigorje/doprinesi',
  '/potkalnicko-prigorje/o-projektu',
  '/potkalnicko-prigorje/igre/kartice',
  '/potkalnicko-prigorje/igre/kviz',
  '/potkalnicko-prigorje/privatnost',
  '/potkalnicko-prigorje/istrazi',
  '/potkalnicko-prigorje/bastina'
]

const itemPath = item => `/potkalnicko-prigorje/bastina/${slugByCode.get(item.settlementCode)}/${item.slug}`
const placedItems = heritage.filter(item => item.settlementCode)
const dynamicUrls = [
  ...MUNICIPALITIES.map(m => `/potkalnicko-prigorje/istrazi/${m.slug}`),
  ...settlements.map(s => `/potkalnicko-prigorje/naselja/${s.slug}`),
  ...placedItems.map(itemPath)
]
const indexableDynamicUrls = [
  ...dynamicUrls.slice(0, MUNICIPALITIES.length + settlements.length),
  ...placedItems.filter(item => !item.noindex).map(itemPath)
]

const prerenderRoutes = [...staticUrls.slice(2), ...dynamicUrls]
dump(PRERENDER, prerenderRoutes)

const sitemapUrls = [...staticUrls, ...indexableDynamicUrls]
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  sitemapUrls.map(path => `  <url>\n    <loc>${base}${path}</loc>\n  </url>`).join('\n')
}\n</urlset>\n`
writeFileSync(SITEMAP, xml)

console.log(`Atlas import: ${heritage.length} items, ${settlements.length} settlements, ${report.unmappedSettlements.length} unmapped labels`)
