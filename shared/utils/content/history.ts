import type { ContentKind, ContentList } from './common'
import { CONTENT_STATUS_LABELS } from './common'
import { challengeContentEntries } from './challengeTemplate'
import { AREA_KIND_LABELS } from './area'
import { SOURCE_TYPE_LABELS } from './source'
import { HERITAGE_STATUS_LABELS, HERITAGE_VERIFICATION_LABELS } from './heritageItem'
import { PERSON_AREA_ROLE_LABELS } from './person'

// Change history of the content admin: the shapes of the history API, the vocabulary the screens
// use (kind and field labels) and the pure helpers that turn two row snapshots into a field diff.
// The database records every write in `content_revisions` (see docs/database.md); the API reads
// that table, and the history drawer and /admin/povijest render what it returns.

/**
 * Every `entity_kind` the database audit triggers write to `content_revisions`. It is wider than
 * `ContentKind` because history also lists kinds whose admin resource is not built yet (the
 * imported areas, heritage items and categories, and words).
 */
export const HISTORY_KINDS = ['area', 'challenge_template', 'heritage_category', 'heritage_item', 'person', 'club', 'source', 'word'] as const
export type HistoryKind = typeof HISTORY_KINDS[number]

export function isHistoryKind(value: unknown): value is HistoryKind {
  return (HISTORY_KINDS as readonly unknown[]).includes(value)
}

export const HISTORY_ACTIONS = ['insert', 'update', 'delete'] as const
export type HistoryAction = typeof HISTORY_ACTIONS[number]

export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  insert: 'Stvoreno',
  update: 'Izmijenjeno',
  delete: 'Obrisano'
}

/** Who wrote a revision: the admin (the default) or a seed migration (`import`). */
export const HISTORY_ACTORS = ['admin', 'import'] as const
export const HISTORY_ACTOR_LABELS: Record<string, string> = { admin: 'Administrator', import: 'Uvoz sadržaja' }
export const HISTORY_ACTOR_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,59}$/

/** How a kind is named on the history screens and where its admin page lives (when it has one). */
export interface HistoryKindMeta {
  singular: string
  plural: string
  adminPath: string
}

export const HISTORY_KIND_META: Record<HistoryKind, HistoryKindMeta> = {
  area: { singular: 'Mjesto', plural: 'Mjesta', adminPath: '/admin/mjesta' },
  challenge_template: { singular: 'Izazov', plural: 'Izazovi', adminPath: '/admin/izazovi' },
  heritage_category: { singular: 'Kategorija baštine', plural: 'Kategorije baštine', adminPath: '/admin/kategorije' },
  heritage_item: { singular: 'Zapis baštine', plural: 'Zapisi baštine', adminPath: '/admin/bastina' },
  person: { singular: 'Osoba', plural: 'Osobe', adminPath: '/admin/osobe' },
  club: { singular: 'Klub', plural: 'Klubovi', adminPath: '/admin/klubovi' },
  source: { singular: 'Izvor', plural: 'Izvori', adminPath: '/admin/izvori' },
  word: { singular: 'Riječ', plural: 'Riječi', adminPath: '/admin/rijeci' }
}

/** One labelled part of a structured value (see `HistoryFieldMeta.entries`). */
export interface HistoryEntry {
  /** Stable across versions (e.g. built from round and question ids), so a moved part is not a change. */
  key: string
  label: string
  value: string
}

/** A field as the history shows it: a Croatian label and, for coded values, a label per value. */
export interface HistoryFieldMeta {
  label: string
  values?: Record<string, string>
  /**
   * Splits a structured value (a whole challenge set) into labelled parts, so the history lists the
   * parts that changed instead of two large JSON blobs. See `expandHistoryChange`.
   */
  entries?(value: unknown): HistoryEntry[]
}

/**
 * Labels of the editable API fields of each registered kind (the keys of the kind's `fields`, plus
 * `status`). Adding a kind to `ContentKind` requires an entry here, so a new admin resource cannot
 * ship a history that shows raw field names.
 */
