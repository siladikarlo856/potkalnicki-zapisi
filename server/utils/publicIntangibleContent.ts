import type { SupabaseClient } from '@supabase/supabase-js'
import type { AtlasItemStatus } from '#shared/types/atlas'
import type { PublicCredit } from '#shared/types/publicAtlas'
import { INTANGIBLE_KINDS, type IntangibleKind } from '#shared/utils/intangiblePublic'
import { containsNamePart } from '#shared/utils/content/narrator'
import type { SnapshotItem, SnapshotPerson, SnapshotSource, SnapshotSettlement, SnapshotMunicipality } from './publicContent'

// Intangible heritage in the public content snapshot (Story, Custom, Folk text, Narrator, Theme and the type and
// occasion lists). Built from published and archived rows only, so a draft never reaches this file. What the public
// may see is decided here, once, and the rest of the public layer reads only the projection:
// - a Narrator's real name only when an editor recorded consent to publish it, otherwise the public description;
//   the Narrator's consent note and research notes, and the research notes of every record, are never selected;
// - the structured details of an anonymous Narrator (birth year, home settlement, living, link to a Person) are
//   withheld, because together with a description they would name the person the description hides;
// - a Narrator whose slug or description repeats the real name without consent is not public at all.

const PAGE = 1000
const VISIBLE = ['published', 'archived']
const WORD_CHUNK = 200

type Status = 'published' | 'archived'
type Row = Record<string, unknown>

export interface KeyedRow { id: string, key: string, label_hr: string, sort: number, status: Status }
export interface ThemeRow {
  id: string
  slug: string
  label_hr: string
  description: string | null
  sort: number
  status: Status
  updated_at: string
}
/** A narrator as the snapshot reads it. `name` is read so the projection can use it with consent; never the consent note. */
export interface NarratorRow {
  id: string
  name: string
  slug: string
  public_description: string | null
  consent_named: boolean
  living: boolean
  born_year: number | null
  settlement_id: string | null
  person_id: string | null
  noindex: boolean
  status: Status
  updated_at: string
}
/** A Story, Custom or Folk text row; the columns a kind does not have are absent. Never `research_notes` or `search_text`. */
export interface IntangibleRow {
  id: string
  title: string
  slug: string
  type_id: string
  occasion_id?: string | null
  custom_id?: string | null
  text_local?: string | null
  text_standard?: string | null
  description?: string | null
  quotes?: unknown
  period?: string | null
  period_unit?: string | null
  period_value?: number | null
  recorded_precision: string | null
  recorded_year: number | null
  recorded_month: number | null
  recorded_day: number | null
  verification: AtlasItemStatus
  noindex: boolean
  credits: unknown
  status: Status
  updated_at: string
}
/** A link table row, aliased to one shape in the query (`record_id:story_id`). */
export interface LinkRow { record_id: string, position: number }
export interface AreaLinkRow extends LinkRow { area_id: string, relation: string }
export interface NarratorLinkRow extends LinkRow { narrator_id: string, role: string }
export interface AuthorLinkRow extends LinkRow { person_id: string }
export interface ItemLinkRow extends LinkRow { item_id: string }
export interface ThemeLinkRow extends LinkRow { theme_id: string }
export interface SourceLinkRow extends LinkRow { source_id: string }
export interface WordLinkRow extends LinkRow { word_id: string }
export interface WordRow { id: string, slug: string | null, headword: string | null }

export interface IntangibleLinkRows {
  areas: AreaLinkRow[]
  narrators: NarratorLinkRow[]
  authors: AuthorLinkRow[]
  items: ItemLinkRow[]
  themes: ThemeLinkRow[]
  sources: SourceLinkRow[]
}

