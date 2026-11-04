import type { SupabaseClient } from '@supabase/supabase-js'
import type { AtlasItemStatus } from '../../shared/types/atlas'
import type { PublicCredit, PublicMunicipalityKind } from '../../shared/types/publicAtlas'
import { isCorrectionTargetRefFormat } from '../../shared/utils/correctionReport'
import { PERSON_AREA_ROLES, type PersonAreaRole } from '../../shared/utils/content/person'

// The public read layer over the content tables: one in-process snapshot of everything the public atlas
// shows, built from the database and served stale-while-revalidate. Admin writes call
// invalidatePublicContent() so the next request sees them. Queries over the snapshot live in
// publicAtlas.ts; this file only loads, shapes and caches it.
//
// Visibility rules (draft rows are never loaded, so they are simply absent):
// - scope is the region ATLAS_REGION_SLUG: its member towns and municipalities, their settlements and the
//   heritage items of those towns and municipalities;
// - a row is live when it and every place above it are published, and gone (410) when it or a place above
//   it is archived. Archiving a settlement or municipality therefore takes its pages and items offline too.

/** The region whose members make up the public atlas (Potkalničko prigorje). */
export const ATLAS_REGION_SLUG = 'potkalnicko-prigorje'

/** Snapshot age after which a request triggers a background refresh. */
export const PUBLIC_CONTENT_TTL_MS = 60_000

const PAGE = 1000
const VISIBLE = ['published', 'archived']
const LEGACY_KINDS = ['area', 'heritage_item', 'heritage_category', 'source', 'person']

type Status = 'published' | 'archived'

export interface AreaRow {
  id: string
  kind: string
  parent_id: string | null
  name: string
  slug: string | null
  official_code: string | null
  latitude: number | null
  longitude: number | null
  credits?: unknown
  status: Status
  updated_at: string
}
export interface AreaRegionRow { area_id: string, region_id: string }
export interface CategoryRow { id: string, key: string, label_hr: string, sort: number, status: Status }
export interface SourceRow { id: string, title: string, type: string, url: string | null, status: Status }
export interface ItemRow {
  id: string
  name: string
  slug: string
  category_id: string
  municipality_id: string
  settlement_id: string | null
  locality: string | null
  verification: AtlasItemStatus
  heritage_status: string | null
  registry_number: string | null
  period: string | null
  description: string | null
  research_notes: string
  latitude: number | null
  longitude: number | null
  noindex: boolean
  credits: unknown
  status: Status
  updated_at: string
}
export interface ItemSourceRow { item_id: string, source_id: string, position: number }
/** A person row as the public snapshot reads it: never `research_notes`, `clue` or `search_text`. */
export interface PersonRow {
  id: string
  name: string
  slug: string
  role: string
  bio: string | null
  born: string | null
  born_year: number | null
  born_place: string | null
  died: string
  died_year: number
  died_place: string | null
  open_questions: string | null
  verification: AtlasItemStatus
  noindex: boolean
  status: Status
  updated_at: string
}
export interface ClubRow {
  id: string
  name: string
  slug: string
  full_name: string | null
  sport: string
  settlement_id: string
  founded_year: number | null
  home_ground: string | null
  verification: AtlasItemStatus
  noindex: boolean
  status: Status
  updated_at: string
}
export interface PersonAreaRow { person_id: string, area_id: string, role: string, position: number }
export interface PersonItemRow { person_id: string, item_id: string, relation: string, position: number }
export interface PersonSourceRow { person_id: string, source_id: string, position: number }
export interface ClubSeasonRow { club_id: string, season: string, competition: string, team: string, checked_at: string }
export interface ClubSourceRow { club_id: string, source_id: string, position: number }
export interface LegacyIdRow { kind: string, legacy_id: string, entity_id: string }
export interface SlugHistoryRow { kind: string, namespace: string, scope_id: string | null, slug: string, entity_id: string }