export const HISTORY_FIELDS: Record<ContentKind, Record<string, HistoryFieldMeta>> = {
  area: {
    kind: { label: 'Vrsta', values: AREA_KIND_LABELS },
    parentId: { label: 'Nadređeno mjesto' },
    name: { label: 'Naziv' },
    slug: { label: 'Slug' },
    officialCode: { label: 'Službeni kod (DGU)' },
    geonamesId: { label: 'GeoNames ID' },
    latitude: { label: 'Geografska širina' },
    longitude: { label: 'Geografska dužina' },
    description: { label: 'Opis' },
    regionIds: { label: 'Regije' }
  },
  source: {
    title: { label: 'Naslov' },
    type: { label: 'Vrsta', values: SOURCE_TYPE_LABELS },
    url: { label: 'Poveznica' },
    note: { label: 'Napomena' }
  },
  challenge_template: {
    name: { label: 'Naziv' },
    content: { label: 'Pitanja', entries: challengeContentEntries },
    isCurrent: { label: 'Trenutni izazov' }
  },
  word: {
    entry: { label: 'Kartica riječi' }
  },
  heritage_category: {
    key: { label: 'Ključ' },
    labelHr: { label: 'Naziv (hr)' },
    labelEn: { label: 'Naziv (en)' },
    sort: { label: 'Redoslijed' }
  },
  heritage_item: {
    name: { label: 'Naziv' },
    slug: { label: 'Adresa (slug)' },
    categoryId: { label: 'Kategorija' },
    municipalityId: { label: 'Grad ili općina' },
    settlementId: { label: 'Naselje' },
    locality: { label: 'Lokalitet' },
    verification: { label: 'Status provjere', values: HERITAGE_VERIFICATION_LABELS },
    heritageStatus: { label: 'Status u registru', values: HERITAGE_STATUS_LABELS },
    registryNumber: { label: 'Registarski broj' },
    period: { label: 'Razdoblje' },
    description: { label: 'Opis' },
    researchNotes: { label: 'Bilješke istraživanja' },
    latitude: { label: 'Geografska širina' },
    longitude: { label: 'Geografska dužina' },
    noindex: { label: 'Noindex' },
    sourceIds: { label: 'Izvori' }
  },
  person: {
    name: { label: 'Ime' },
    slug: { label: 'Slug' },
    role: { label: 'Uloga' },
    clue: { label: 'Natuknica' },
    bio: { label: 'Biografija' },
    born: { label: 'Rođen/a (prikaz)' },
    bornYear: { label: 'Godina rođenja' },
    bornPlace: { label: 'Mjesto rođenja' },
    died: { label: 'Smrt (prikaz)' },
    diedYear: { label: 'Godina smrti' },
    diedPlace: { label: 'Mjesto smrti' },
    openQuestions: { label: 'Što još provjeravamo' },
    researchNotes: { label: 'Bilješke istraživanja' },
    verification: { label: 'Status provjere', values: HERITAGE_VERIFICATION_LABELS },
    noindex: { label: 'Noindex' },
    areaLinks: { label: 'Mjesta', values: PERSON_AREA_ROLE_LABELS },
    itemLinks: { label: 'Povezana baština' },
    sourceIds: { label: 'Izvori' }
  },
  club: {
    name: { label: 'Ime' },
    slug: { label: 'Slug' },
    fullName: { label: 'Puni naziv' },
    sport: { label: 'Sport' },
    settlementId: { label: 'Naselje' },
    foundedYear: { label: 'Godina osnivanja' },
    homeGround: { label: 'Domaći teren' },
    researchNotes: { label: 'Bilješke istraživanja' },
    verification: { label: 'Status provjere', values: HERITAGE_VERIFICATION_LABELS },
    noindex: { label: 'Noindex' },
    seasons: { label: 'Sezone' },
    sourceIds: { label: 'Izvori' }
  }
}

export const HISTORY_STATUS_FIELD: HistoryFieldMeta = { label: 'Status', values: CONTENT_STATUS_LABELS }

export function historyFieldMeta(kind: ContentKind, field: string): HistoryFieldMeta {
  if (field === 'status') return HISTORY_STATUS_FIELD
  return HISTORY_FIELDS[kind]?.[field] ?? { label: field }
}

