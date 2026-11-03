import type {
  AtlasHeritageListResponse,
  AtlasMunicipalityResponse,
  AtlasOverviewResponse,
  AtlasSettlementResponse,
  ContentSearchResponse,
  ContentTargetResponse,
  PublicCategoryRef,
  PublicHeritageItem,
  PublicHeritageListItem,
  PublicMunicipalityRef,
  PublicPlaceStats,
  PublicSettlementRef,
  SuggestOptionsResponse
} from '../../shared/types/publicAtlas'
import { pzRoutes } from '../../shared/utils/appRoutes'
import { slugHistoryKey } from './publicContent'
import type { PublicContent, SnapshotItem, SnapshotMunicipality, SnapshotSettlement } from './publicContent'

// Pure queries over the public content snapshot: route resolution (live, moved, gone or unknown) and the
// response shapes of the public atlas API. No database access, so a warm request never leaves the process.

export type Resolved<T>
  = | { status: 'ok', value: T }
    | { status: 'redirect', path: string }
    | { status: 'gone' }
    | { status: 'not_found' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const atlasMunicipalityPath = (slug: string) => `${pzRoutes.explore}/${slug}`
export const atlasSettlementPath = (slug: string) => `${pzRoutes.home}/naselja/${slug}`
export const atlasItemPath = (settlementSlug: string, slug: string) => `${pzRoutes.heritage}/${settlementSlug}/${slug}`

export function heritageItemPath(content: PublicContent, item: SnapshotItem) {
  const settlement = item.settlementId ? content.settlementById.get(item.settlementId) : undefined
  return settlement ? atlasItemPath(settlement.slug, item.slug) : null
}

type AreaNamespace = 'lau' | 'settlement'
type AreaMatch = { id: string, moved: boolean } | 'gone' | null

/** An area by its current slug, a gone slug, or an old slug from slug history (in the same URL namespace). */
function matchArea(content: PublicContent, namespace: AreaNamespace, slug: string): AreaMatch {
  const live = content.areaBySlug.get(`${namespace}/${slug}`)
  if (live) return { id: live, moved: false }
  if (content.gone.areas.has(`${namespace}/${slug}`)) return 'gone'
  const id = content.slugHistory.get(slugHistoryKey('area', namespace, null, slug))
  if (!id) return null
  if (content.gone.ids.has(id)) return 'gone'
  const found = namespace === 'lau' ? content.municipalityById.has(id) : content.settlementById.has(id)
  return found ? { id, moved: true } : null
}

function resolveArea<T>(content: PublicContent, namespace: AreaNamespace, slug: string, path: (value: T) => string, byId: Map<string, T>): Resolved<T> {
  const match = matchArea(content, namespace, slug)
  if (match === 'gone') return { status: 'gone' }
  if (!match) return { status: 'not_found' }
  const value = byId.get(match.id)!
  return match.moved ? { status: 'redirect', path: path(value) } : { status: 'ok', value }
}

export function resolveMunicipality(content: PublicContent, slug: string) {
  return resolveArea(content, 'lau', slug, m => atlasMunicipalityPath(m.slug), content.municipalityById)
}

export function resolveSettlement(content: PublicContent, slug: string) {
  return resolveArea(content, 'settlement', slug, s => atlasSettlementPath(s.slug), content.settlementById)
}

/**
 * An item page by settlement and item slug. Old settlement slugs and old item slugs (including an item
 * moved to another settlement) redirect to the current path; archived rows, or rows under an archived
 * place, are gone.
 */
export function resolveHeritageItem(content: PublicContent, settlementSlug: string, slug: string): Resolved<SnapshotItem> {
  const settlement = matchArea(content, 'settlement', settlementSlug)
  if (settlement === 'gone') return { status: 'gone' }
  if (!settlement) return { status: 'not_found' }

  let id = content.itemByRoute.get(`${settlement.id}/${slug}`)
  let moved = settlement.moved
  if (!id) {
    if (content.gone.items.has(`${settlement.id}/${slug}`)) return { status: 'gone' }
    id = content.slugHistory.get(slugHistoryKey('heritage_item', '', settlement.id, slug))
    if (id && content.gone.ids.has(id)) return { status: 'gone' }
    moved = true
  }
  const item = id ? content.itemById.get(id) : undefined
  const path = item ? heritageItemPath(content, item) : null
  if (!item || !path) return { status: 'not_found' }
  return moved ? { status: 'redirect', path } : { status: 'ok', value: item }
}

/** A UUID as is, or an old id (`krizevci`, `000299`, `krizevci-crkva-sv-ane`, a source id) through the legacy map. */
export function resolveContentId(content: PublicContent, kind: string, value: string) {
  if (UUID.test(value)) return value.toLowerCase()
  return content.legacyIds.get(`${kind}:${value}`) ?? null
}

function municipalityRef(m: SnapshotMunicipality): PublicMunicipalityRef {
  return { id: m.id, slug: m.slug, name: m.name, label: m.label, kind: m.kind, path: atlasMunicipalityPath(m.slug) }
}

function settlementRef(s: SnapshotSettlement): PublicSettlementRef {
  return { id: s.id, slug: s.slug, name: s.name, code: s.code, path: atlasSettlementPath(s.slug) }
}

function categoryRef(content: PublicContent, item: SnapshotItem): PublicCategoryRef {
  const category = content.categories.get(item.categoryId)!
  return { key: category.key, label: category.label }
}

export function heritageListItem(content: PublicContent, item: SnapshotItem): PublicHeritageListItem {
  const municipality = content.municipalityById.get(item.municipalityId)!
  const settlement = item.settlementId ? content.settlementById.get(item.settlementId) : undefined
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: categoryRef(content, item),
    municipality: { id: municipality.id, slug: municipality.slug, label: municipality.label },
    settlement: settlement ? { id: settlement.id, slug: settlement.slug, name: settlement.name } : null,
    locality: item.locality,
    verification: item.verification,
    noindex: item.noindex,
    path: heritageItemPath(content, item)
  }
}