/** Everything the snapshot is built from, as read from the database. */
export interface PublicContentRows {
  areas: AreaRow[]
  areaRegions: AreaRegionRow[]
  categories: CategoryRow[]
  sources: SourceRow[]
  items: ItemRow[]
  itemSources: ItemSourceRow[]
  clubs: ClubRow[]
  clubSeasons: ClubSeasonRow[]
  clubSources: ClubSourceRow[]
  legacyIds: LegacyIdRow[]
  slugHistory: SlugHistoryRow[]
  /** Person tables; absent in rows built before persons existed (treated as none). */
  persons?: PersonRow[]
  personAreas?: PersonAreaRow[]
  personItems?: PersonItemRow[]
  personSources?: PersonSourceRow[]
}

export interface SnapshotMunicipality {
  id: string
  slug: string
  name: string
  label: string
  kind: PublicMunicipalityKind
  updatedAt: string
}

export interface SnapshotSettlement {
  id: string
  slug: string
  name: string
  code: string | null
  municipalityId: string
  centroid: { lat: number, lng: number } | null
  credits: PublicCredit[]
  updatedAt: string
}

export interface SnapshotCategory {
  id: string
  key: string
  label: string
  sort: number
  /** Archived categories still label their items but are left out of filters. */
  filterable: boolean
}

export interface SnapshotSource {
  id: string
  title: string
  type: string
  url: string | null
}

export interface SnapshotItem {
  id: string
  ref: string
  slug: string
  name: string
  categoryId: string
  municipalityId: string
  settlementId: string | null
  locality: string | null
  verification: AtlasItemStatus
  heritageStatus: string | null
  registryNumber: string | null
  period: string | null
  description: string | null
  researchNotes: string
  coordinates: { lat: number, lng: number } | null
  noindex: boolean
  credits: PublicCredit[]
  sourceIds: string[]
  updatedAt: string
}

/** A historical person. Only live links are kept: areas and items that are published and in scope. */
export interface SnapshotPerson {
  id: string
  slug: string
  name: string
  role: string
  bio: string | null
  born: string | null
  bornYear: number | null
  bornPlace: string | null
  died: string
  diedYear: number
  diedPlace: string | null
  openQuestions: string | null
  verification: AtlasItemStatus
  noindex: boolean
  areaLinks: Array<{ areaId: string, role: PersonAreaRole }>
  itemLinks: Array<{ itemId: string, relation: string }>
  sourceIds: string[]
  updatedAt: string
}

export interface SnapshotClub {
  id: string
  slug: string
  name: string
  sport: string
  settlementId: string
  municipalityId: string
  verification: AtlasItemStatus
  noindex: boolean
  seasons: { season: string, competition: string, team: string, checkedAt: string }[]
  sourceIds: string[]
  updatedAt: string
}

/** Where an archived (gone) row used to be reachable, so its old URL answers 410. */
export interface GoneRoutes {
  /** `${namespace}/${slug}` of archived towns, municipalities and settlements */
  areas: Set<string>
  /** `${settlementId}/${slug}` of archived items */
  items: Set<string>
  /** slugs of archived persons */
  persons: Set<string>
  /** ids of every gone area, item, source and person */
  ids: Set<string>
}