/** Everything intangible heritage in the snapshot is built from, as read from the database. */
export interface IntangibleRows {
  records: Record<IntangibleKind, IntangibleRow[]>
  links: Record<IntangibleKind, IntangibleLinkRows>
  types: Record<IntangibleKind, KeyedRow[]>
  occasions: KeyedRow[]
  themes: ThemeRow[]
  narrators: NarratorRow[]
  /** `folk_text_words`, and the live words they point at (a word that is not live is absent). */
  folkTextWords: WordLinkRow[]
  words: WordRow[]
}

export interface SnapshotNarrator {
  id: string
  slug: string
  /** The name with consent, otherwise the public description (never the real name). */
  label: string
  /** The name is public: an editor recorded consent. */
  named: boolean
  description: string | null
  /** The details below are present only for a named narrator. */
  living: boolean | null
  bornYear: number | null
  settlementId: string | null
  personId: string | null
  noindex: boolean
  updatedAt: string
}

export interface SnapshotTheme {
  id: string
  slug: string
  label: string
  description: string | null
  sort: number
  updatedAt: string
}

export interface SnapshotTypeLabel {
  id: string
  kind: IntangibleKind
  key: string
  label: string
  sort: number
  /** Archived types still label their records but are left out of filters. */
  filterable: boolean
}

export interface SnapshotWord { id: string, headword: string, slug: string | null }

export interface SnapshotIntangible {
  id: string
  kind: IntangibleKind
  slug: string
  title: string
  typeId: string
  occasionId: string | null
  /** A Folk text's Custom, when that Custom is public. */
  customId: string | null
  textLocal: string | null
  textStandard: string | null
  description: string | null
  quotes: string[]
  period: string | null
  periodUnit: 'decade' | 'century' | null
  periodValue: number | null
  recordedPrecision: 'year' | 'month' | 'day' | null
  recordedYear: number | null
  recordedMonth: number | null
  recordedDay: number | null
  verification: AtlasItemStatus
  noindex: boolean
  credits: PublicCredit[]
  /** Only places that are public: the region, towns, municipalities and settlements of the atlas. */
  areaLinks: Array<{ areaId: string, relation: 'recorded_in' | 'about' }>
  narratorLinks: Array<{ narratorId: string, role: 'narrator' | 'collector' }>
  authorIds: string[]
  itemIds: string[]
  themeIds: string[]
  sourceIds: string[]
  words: SnapshotWord[]
  updatedAt: string
}

export interface IntangibleGone {
  /** `${kind}/${slug}` of archived records */
  records: Set<string>
  themes: Set<string>
  narrators: Set<string>
  /** ids of every gone record, theme and narrator */
  ids: Set<string>
}

export interface SnapshotIntangibleContent {
  /** Live records of every kind, by title. */
  records: SnapshotIntangible[]
  themes: SnapshotTheme[]
  narrators: SnapshotNarrator[]
  recordById: Map<string, SnapshotIntangible>
  /** `${kind}/${slug}` → record id */
  recordByRoute: Map<string, string>
  themeById: Map<string, SnapshotTheme>
  themeBySlug: Map<string, SnapshotTheme>
  narratorById: Map<string, SnapshotNarrator>
  narratorBySlug: Map<string, SnapshotNarrator>
  typeById: Map<string, SnapshotTypeLabel>
  occasionById: Map<string, { id: string, label: string }>
  /** theme id → record ids */
  recordsByTheme: Map<string, string[]>
  /** narrator id → record ids (told or collected) */
  recordsByNarrator: Map<string, string[]>
  /** area id → record ids linked to that exact area, by any relation */
  recordsByArea: Map<string, string[]>
  /** person id → record ids the person wrote, or told through a named narrator who is that person */
  recordsByPerson: Map<string, string[]>
  /** custom id → folk text ids said or sung at it */
  folkTextsByCustom: Map<string, string[]>
  gone: IntangibleGone
}

const collator = new Intl.Collator('hr')
const byTitle = (a: { title: string, id: string }, b: { title: string, id: string }) =>
  collator.compare(a.title, b.title) || (a.id < b.id ? -1 : 1)

