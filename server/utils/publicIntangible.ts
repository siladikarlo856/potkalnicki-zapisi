import type { PublicPersonRef, PublicSource } from '#shared/types/publicAtlas'
import type {
  AtlasIntangibleListResponse,
  AtlasNarratorResponse,
  AtlasThemeResponse,
  PublicIntangible,
  PublicIntangibleListItem,
  PublicIntangibleRef,
  PublicNarrator,
  PublicNarratorRef,
  PublicPlaceRef,
  PublicThemeRef
} from '#shared/types/publicIntangible'
import { pzRoutes } from '#shared/utils/appRoutes'
import {
  INTANGIBLE_KINDS, INTANGIBLE_KIND_LABELS, INTANGIBLE_KIND_PLURALS, INTANGIBLE_KIND_SLUGS, type IntangibleKind,
  formatRecordedOn, intangibleKindFromSlug, intangiblePath, narratorPath, periodLabel, themePath
} from '#shared/utils/intangiblePublic'
import { wordArchivePagePath } from '#shared/utils/speech'
import type { Resolved } from './publicAtlas'
import { slugHistoryKey } from './publicContent'
import type { PublicContent } from './publicContent'
import type { SnapshotIntangible, SnapshotNarrator, SnapshotTheme } from './publicIntangibleContent'
import { atlasMunicipalityPath, atlasSettlementPath, heritageItemPath, personRef } from './publicRefs'

// Pure queries over the intangible heritage of the public snapshot: route resolution (live, moved, gone or
// unknown) and the response shapes of the public API. No database access. A narrator is only ever shown as the
// snapshot built it (SnapshotNarrator.label), so nothing here can reach a name that consent does not cover.

const collator = new Intl.Collator('hr')