export interface PublicContent {
  region: { id: string, slug: string, name: string } | null
  /** Live rows, in display order (towns first, then by name; settlements and items by name). */
  municipalities: SnapshotMunicipality[]
  settlements: SnapshotSettlement[]
  items: SnapshotItem[]
  /** Live persons, by name */
  persons: SnapshotPerson[]
  clubs: SnapshotClub[]
  categories: Map<string, SnapshotCategory>
  sources: Map<string, SnapshotSource>
  municipalityById: Map<string, SnapshotMunicipality>
  settlementById: Map<string, SnapshotSettlement>
  itemById: Map<string, SnapshotItem>
  personById: Map<string, SnapshotPerson>
  personBySlug: Map<string, SnapshotPerson>
  /** area id → ids of live persons linked to that area, in display order */
  personsByArea: Map<string, string[]>
  /** item id → ids of live persons linked to that item, in display order */
  personsByItem: Map<string, string[]>
  clubById: Map<string, SnapshotClub>
  /** `${namespace}/${slug}` → area id, namespace 'lau' (towns and municipalities) or 'settlement' */
  areaBySlug: Map<string, string>
  /** `${settlementId}/${slug}` → item id */
  itemByRoute: Map<string, string>
  gone: GoneRoutes
  /** `${kind}:${legacyId}` → entity id */
  legacyIds: Map<string, string>
  /** `${kind}|${namespace}|${scopeId ?? ''}|${slug}` → entity id */
  slugHistory: Map<string, string>
  loadedAt: number
}

const collator = new Intl.Collator('hr')
const byName = <T extends { name: string, id: string }>(a: T, b: T) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1)

export function municipalityLabel(kind: PublicMunicipalityKind, name: string) {
  return `${kind === 'town' ? 'Grad' : 'Općina'} ${name}`
}

export function areaNamespace(kind: string) {
  return kind === 'town' || kind === 'municipality' ? 'lau' : kind
}

export const slugHistoryKey = (kind: string, namespace: string, scopeId: string | null, slug: string) =>
  `${kind}|${namespace}|${scopeId ?? ''}|${slug}`

function coordinates(lat: number | null, lng: number | null) {
  return lat == null || lng == null ? null : { lat, lng }
}

function publicCredits(value: unknown): PublicCredit[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((credit) => {
    if (!credit || typeof credit !== 'object') return []
    const { name, kind } = credit as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim()) return []
    return [typeof kind === 'string' ? { name, kind } : { name }]
  })
}

const AREA_ROLES = new Set<string>(PERSON_AREA_ROLES)

/**
 * Persons of the snapshot. Drafts are never loaded; an archived person is gone (410). A published person
 * is live when at least one linked area is live (D13 needs a source too, which the admin enforces on
 * publish, so it is not re-checked here). Links to areas or items that are not live are dropped.
 */
function buildPersons(
  rows: PublicContentRows,
  context: { areaState: Map<string, boolean>, itemById: Map<string, SnapshotItem>, sources: Map<string, SnapshotSource>, gone: GoneRoutes }
) {
  const { areaState, itemById, sources, gone } = context
  const byPerson = <T extends { person_id: string, position: number }>(links: T[] | undefined) => {
    const map = new Map<string, T[]>()
    for (const link of [...(links ?? [])].sort((a, b) => a.position - b.position)) {
      map.set(link.person_id, [...(map.get(link.person_id) ?? []), link])
    }
    return map
  }
  const areaLinks = byPerson(rows.personAreas)
  const itemLinks = byPerson(rows.personItems)
  const sourceLinks = byPerson(rows.personSources)

  const persons: SnapshotPerson[] = []
  for (const p of rows.persons ?? []) {
    if (p.status !== 'published') {
      gone.ids.add(p.id)
      gone.persons.add(p.slug)
      continue
    }
    const areas = (areaLinks.get(p.id) ?? [])
      .filter(link => areaState.get(link.area_id) === true && AREA_ROLES.has(link.role))
      .map(link => ({ areaId: link.area_id, role: link.role as PersonAreaRole }))
    if (!areas.length) continue
    persons.push({
      id: p.id, slug: p.slug, name: p.name, role: p.role, bio: p.bio, born: p.born, bornYear: p.born_year, bornPlace: p.born_place,
      died: p.died, diedYear: p.died_year, diedPlace: p.died_place, openQuestions: p.open_questions, verification: p.verification,
      noindex: p.noindex, areaLinks: areas,
      itemLinks: (itemLinks.get(p.id) ?? []).filter(link => itemById.has(link.item_id)).map(link => ({ itemId: link.item_id, relation: link.relation })),
      sourceIds: (sourceLinks.get(p.id) ?? []).filter(link => sources.has(link.source_id)).map(link => link.source_id),
      updatedAt: p.updated_at
    })
  }
  persons.sort(byName)

  const personsByArea = new Map<string, string[]>()
  const personsByItem = new Map<string, string[]>()
  for (const person of persons) {
    for (const areaId of new Set(person.areaLinks.map(link => link.areaId))) {
      personsByArea.set(areaId, [...(personsByArea.get(areaId) ?? []), person.id])
    }
    for (const { itemId } of person.itemLinks) {
      personsByItem.set(itemId, [...(personsByItem.get(itemId) ?? []), person.id])
    }
  }
  return { persons, personsByArea, personsByItem }
}