export function heritageItemDetail(content: PublicContent, item: SnapshotItem): PublicHeritageItem {
  return {
    ...heritageListItem(content, item),
    ref: item.ref,
    heritageStatus: item.heritageStatus,
    registryNumber: item.registryNumber,
    period: item.period,
    description: item.description,
    researchNotes: item.researchNotes,
    coordinates: item.coordinates,
    credits: item.credits,
    sources: item.sourceIds.map(id => content.sources.get(id)!),
    updatedAt: item.updatedAt
  }
}

function placeStats(settlements: readonly SnapshotSettlement[], items: readonly SnapshotItem[]): PublicPlaceStats {
  return {
    settlements: settlements.length,
    items: items.length,
    settlementsWithItems: new Set(items.flatMap(i => (i.settlementId ? [i.settlementId] : []))).size
  }
}

function categoryCounts(content: PublicContent, items: readonly SnapshotItem[]) {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
  return [...counts]
    .map(([id, count]) => ({ category: content.categories.get(id)!, count }))
    .filter(({ category }) => category.filterable)
    .sort((a, b) => b.count - a.count || a.category.sort - b.category.sort || a.category.label.localeCompare(b.category.label, 'hr'))
    .map(({ category, count }) => ({ key: category.key, label: category.label, count }))
}

const inMunicipality = <T extends { municipalityId: string }>(rows: readonly T[], id: string) => rows.filter(r => r.municipalityId === id)

export function atlasOverview(content: PublicContent): AtlasOverviewResponse | null {
  if (!content.region) return null
  return {
    region: content.region,
    totals: { municipalities: content.municipalities.length, ...placeStats(content.settlements, content.items) },
    municipalities: content.municipalities.map(m => ({
      ...municipalityRef(m),
      stats: placeStats(inMunicipality(content.settlements, m.id), inMunicipality(content.items, m.id))
    }))
  }
}

export function municipalityPage(content: PublicContent, m: SnapshotMunicipality): AtlasMunicipalityResponse {
  const settlements = inMunicipality(content.settlements, m.id)
  const items = inMunicipality(content.items, m.id)
  return {
    municipality: municipalityRef(m),
    stats: placeStats(settlements, items),
    settlements: settlements.map(s => ({ ...settlementRef(s), itemCount: items.filter(i => i.settlementId === s.id).length })),
    categories: categoryCounts(content, items)
  }
}