function cut(text: string | null, max: number) {
  if (!text) return null
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  if (flat.length <= max) return flat
  const head = flat.slice(0, max)
  const space = head.lastIndexOf(' ')
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:.-]+$/, '')}…`
}

/** The start of what the record says: a Custom's description, a Folk text's exact wording, a Story's retelling. */
export function intangibleExcerpt(record: SnapshotIntangible, max = 180) {
  const text = record.kind === 'custom'
    ? record.description
    : record.kind === 'folk_text'
      ? record.textLocal ?? record.textStandard
      : record.textStandard ?? record.textLocal
  return cut(text, max)
}

export function placeRef(content: PublicContent, areaId: string): PublicPlaceRef | null {
  const settlement = content.settlementById.get(areaId)
  if (settlement) return { id: settlement.id, name: settlement.name, path: atlasSettlementPath(settlement.slug) }
  const municipality = content.municipalityById.get(areaId)
  if (municipality) return { id: municipality.id, name: municipality.label, path: atlasMunicipalityPath(municipality.slug) }
  if (content.region && content.region.id === areaId) return { id: content.region.id, name: content.region.name, path: pzRoutes.explore }
  return null
}

function placeRefs(content: PublicContent, record: SnapshotIntangible, relation: 'recorded_in' | 'about') {
  const seen = new Set<string>()
  return record.areaLinks.flatMap((link) => {
    if (link.relation !== relation || seen.has(link.areaId)) return []
    seen.add(link.areaId)
    const place = placeRef(content, link.areaId)
    return place ? [place] : []
  })
}

function narratorRef(narrator: SnapshotNarrator): PublicNarratorRef {
  return { id: narrator.id, slug: narrator.slug, label: narrator.label, named: narrator.named, path: narratorPath(narrator.slug) }
}

function narratorRefs(content: PublicContent, record: SnapshotIntangible, role: 'narrator' | 'collector') {
  const seen = new Set<string>()
  return record.narratorLinks.flatMap((link) => {
    const narrator = content.intangible.narratorById.get(link.narratorId)
    if (link.role !== role || !narrator || seen.has(narrator.id)) return []
    seen.add(narrator.id)
    return [narratorRef(narrator)]
  })
}

function themeRef(theme: SnapshotTheme): PublicThemeRef {
  return { id: theme.id, slug: theme.slug, label: theme.label, path: themePath(theme.slug) }
}

function themeRefs(content: PublicContent, record: SnapshotIntangible) {
  return record.themeIds.flatMap((id) => {
    const theme = content.intangible.themeById.get(id)
    return theme ? [themeRef(theme)] : []
  })
}

export function intangibleRef(content: PublicContent, record: SnapshotIntangible): PublicIntangibleRef {
  return {
    id: record.id,
    kind: record.kind,
    kindLabel: INTANGIBLE_KIND_LABELS[record.kind],
    slug: record.slug,
    title: record.title,
    typeLabel: content.intangible.typeById.get(record.typeId)!.label,
    path: intangiblePath(record.kind, record.slug)
  }
}

function intangibleRefsOf(content: PublicContent, ids: readonly string[] | undefined) {
  return (ids ?? []).flatMap((id) => {
    const record = content.intangible.recordById.get(id)
    return record ? [intangibleRef(content, record)] : []
  })
}

export function intangibleListItem(content: PublicContent, record: SnapshotIntangible): PublicIntangibleListItem {
  return {
    ...intangibleRef(content, record),
    excerpt: intangibleExcerpt(record),
    occasion: record.occasionId ? content.intangible.occasionById.get(record.occasionId)?.label ?? null : null,
    places: placeRefs(content, record, 'recorded_in'),
    themes: themeRefs(content, record),
    narrators: narratorRefs(content, record, 'narrator'),
    verification: record.verification,
    sensitive: record.sensitive ?? false
  }
}

export function intangibleDetail(content: PublicContent, record: SnapshotIntangible): PublicIntangible {
  const sources = record.sourceIds.flatMap((id) => {
    const source = content.sources.get(id)
    return source ? [source as PublicSource] : []
  })
  const customRecord = record.customId ? content.intangible.recordById.get(record.customId) : undefined
  return {
    ...intangibleListItem(content, record),
    textLocal: record.textLocal,
    textStandard: record.textStandard,
    description: record.description,
    quotes: record.quotes,
    steps: record.steps ?? [],
    period: record.kind === 'folk_text' ? null : periodLabel(record.period, record.periodUnit, record.periodValue),
    recordedOn: formatRecordedOn({
      precision: record.recordedPrecision, year: record.recordedYear, month: record.recordedMonth, day: record.recordedDay
    }),
    recordedIn: placeRefs(content, record, 'recorded_in'),
    about: placeRefs(content, record, 'about'),
    collectors: narratorRefs(content, record, 'collector'),
    authors: record.authorIds.flatMap((id) => {
      const person = content.personById.get(id)
      return person ? [personRef(person)] : []
    }) as PublicPersonRef[],
    heritage: record.itemIds.flatMap((id) => {
      const item = content.itemById.get(id)
      return item ? [{ id: item.id, name: item.name, path: heritageItemPath(content, item) }] : []
    }),
    words: record.words.map(word => ({ id: word.id, headword: word.headword, path: word.slug ? wordArchivePagePath(word.slug) : null })),
    custom: customRecord ? intangibleRef(content, customRecord) : null,
    folkTexts: record.kind === 'custom' ? intangibleRefsOf(content, content.intangible.folkTextsByCustom.get(record.id)) : [],
    sources,
    credits: record.credits,
    noindex: record.noindex,
    updatedAt: record.updatedAt
  }
}

function resolveBySlug<T extends { id: string, slug: string }>(
  content: PublicContent,
  config: { historyKind: string, live: Map<string, T>, goneSlug: boolean, byId: Map<string, T>, path: (value: T) => string }, slug: string
): Resolved<T> {
  const live = config.live.get(slug)
  if (live) return { status: 'ok', value: live }
  if (config.goneSlug) return { status: 'gone' }
  const id = content.slugHistory.get(slugHistoryKey(config.historyKind, '', null, slug))
  if (!id) return { status: 'not_found' }
  if (content.intangible.gone.ids.has(id)) return { status: 'gone' }
  const value = config.byId.get(id)
  return value ? { status: 'redirect', path: config.path(value) } : { status: 'not_found' }
}

/** A record page by kind segment and slug: live, an old slug (redirect), archived (gone) or unknown. */
export function resolveIntangible(content: PublicContent, kindSlug: string, slug: string): Resolved<SnapshotIntangible> {
  const kind = intangibleKindFromSlug(kindSlug)
  if (!kind) return { status: 'not_found' }
  const { recordByRoute, recordById, gone } = content.intangible
  const id = recordByRoute.get(`${kind}/${slug}`)
  const live = id ? recordById.get(id) : undefined
  if (live) return { status: 'ok', value: live }
  if (gone.records.has(`${kind}/${slug}`)) return { status: 'gone' }
  const old = content.slugHistory.get(slugHistoryKey(kind, '', null, slug))
  if (!old) return { status: 'not_found' }
  if (gone.ids.has(old)) return { status: 'gone' }
  const record = recordById.get(old)
  return record ? { status: 'redirect', path: intangiblePath(record.kind, record.slug) } : { status: 'not_found' }
}

export function resolveTheme(content: PublicContent, slug: string): Resolved<SnapshotTheme> {
  const { themeBySlug, themeById, gone } = content.intangible
  return resolveBySlug(content, { historyKind: 'theme', live: themeBySlug, goneSlug: gone.themes.has(slug) && !themeBySlug.has(slug), byId: themeById, path: t => themePath(t.slug) }, slug)
}

export function resolveNarrator(content: PublicContent, slug: string): Resolved<SnapshotNarrator> {
  const { narratorBySlug, narratorById, gone } = content.intangible
  return resolveBySlug(content, { historyKind: 'narrator', live: narratorBySlug, goneSlug: gone.narrators.has(slug) && !narratorBySlug.has(slug), byId: narratorById, path: n => narratorPath(n.slug) }, slug)
}

export interface IntangibleListFilter {
  /** Kind segment: prica, obicaj or usmeni-tekst */
  kind?: string
  /** Type key; needs a kind, because keys are only unique within a kind's list */
  type?: string
  /** Theme slug */
  theme?: string
  /** Town or municipality slug (its settlements count), or the region's slug */
  place?: string
}

/** The unit a place belongs to: a municipality or town id, or the region's own id. */
function unitOf(content: PublicContent, areaId: string) {
  const settlement = content.settlementById.get(areaId)
  return settlement ? settlement.municipalityId : areaId
}

function recordUnits(content: PublicContent, record: SnapshotIntangible) {
  return new Set(record.areaLinks.map(link => unitOf(content, link.areaId)))
}

/**
 * The records list with its filters and facets, or null when a filter names something that does not exist (an
 * unknown kind, a type of another kind, a theme or place that is not public). Each facet counts the records the
 * other filters leave, so a choice never leads to an empty list; the selected choice is always listed.
 */
export function intangibleList(content: PublicContent, filter: IntangibleListFilter = {}): AtlasIntangibleListResponse | null {
  const { themeBySlug, typeById } = content.intangible

  let kind: IntangibleKind | null = null
  if (filter.kind) {
    kind = intangibleKindFromSlug(filter.kind)
    if (!kind) return null
  }
  let typeId: string | null = null
  if (filter.type) {
    if (!kind) return null
    const type = [...typeById.values()].find(t => t.kind === kind && t.key === filter.type && t.filterable)
    if (!type) return null
    typeId = type.id
  }
  let themeId: string | null = null
  if (filter.theme) {
    const theme = themeBySlug.get(filter.theme)
    if (!theme) return null
    themeId = theme.id
  }
  let unitId: string | null = null
  if (filter.place) {
    unitId = content.areaBySlug.get(`lau/${filter.place}`) ?? (content.region?.slug === filter.place ? content.region.id : null)
    if (!unitId) return null
  }

  type Dimension = 'kind' | 'type' | 'theme' | 'place'
  const matches = (record: SnapshotIntangible, except?: Dimension) =>
    (except === 'kind' || !kind || record.kind === kind)
    && (except === 'type' || !typeId || record.typeId === typeId)
    && (except === 'theme' || !themeId || record.themeIds.includes(themeId))
    && (except === 'place' || !unitId || recordUnits(content, record).has(unitId))

  const records = content.intangible.records.filter(record => matches(record))

  const kinds = INTANGIBLE_KINDS.map(key => ({
    kind: key, slug: INTANGIBLE_KIND_SLUGS[key], label: INTANGIBLE_KIND_PLURALS[key],
    count: content.intangible.records.filter(r => r.kind === key && matches(r, 'kind')).length
  })).filter(option => option.count > 0 || option.kind === kind)

  const types = kind
    ? [...typeById.values()].filter(t => t.kind === kind && (t.filterable || t.id === typeId))
        .sort((a, b) => a.sort - b.sort || collator.compare(a.label, b.label))
        .map(t => ({ key: t.key, label: t.label, count: content.intangible.records.filter(r => r.typeId === t.id && matches(r, 'type')).length }))
        .filter(option => option.count > 0 || option.key === filter.type)
    : []

  const themeCounts = new Map<string, number>()
  const unitCounts = new Map<string, number>()
  for (const record of content.intangible.records) {
    if (matches(record, 'theme')) for (const id of new Set(record.themeIds)) themeCounts.set(id, (themeCounts.get(id) ?? 0) + 1)
    if (matches(record, 'place')) for (const id of recordUnits(content, record)) unitCounts.set(id, (unitCounts.get(id) ?? 0) + 1)
  }
  const themes = content.intangible.themes
    .map(t => ({ slug: t.slug, label: t.label, count: themeCounts.get(t.id) ?? 0 }))
    .filter(option => option.count > 0 || option.slug === filter.theme)
  const places = [
    ...content.municipalities.map(m => ({ slug: m.slug, label: m.label, count: unitCounts.get(m.id) ?? 0 })),
    ...(content.region ? [{ slug: content.region.slug, label: content.region.name, count: unitCounts.get(content.region.id) ?? 0 }] : [])
  ].filter(option => option.count > 0 || option.slug === filter.place)

  return { records: records.map(r => intangibleListItem(content, r)), total: records.length, kinds, types, themes, places }
}

export function themePage(content: PublicContent, theme: SnapshotTheme): AtlasThemeResponse {
  return {
    theme: { ...themeRef(theme), description: theme.description, updatedAt: theme.updatedAt },
    records: (content.intangible.recordsByTheme.get(theme.id) ?? []).flatMap((id) => {
      const record = content.intangible.recordById.get(id)
      return record ? [intangibleListItem(content, record)] : []
    })
  }
}

export function narratorDetail(content: PublicContent, narrator: SnapshotNarrator): PublicNarrator {
  const person = narrator.personId ? content.personById.get(narrator.personId) : undefined
  return {
    ...narratorRef(narrator),
    description: narrator.description,
    living: narrator.living,
    bornYear: narrator.bornYear,
    settlement: narrator.settlementId ? placeRef(content, narrator.settlementId) : null,
    person: person ? personRef(person) : null,
    noindex: narrator.noindex,
    updatedAt: narrator.updatedAt
  }
}

export function narratorPage(content: PublicContent, narrator: SnapshotNarrator): AtlasNarratorResponse {
  const told: PublicIntangibleListItem[] = []
  const collected: PublicIntangibleListItem[] = []
  for (const id of content.intangible.recordsByNarrator.get(narrator.id) ?? []) {
    const record = content.intangible.recordById.get(id)
    if (!record) continue
    const roles = record.narratorLinks.filter(link => link.narratorId === narrator.id).map(link => link.role)
    if (roles.includes('narrator')) told.push(intangibleListItem(content, record))
    if (roles.includes('collector')) collected.push(intangibleListItem(content, record))
  }
  return { narrator: narratorDetail(content, narrator), told, collected }
}

/** Records tied to exactly this place, for a settlement page. */
export function intangibleForSettlement(content: PublicContent, settlementId: string) {
  return intangibleRefsOf(content, content.intangible.recordsByArea.get(settlementId))
}

/** Records tied to the unit or to any of its settlements, for a town or municipality page. */
export function intangibleForMunicipality(content: PublicContent, municipalityId: string) {
  const areaIds = [municipalityId, ...content.settlements.filter(s => s.municipalityId === municipalityId).map(s => s.id)]
  const ids = new Set(areaIds.flatMap(id => content.intangible.recordsByArea.get(id) ?? []))
  return intangibleRefsOf(content, content.intangible.records.filter(r => ids.has(r.id)).map(r => r.id))
}

/** Records a person wrote, or told through a named narrator who is that person. */
export function intangibleForPerson(content: PublicContent, personId: string) {
  return intangibleRefsOf(content, content.intangible.recordsByPerson.get(personId))
}