export interface BuildOptions {
  /** The region whose members are in scope; tests use their own. */
  regionSlug?: string
  loadedAt?: number
}

/** Shapes database rows into the public snapshot. Pure, so the rules are testable without a database. */
export function buildPublicContent(rows: PublicContentRows, options: BuildOptions = {}): PublicContent {
  const { regionSlug = ATLAS_REGION_SLUG, loadedAt = Date.now() } = options
  const regionRow = rows.areas.find(a => a.kind === 'region' && a.slug === regionSlug && a.status === 'published')
  const members = new Set(regionRow ? rows.areaRegions.filter(r => r.region_id === regionRow.id).map(r => r.area_id) : [])

  const gone: GoneRoutes = { areas: new Set(), items: new Set(), persons: new Set(), ids: new Set() }
  const municipalities: SnapshotMunicipality[] = []
  const settlements: SnapshotSettlement[] = []
  const areaBySlug = new Map<string, string>()
  // Area id → live (true) or gone (false); areas outside the scope or drafts are absent.
  const areaState = new Map<string, boolean>()

  for (const a of rows.areas) {
    if ((a.kind !== 'town' && a.kind !== 'municipality') || !members.has(a.id) || !a.slug) continue
    const live = a.status === 'published'
    areaState.set(a.id, live)
    if (!live) {
      gone.areas.add(`lau/${a.slug}`)
      gone.ids.add(a.id)
      continue
    }
    const kind = a.kind as PublicMunicipalityKind
    municipalities.push({ id: a.id, slug: a.slug, name: a.name, label: municipalityLabel(kind, a.name), kind, updatedAt: a.updated_at })
    areaBySlug.set(`lau/${a.slug}`, a.id)
  }
  for (const a of rows.areas) {
    if (a.kind !== 'settlement' || !a.parent_id || !a.slug) continue
    const parent = areaState.get(a.parent_id)
    if (parent === undefined) continue
    const live = parent && a.status === 'published'
    areaState.set(a.id, live)
    if (!live) {
      gone.areas.add(`settlement/${a.slug}`)
      gone.ids.add(a.id)
      continue
    }
    settlements.push({
      id: a.id, slug: a.slug, name: a.name, code: a.official_code, municipalityId: a.parent_id,
      centroid: coordinates(a.latitude, a.longitude), credits: publicCredits(a.credits), updatedAt: a.updated_at
    })
    areaBySlug.set(`settlement/${a.slug}`, a.id)
  }

  const legacyIds = new Map<string, string>()
  const refs = new Map<string, string>()
  for (const row of [...rows.legacyIds].sort((a, b) => (a.legacy_id < b.legacy_id ? -1 : 1))) {
    legacyIds.set(`${row.kind}:${row.legacy_id}`, row.entity_id)
    // The old item id doubles as the correction target; the dataset id with diacritics does not fit it.
    if (row.kind === 'heritage_item' && !refs.has(row.entity_id) && isCorrectionTargetRefFormat(row.legacy_id)) {
      refs.set(row.entity_id, row.legacy_id)
    }
  }

  const categories = new Map(rows.categories.map(c => [c.id, {
    id: c.id, key: c.key, label: c.label_hr, sort: c.sort, filterable: c.status === 'published'
  }]))
  // Archived sources drop out of item pages; their id stays known so a correction target answers 410.
  const sources = new Map<string, SnapshotSource>()
  for (const s of rows.sources) {
    if (s.status === 'published') sources.set(s.id, { id: s.id, title: s.title, type: s.type, url: s.url })
    else gone.ids.add(s.id)
  }
  const itemSources = new Map<string, ItemSourceRow[]>()
  for (const link of rows.itemSources) {
    if (!sources.has(link.source_id)) continue
    itemSources.set(link.item_id, [...(itemSources.get(link.item_id) ?? []), link])
  }

  const items: SnapshotItem[] = []
  const itemByRoute = new Map<string, string>()
  for (const i of rows.items) {
    const municipality = areaState.get(i.municipality_id)
    const settlement = i.settlement_id === null ? true : areaState.get(i.settlement_id)
    if (municipality === undefined || settlement === undefined || !categories.has(i.category_id)) continue
    if (!(municipality && settlement && i.status === 'published')) {
      gone.ids.add(i.id)
      if (i.settlement_id) gone.items.add(`${i.settlement_id}/${i.slug}`)
      continue
    }
    items.push({
      id: i.id, ref: refs.get(i.id) ?? i.id, slug: i.slug, name: i.name, categoryId: i.category_id,
      municipalityId: i.municipality_id, settlementId: i.settlement_id, locality: i.locality, verification: i.verification,
      heritageStatus: i.heritage_status, registryNumber: i.registry_number, period: i.period, description: i.description,
      researchNotes: i.research_notes, coordinates: coordinates(i.latitude, i.longitude), noindex: i.noindex,
      credits: publicCredits(i.credits),
      sourceIds: (itemSources.get(i.id) ?? []).sort((a, b) => a.position - b.position).map(link => link.source_id),
      updatedAt: i.updated_at
    })
    if (i.settlement_id) itemByRoute.set(`${i.settlement_id}/${i.slug}`, i.id)
  }

  municipalities.sort((a, b) => (a.kind === b.kind ? byName(a, b) : a.kind === 'town' ? -1 : 1))
  settlements.sort(byName)
  items.sort(byName)

  const { persons, personsByArea, personsByItem } = buildPersons(rows, { areaState, itemById: new Map(items.map(i => [i.id, i])), sources, gone })
  const clubSources = new Map<string, ClubSourceRow[]>()
  for (const link of rows.clubSources ?? []) {
    if (!sources.has(link.source_id)) continue
    clubSources.set(link.club_id, [...(clubSources.get(link.club_id) ?? []), link])
  }
  const clubSeasons = new Map<string, ClubSeasonRow[]>()
  for (const season of rows.clubSeasons ?? []) {
    clubSeasons.set(season.club_id, [...(clubSeasons.get(season.club_id) ?? []), season])
  }
  const clubs: SnapshotClub[] = []
  for (const c of rows.clubs ?? []) {
    const settlementLive = areaState.get(c.settlement_id)
    if (settlementLive === undefined || !settlementLive || c.status !== 'published' || c.noindex) {
      if (c.status === 'archived') gone.ids.add(c.id)
      continue
    }
    const settlement = settlements.find(s => s.id === c.settlement_id)
    if (!settlement) continue
    clubs.push({
      id: c.id,
      slug: c.slug,
      name: c.name,
      sport: c.sport,
      settlementId: c.settlement_id,
      municipalityId: settlement.municipalityId,
      verification: c.verification,
      noindex: c.noindex,
      seasons: (clubSeasons.get(c.id) ?? []).map(s => ({
        season: s.season,
        competition: s.competition,
        team: s.team,
        checkedAt: s.checked_at
      })),
      sourceIds: (clubSources.get(c.id) ?? []).sort((a, b) => a.position - b.position).map(l => l.source_id),
      updatedAt: c.updated_at
    })
  }
  clubs.sort(byName)

  const slugHistory = new Map(rows.slugHistory.map(h => [slugHistoryKey(h.kind, h.namespace, h.scope_id, h.slug), h.entity_id]))
  const region = regionRow ? { id: regionRow.id, slug: regionSlug, name: regionRow.name } : null

  return {
    region, municipalities, settlements, items, persons, clubs, categories, sources,
    personById: new Map(persons.map(p => [p.id, p])),
    personBySlug: new Map(persons.map(p => [p.slug, p])),
    personsByArea, personsByItem,
    municipalityById: new Map(municipalities.map(m => [m.id, m])),
    settlementById: new Map(settlements.map(s => [s.id, s])),
    itemById: new Map(items.map(i => [i.id, i])),
    clubById: new Map(clubs.map(c => [c.id, c])),
    areaBySlug, itemByRoute, gone, legacyIds, slugHistory, loadedAt
  }
}