export const NO_INTANGIBLE_ROWS: IntangibleRows = {
  records: { story: [], custom: [], folk_text: [] },
  links: {
    story: { areas: [], narrators: [], authors: [], items: [], themes: [], sources: [] },
    custom: { areas: [], narrators: [], authors: [], items: [], themes: [], sources: [] },
    folk_text: { areas: [], narrators: [], authors: [], items: [], themes: [], sources: [] }
  },
  types: { story: [], custom: [], folk_text: [] },
  occasions: [],
  themes: [],
  narrators: [],
  folkTextWords: [],
  words: []
}

function credits(value: unknown): PublicCredit[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((credit) => {
    if (!credit || typeof credit !== 'object') return []
    const { name, kind } = credit as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim()) return []
    return [typeof kind === 'string' ? { name, kind } : { name }]
  })
}

/** What the public may call a narrator whose name is withheld and who somehow has no description either. */
const ANONYMOUS_LABEL = 'Kazivač/ica'

/** Whether the narrator's public pieces (slug, description) repeat the real name that consent does not cover. */
function exposesName(row: NarratorRow) {
  if (row.consent_named) return false
  return containsNamePart(row.slug.replaceAll('-', ' '), row.name)
    || (row.public_description !== null && containsNamePart(row.public_description, row.name))
}

function byRecord<T extends LinkRow>(links: T[]) {
  const map = new Map<string, T[]>()
  for (const link of [...links].sort((a, b) => a.position - b.position)) {
    const list = map.get(link.record_id)
    if (list) list.push(link)
    else map.set(link.record_id, [link])
  }
  return map
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key)
  if (!list) map.set(key, [value])
  else if (!list.includes(value)) list.push(value)
}

export interface IntangibleContext {
  /** Area id → live (towns, municipalities, settlements of the atlas). */
  areaState: Map<string, boolean>
  regionId: string | null
  municipalities: readonly SnapshotMunicipality[]
  settlements: readonly SnapshotSettlement[]
  itemById: Map<string, SnapshotItem>
  personById: Map<string, SnapshotPerson>
  sources: Map<string, SnapshotSource>
}

const AREA_RELATIONS = new Set(['recorded_in', 'about'])
const ROLES = new Set(['narrator', 'collector'])
const PERIOD_UNITS = new Set(['decade', 'century'])
const PRECISIONS = new Set(['year', 'month', 'day'])

function quotes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((quote): quote is string => typeof quote === 'string' && quote.trim().length > 0) : []
}

/**
 * The intangible heritage of the snapshot. A published record is live when its type is known; archived records,
 * themes and narrators are gone (410) and drafts are never loaded. Links to anything that is not public are dropped:
 * a place outside the atlas, an archived narrator or source, a heritage item that is not live.
 */