export function settlementPage(content: PublicContent, s: SnapshotSettlement): AtlasSettlementResponse {
  return {
    settlement: { ...settlementRef(s), centroid: s.centroid, credits: s.credits, updatedAt: s.updatedAt },
    municipality: municipalityRef(content.municipalityById.get(s.municipalityId)!),
    items: content.items.filter(i => i.settlementId === s.id).map(i => heritageListItem(content, i))
  }
}

export interface HeritageListFilter {
  /** Municipality or town slug */
  municipality?: string
  /** Category key */
  category?: string
}

/** The heritage list, optionally filtered; null when a filter names no live municipality or category. */
export function heritageList(content: PublicContent, filter: HeritageListFilter = {}): AtlasHeritageListResponse | null {
  let items = content.items
  if (filter.municipality) {
    const id = content.areaBySlug.get(`lau/${filter.municipality}`)
    if (!id) return null
    items = inMunicipality(items, id)
  }
  if (filter.category) {
    const category = [...content.categories.values()].find(c => c.key === filter.category && c.filterable)
    if (!category) return null
    items = items.filter(i => i.categoryId === category.id)
  }
  const withItems = new Set(content.items.map(i => i.municipalityId))
  return {
    items: items.map(i => heritageListItem(content, i)),
    categories: categoryCounts(content, content.items),
    municipalities: content.municipalities.filter(m => withItems.has(m.id)).map(m => ({ slug: m.slug, label: m.label })),
    total: items.length
  }
}

export const CONTENT_TARGET_KINDS = ['heritage_item', 'area', 'source'] as const
export type ContentTargetKind = typeof CONTENT_TARGET_KINDS[number]

export function isContentTargetKind(value: string): value is ContentTargetKind {
  return (CONTENT_TARGET_KINDS as readonly string[]).includes(value)
}

/** What a correction or suggestion points at, by UUID or old id. Gone and unknown targets are told apart. */
export function contentTarget(content: PublicContent, kind: ContentTargetKind, value: string): Resolved<ContentTargetResponse> {
  const id = resolveContentId(content, kind, value)
  if (!id) return { status: 'not_found' }
  if (kind === 'heritage_item') {
    const item = content.itemById.get(id)
    if (item) return { status: 'ok', value: { kind, item: { ...heritageListItem(content, item), ref: item.ref } } }
  } else if (kind === 'area') {
    const m = content.municipalityById.get(id)
    if (m) return { status: 'ok', value: { kind, area: { ...municipalityRef(m), areaKind: m.kind } } }
    const s = content.settlementById.get(id)
    if (s) return { status: 'ok', value: { kind, area: { id: s.id, slug: s.slug, name: s.name, label: s.name, areaKind: 'settlement', path: atlasSettlementPath(s.slug) } } }
  } else {
    const source = content.sources.get(id)
    if (source) return { status: 'ok', value: { kind, source } }
  }
  return content.gone.ids.has(id) ? { status: 'gone' } : { status: 'not_found' }
}

/** The published categories, towns, municipalities and settlements a suggestion form picks from. */
export function suggestOptions(content: PublicContent): SuggestOptionsResponse {
  return {
    categories: [...content.categories.values()].filter(c => c.filterable).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'hr'))
      .map(c => ({ id: c.id, key: c.key, label: c.label })),
    municipalities: content.municipalities.map(m => ({ id: m.id, slug: m.slug, label: m.label })),
    settlements: content.settlements.map(s => ({ id: s.id, slug: s.slug, name: s.name, municipalityId: s.municipalityId }))
  }
}

const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj')

/** Heritage items and settlements whose name contains the query (diacritics ignored), a few of each. */
export function searchContent(content: PublicContent, query: string, limit = 8): ContentSearchResponse {
  const q = fold(query.trim())
  if (q.length < 2) return { items: [], settlements: [] }
  const items = content.items.filter(i => fold(i.name).includes(q)).slice(0, limit).map((i) => {
    const settlement = i.settlementId ? content.settlementById.get(i.settlementId) : undefined
    return { id: i.id, name: i.name, context: settlement?.name ?? content.municipalityById.get(i.municipalityId)?.label ?? '' }
  })
  const settlements = content.settlements.filter(s => fold(s.name).includes(q)).slice(0, limit)
    .map(s => ({ id: s.id, name: s.name, context: content.municipalityById.get(s.municipalityId)?.label ?? '' }))
  return { items, settlements }
}