type Page<T> = PromiseLike<{ data: T[] | null, error: { message: string } | null }>

async function readAll<T>(read: (from: number, to: number) => Page<T>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data!)
    if (data!.length < PAGE) return rows
  }
}

/** Reads every row the snapshot needs (published and archived only; drafts never leave the database). */
export async function loadPublicContentRows(client: SupabaseClient): Promise<PublicContentRows> {
  const [areas, areaRegions, categories, sources, items, itemSources, clubs, clubSeasons, clubSources, legacyIds, slugHistory, persons, personAreas, personItems, personSources] = await Promise.all([
    readAll<AreaRow>((from, to) => client.from('areas')
      .select('id,kind,parent_id,name,slug,official_code,latitude,longitude,credits,status,updated_at')
      .in('kind', ['region', 'town', 'municipality', 'settlement']).in('status', VISIBLE).order('id').range(from, to)),
    readAll<AreaRegionRow>((from, to) => client.from('area_regions').select('area_id,region_id').order('area_id').order('region_id').range(from, to)),
    readAll<CategoryRow>((from, to) => client.from('heritage_categories').select('id,key,label_hr,sort,status').in('status', VISIBLE).order('id').range(from, to)),
    readAll<SourceRow>((from, to) => client.from('sources').select('id,title,type,url,status').in('status', VISIBLE).order('id').range(from, to)),
    readAll<ItemRow>((from, to) => client.from('heritage_items')
      .select('id,name,slug,category_id,municipality_id,settlement_id,locality,verification,heritage_status,registry_number,period,description,research_notes,latitude,longitude,noindex,credits,status,updated_at')
      .in('status', VISIBLE).order('id').range(from, to)),
    readAll<ItemSourceRow>((from, to) => client.from('heritage_item_sources').select('item_id,source_id,position').order('item_id').order('position').range(from, to)),
    readAll<ClubRow>((from, to) => client.from('clubs')
      .select('id,name,slug,full_name,sport,settlement_id,founded_year,home_ground,verification,noindex,status,updated_at')
      .in('status', VISIBLE).order('id').range(from, to)),
    readAll<ClubSeasonRow>((from, to) => client.from('club_seasons').select('club_id,season,competition,team,checked_at').order('club_id').order('season').range(from, to)),
    readAll<ClubSourceRow>((from, to) => client.from('club_sources').select('club_id,source_id,position').order('club_id').order('position').range(from, to)),
    readAll<LegacyIdRow>((from, to) => client.from('content_legacy_ids').select('kind,legacy_id,entity_id').in('kind', LEGACY_KINDS).order('kind').order('legacy_id').range(from, to)),
    readAll<SlugHistoryRow>((from, to) => client.from('content_slug_history').select('kind,namespace,scope_id,slug,entity_id')
      .in('kind', ['area', 'heritage_item', 'person']).order('created_at').order('slug').range(from, to)),
    // research_notes, clue and search_text are private or not public yet: never selected.
    readAll<PersonRow>((from, to) => client.from('persons')
      .select('id,name,slug,role,bio,born,born_year,born_place,died,died_year,died_place,open_questions,verification,noindex,status,updated_at')
      .in('status', VISIBLE).order('id').range(from, to)),
    readAll<PersonAreaRow>((from, to) => client.from('person_areas').select('person_id,area_id,role,position').order('person_id').order('position').range(from, to)),
    readAll<PersonItemRow>((from, to) => client.from('person_heritage_items').select('person_id,item_id,relation,position').order('person_id').order('position').range(from, to)),
    readAll<PersonSourceRow>((from, to) => client.from('person_sources').select('person_id,source_id,position').order('person_id').order('position').range(from, to))
  ])
  return { areas, areaRegions, categories, sources, items, itemSources, clubs, clubSeasons, clubSources, legacyIds, slugHistory, persons, personAreas, personItems, personSources }
}