export function buildIntangible<H extends { kind: string, slug: string, entity_id: string }>(
  rows: IntangibleRows, context: IntangibleContext, slugHistoryRows: readonly H[] = []
): {
  content: SnapshotIntangibleContent
  /** Slug-history rows with every old narrator slug that would give away an unnamed narrator removed. */
  slugHistory: H[]
} {
  const gone: IntangibleGone = { records: new Set(), themes: new Set(), narrators: new Set(), ids: new Set() }

  const typeById = new Map<string, SnapshotTypeLabel>()
  for (const kind of INTANGIBLE_KINDS) {
    for (const t of rows.types[kind]) {
      typeById.set(t.id, { id: t.id, kind, key: t.key, label: t.label_hr, sort: t.sort, filterable: t.status === 'published' })
    }
  }
  const occasionById = new Map(rows.occasions.map(o => [o.id, { id: o.id, label: o.label_hr }]))

  const themes: SnapshotTheme[] = []
  for (const t of rows.themes) {
    if (t.status !== 'published') {
      gone.themes.add(t.slug)
      gone.ids.add(t.id)
      continue
    }
    themes.push({ id: t.id, slug: t.slug, label: t.label_hr, description: t.description, sort: t.sort, updatedAt: t.updated_at })
  }
  themes.sort((a, b) => a.sort - b.sort || collator.compare(a.label, b.label) || (a.id < b.id ? -1 : 1))
  const themeById = new Map(themes.map(t => [t.id, t]))

  const narrators: SnapshotNarrator[] = []
  const unnamed = new Map<string, NarratorRow>()
  for (const n of rows.narrators) {
    if (n.status !== 'published') {
      gone.narrators.add(n.slug)
      gone.ids.add(n.id)
      continue
    }
    if (!n.consent_named) unnamed.set(n.id, n)
    if (exposesName(n)) continue
    const named = n.consent_named
    const settlementLive = n.settlement_id !== null && context.areaState.get(n.settlement_id) === true
    narrators.push({
      id: n.id,
      slug: n.slug,
      label: named ? n.name : (n.public_description ?? ANONYMOUS_LABEL),
      named,
      description: n.public_description,
      living: named ? n.living : null,
      bornYear: named ? n.born_year : null,
      settlementId: named && settlementLive ? n.settlement_id : null,
      personId: named && n.person_id !== null && context.personById.has(n.person_id) ? n.person_id : null,
      noindex: n.noindex,
      updatedAt: n.updated_at
    })
  }
  narrators.sort((a, b) => collator.compare(a.label, b.label) || (a.id < b.id ? -1 : 1))
  const narratorById = new Map(narrators.map(n => [n.id, n]))

  const wordById = new Map<string, SnapshotWord>()
  for (const w of rows.words) {
    if (w.headword) wordById.set(w.id, { id: w.id, headword: w.headword, slug: w.slug })
  }
  const wordLinks = byRecord(rows.folkTextWords)

  const regionId = context.regionId
  const placeLive = (areaId: string) => areaId === regionId || context.areaState.get(areaId) === true

  const records: SnapshotIntangible[] = []
  for (const kind of INTANGIBLE_KINDS) {
    const links = rows.links[kind]
    const areaLinks = byRecord(links.areas)
    const narratorLinks = byRecord(links.narrators)
    const authorLinks = byRecord(links.authors)
    const itemLinks = byRecord(links.items)
    const themeLinks = byRecord(links.themes)
    const sourceLinks = byRecord(links.sources)

    for (const r of rows.records[kind]) {
      if (r.status !== 'published') {
        gone.records.add(`${kind}/${r.slug}`)
        gone.ids.add(r.id)
        continue
      }
      if (!typeById.has(r.type_id)) continue
      records.push({
        id: r.id,
        kind,
        slug: r.slug,
        title: r.title,
        typeId: r.type_id,
        occasionId: r.occasion_id && occasionById.has(r.occasion_id) ? r.occasion_id : null,
        customId: null,
        textLocal: r.text_local ?? null,
        textStandard: r.text_standard ?? null,
        description: r.description ?? null,
        quotes: quotes(r.quotes),
        period: r.period ?? null,
        periodUnit: r.period_unit && PERIOD_UNITS.has(r.period_unit) ? r.period_unit as 'decade' | 'century' : null,
        periodValue: r.period_value ?? null,
        recordedPrecision: r.recorded_precision && PRECISIONS.has(r.recorded_precision) ? r.recorded_precision as 'year' | 'month' | 'day' : null,
        recordedYear: r.recorded_year,
        recordedMonth: r.recorded_month,
        recordedDay: r.recorded_day,
        verification: r.verification,
        noindex: r.noindex,
        credits: credits(r.credits),
        areaLinks: (areaLinks.get(r.id) ?? [])
          .filter(link => AREA_RELATIONS.has(link.relation) && placeLive(link.area_id))
          .map(link => ({ areaId: link.area_id, relation: link.relation as 'recorded_in' | 'about' })),
        narratorLinks: (narratorLinks.get(r.id) ?? [])
          .filter(link => ROLES.has(link.role) && narratorById.has(link.narrator_id))
          .map(link => ({ narratorId: link.narrator_id, role: link.role as 'narrator' | 'collector' })),
        authorIds: (authorLinks.get(r.id) ?? []).filter(link => context.personById.has(link.person_id)).map(link => link.person_id),
        itemIds: (itemLinks.get(r.id) ?? []).filter(link => context.itemById.has(link.item_id)).map(link => link.item_id),
        themeIds: (themeLinks.get(r.id) ?? []).filter(link => themeById.has(link.theme_id)).map(link => link.theme_id),
        sourceIds: (sourceLinks.get(r.id) ?? []).filter(link => context.sources.has(link.source_id)).map(link => link.source_id),
        words: kind === 'folk_text'
          ? (wordLinks.get(r.id) ?? []).flatMap(link => wordById.get(link.word_id) ?? [])
          : [],
        updatedAt: r.updated_at
      })
      // A Folk text names the Custom it belongs to; whether that Custom is public is known once all records are.
      if (kind === 'folk_text' && r.custom_id) records[records.length - 1]!.customId = r.custom_id
    }
  }

  const liveCustoms = new Set(records.filter(r => r.kind === 'custom').map(r => r.id))
  for (const record of records) {
    if (record.customId && !liveCustoms.has(record.customId)) record.customId = null
  }
  records.sort(byTitle)

  const recordsByTheme = new Map<string, string[]>()
  const recordsByNarrator = new Map<string, string[]>()
  const recordsByArea = new Map<string, string[]>()
  const recordsByPerson = new Map<string, string[]>()
  const folkTextsByCustom = new Map<string, string[]>()
  for (const record of records) {
    for (const themeId of record.themeIds) push(recordsByTheme, themeId, record.id)
    for (const { areaId } of record.areaLinks) push(recordsByArea, areaId, record.id)
    for (const personId of record.authorIds) push(recordsByPerson, personId, record.id)
    for (const { narratorId } of record.narratorLinks) {
      push(recordsByNarrator, narratorId, record.id)
      const personId = narratorById.get(narratorId)?.personId
      if (personId) push(recordsByPerson, personId, record.id)
    }
    if (record.customId) push(folkTextsByCustom, record.customId, record.id)
  }

  // An old narrator slug that repeats the name of a narrator without consent is a leak waiting to redirect.
  const slugHistory = slugHistoryRows.filter((row) => {
    if (row.kind !== 'narrator') return true
    const narrator = unnamed.get(row.entity_id)
    return !narrator || !containsNamePart(row.slug.replaceAll('-', ' '), narrator.name)
  })

  return {
    content: {
      records,
      themes,
      narrators,
      recordById: new Map(records.map(r => [r.id, r])),
      recordByRoute: new Map(records.map(r => [`${r.kind}/${r.slug}`, r.id])),
      themeById,
      themeBySlug: new Map(themes.map(t => [t.slug, t])),
      narratorById,
      narratorBySlug: new Map(narrators.map(n => [n.slug, n])),
      typeById,
      occasionById,
      recordsByTheme,
      recordsByNarrator,
      recordsByArea,
      recordsByPerson,
      folkTextsByCustom,
      gone
    },
    slugHistory
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

const RECORD_COMMON = 'id,title,slug,type_id,recorded_precision,recorded_year,recorded_month,recorded_day,verification,noindex,credits,status,updated_at'
const RECORD_COLUMNS: Record<IntangibleKind, string> = {
  story: `${RECORD_COMMON},text_local,text_standard,period,period_unit,period_value`,
  custom: `${RECORD_COMMON},occasion_id,description,quotes,period,period_unit,period_value`,
  folk_text: `${RECORD_COMMON},custom_id,text_local,text_standard`
}
const TABLES: Record<IntangibleKind, string> = { story: 'stories', custom: 'customs', folk_text: 'folk_texts' }
const TYPE_TABLES: Record<IntangibleKind, string> = { story: 'story_types', custom: 'custom_types', folk_text: 'folk_text_types' }

async function loadLinks(client: SupabaseClient, kind: IntangibleKind): Promise<IntangibleLinkRows> {
  const fk = `${kind}_id`
  // The column lists are built from the kind, so the client cannot type them; the row shapes are declared above.
  const read = <T>(suffix: string, columns: string) => readAll<T>((from, to) => client.from(`${kind}_${suffix}`)
    .select(`record_id:${fk},${columns},position`).order(fk).order('position').range(from, to) as unknown as Page<T>)
  const [areas, narrators, authors, items, themes, sources] = await Promise.all([
    read<AreaLinkRow>('areas', 'area_id,relation'),
    read<NarratorLinkRow>('narrators', 'narrator_id,role'),
    read<AuthorLinkRow>('authors', 'person_id'),
    read<ItemLinkRow>('heritage_items', 'item_id'),
    read<ThemeLinkRow>('themes', 'theme_id'),
    read<SourceLinkRow>('sources', 'source_id')
  ])
  return { areas, narrators, authors, items, themes, sources }
}

/**
 * Reads everything intangible heritage in the snapshot needs. Published and archived rows only (drafts never leave
 * the database), and never the columns that are for editors: `research_notes`, `search_text`, `apply_credit` and a
 * Narrator's `consent_note`.
 */
export async function loadIntangibleRows(client: SupabaseClient): Promise<IntangibleRows> {
  const keyed = (table: string) => readAll<KeyedRow>((from, to) => client.from(table)
    .select('id,key,label_hr,sort,status').in('status', VISIBLE).order('id').range(from, to))
  const records = (kind: IntangibleKind) => readAll<IntangibleRow>((from, to) => client.from(TABLES[kind])
    .select(RECORD_COLUMNS[kind]).in('status', VISIBLE).order('id').range(from, to) as unknown as Page<IntangibleRow>)
  const [stories, customs, folkTexts] = await Promise.all(INTANGIBLE_KINDS.map(records))
  const [storyLinks, customLinks, folkLinks] = await Promise.all(INTANGIBLE_KINDS.map(kind => loadLinks(client, kind)))
  const [storyTypes, customTypes, folkTypes] = await Promise.all(INTANGIBLE_KINDS.map(kind => keyed(TYPE_TABLES[kind])))
  const [occasions, themes, narrators, folkTextWords] = await Promise.all([
    keyed('occasions'),
    readAll<ThemeRow>((from, to) => client.from('themes')
      .select('id,slug,label_hr,description,sort,status,updated_at').in('status', VISIBLE).order('id').range(from, to)),
    readAll<NarratorRow>((from, to) => client.from('narrators')
      .select('id,name,slug,public_description,consent_named,living,born_year,settlement_id,person_id,noindex,status,updated_at')
      .in('status', VISIBLE).order('id').range(from, to)),
    readAll<WordLinkRow>((from, to) => client.from('folk_text_words')
      .select('record_id:folk_text_id,word_id,position').order('folk_text_id').order('position').range(from, to))
  ])

  // Only the words the folk texts contain, and only live ones (active and not archived).
  const wordIds = [...new Set(folkTextWords.map(link => link.word_id))]
  const words: WordRow[] = []
  for (let i = 0; i < wordIds.length; i += WORD_CHUNK) {
    const { data, error } = await client.from('heritage_words')
      .select('id,slug,headword:entry->>headword').in('id', wordIds.slice(i, i + WORD_CHUNK)).eq('active', true).is('archived_at', null)
    if (error) throw new Error(error.message)
    words.push(...(data as unknown as Row[]).map(row => ({ id: row.id as string, slug: (row.slug as string | null) ?? null, headword: (row.headword as string | null) ?? null })))
  }

  return {
    records: { story: stories!, custom: customs!, folk_text: folkTexts! },
    links: { story: storyLinks!, custom: customLinks!, folk_text: folkLinks! },
    types: { story: storyTypes!, custom: customTypes!, folk_text: folkTypes! },
    occasions, themes, narrators, folkTextWords, words
  }
}