/** A value in the history: empty values are an em dash, coded values use their label. */
export function formatHistoryValue(meta: HistoryFieldMeta, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return meta.values?.[value] ?? value
  if (typeof value === 'boolean') return value ? 'Da' : 'Ne'
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

/** A change as the history shows it: a label and both values already formatted. */
export interface HistoryChangeRow {
  key: string
  label: string
  before: string
  after: string
  beforeEmpty: boolean
  afterEmpty: boolean
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === ''
}

/**
 * The rows the history shows for one changed field: one row for a plain field, or one row per
 * changed part for a field with `entries` (in the order of the newer version, then removed parts).
 */
export function expandHistoryChange(meta: HistoryFieldMeta, change: HistoryChange): HistoryChangeRow[] {
  if (!meta.entries) {
    return [{
      key: change.field,
      label: meta.label,
      before: formatHistoryValue(meta, change.before),
      after: formatHistoryValue(meta, change.after),
      beforeEmpty: isEmpty(change.before),
      afterEmpty: isEmpty(change.after)
    }]
  }
  const before = new Map(isEmpty(change.before) ? [] : meta.entries(change.before).map(entry => [entry.key, entry]))
  const after = isEmpty(change.after) ? [] : meta.entries(change.after)
  const row = (key: string, label: string, was = '', now = ''): HistoryChangeRow => ({
    key: `${change.field}:${key}`,
    label: `${meta.label} · ${label}`,
    before: was || '—',
    after: now || '—',
    beforeEmpty: !was,
    afterEmpty: !now
  })
  const rows: HistoryChangeRow[] = []
  for (const entry of after) {
    const was = before.get(entry.key)
    before.delete(entry.key)
    if ((was?.value ?? '') !== entry.value) rows.push(row(entry.key, entry.label, was?.value, entry.value))
  }
  for (const was of before.values()) if (was.value) rows.push(row(was.key, was.label, was.value))
  return rows
}

/** One field that differs between two versions of a row, in API (camelCase) form. */
export interface HistoryChange {
  field: string
  before: unknown
  after: unknown
}

type Snapshot = Record<string, unknown> | null

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function present(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

/**
 * The fields that differ between two versions of a row. `before` is null for a row's creation and
 * `after` is null for its deletion; then the fields that hold a value are listed. Keys are compared
 * in the order of `fields`, which is the kind's field order.
 */
export function diffSnapshots(before: Snapshot, after: Snapshot, fields: readonly string[]): HistoryChange[] {
  const changes: HistoryChange[] = []
  for (const field of fields) {
    const was = before?.[field] ?? null
    const now = after?.[field] ?? null
    if (before && after ? !sameValue(was, now) : present(was) || present(now)) changes.push({ field, before: was, after: now })
  }
  return changes
}

/** A revision of one row as the history drawer shows it. */
export interface HistoryRevision {
  /** `content_revisions.id`: the key of a restore and of paging. */
  id: number
  /** The row's revision after this write (a delete counts as the next number). */
  revision: number
  action: HistoryAction
  actor: string
  createdAt: string
  submissionId: number | null
  /** What this write changed in the editable fields. */
  changes: HistoryChange[]
}

export interface HistoryRevisions {
  kind: ContentKind
  entityId: string
  /** Name of the row in its latest version. */
  label: string
  /** Whether the row exists now; a deleted row can still be restored. */
  exists: boolean
  /** The row's current `revision`, which a restore must send back; null when it is deleted. */
  currentRevision: number | null
  revisions: HistoryRevision[]
  /** More, older revisions: ask again with `before` set to the last `id` listed. */
  hasMore: boolean
}

export interface HistoryRestoreResult {
  /** The row was already in the requested version, so nothing was written. */
  unchanged: boolean
  /** The row was recreated from a deleted state. */
  recreated: boolean
  entity: Record<string, unknown>
}

/** One line of the global change log (/admin/povijest). */
export interface HistoryLogRow {
  id: number
  kind: HistoryKind
  entityId: string
  revision: number
  action: HistoryAction
  actor: string
  createdAt: string
  submissionId: number | null
  /** Name of the row in this version. */
  label: string
  /** Whether the kind has an admin resource, and with it a history drawer and restore. */
  registered: boolean
}

export type HistoryLog = ContentList<HistoryLogRow>
export const HISTORY_REVISIONS_LIMIT = 20
export const HISTORY_REVISIONS_MAX = 50