export async function loadPublicContent(client: SupabaseClient, options: Omit<BuildOptions, 'loadedAt'> = {}) {
  return buildPublicContent(await loadPublicContentRows(client), options)
}

/** Thrown when there is no snapshot at all (cold start) and the database cannot be read. */
export class PublicContentUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Public content is unavailable', { cause })
    this.name = 'PublicContentUnavailableError'
  }
}

export interface SnapshotStoreOptions<T> {
  load: () => Promise<T>
  ttlMs?: number
  now?: () => number
  onError?: (error: unknown) => void
}

/**
 * A single cached value with stale-while-revalidate refresh:
 * - fresh (younger than ttl): served as is;
 * - stale: served as is while one background load runs (single-flight);
 * - invalidated or cold: the request waits for a new load, so a write is visible on the next request;
 * - a failed load keeps the last good value, served as stale so the next request retries in the
 *   background; with no value at all it throws PublicContentUnavailableError (and the next request retries).
 */
export function createSnapshotStore<T>(options: SnapshotStoreOptions<T>) {
  const ttl = options.ttlMs ?? PUBLIC_CONTENT_TTL_MS
  const now = options.now ?? Date.now
  const report = options.onError ?? (error => console.error('[content] Refreshing the public content snapshot failed:', error))
  let value: T | undefined
  let loadedAt = 0
  let generation = 0
  let valueGeneration = -1
  let inflight: { generation: number, promise: Promise<T> } | null = null

  function refresh() {
    if (inflight?.generation === generation) return inflight.promise
    const started = generation
    const promise = options.load().then((fresh) => {
      if (started >= valueGeneration) {
        value = fresh
        loadedAt = now()
        valueGeneration = started
      }
      return value!
    }, (error: unknown) => {
      // Keep serving the last good value as stale, so later requests retry in the background
      // instead of each waiting on an unreachable database.
      if (value !== undefined && started >= valueGeneration) {
        valueGeneration = started
        loadedAt = Number.NEGATIVE_INFINITY
      }
      throw error
    }).finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
    inflight = { generation: started, promise }
    return promise
  }

  return {
    async get(): Promise<T> {
      if (value !== undefined && valueGeneration === generation) {
        if (now() - loadedAt >= ttl) refresh().catch(report)
        return value
      }
      try {
        return await refresh()
      } catch (error) {
        report(error)
        if (value === undefined) throw new PublicContentUnavailableError(error)
        return value
      }
    },
    invalidate() {
      generation++
    }
  }
}

const store = createSnapshotStore({ load: () => loadPublicContent(useDatabaseClient()) })

/** The current public content snapshot; answers 503 when the database is unreachable on a cold start. */
export async function getPublicContent(): Promise<PublicContent> {
  try {
    return await store.get()
  } catch (error) {
    if (error instanceof PublicContentUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: 'Content is temporarily unavailable' })
    }
    throw error
  }
}

/** Call after every content write in this process, so the next public request reads the database again. */
export function invalidatePublicContent() {
  store.invalidate()
  void import('./cardPool').then(m => m.invalidateCardPool())
}
