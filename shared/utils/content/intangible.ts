import type { ContentStatus, issueCollector } from './common'
import { contentStatus, isRecord, isUuid } from './common'
import { atlasSlug } from '../atlasSlug'
import { HERITAGE_VERIFICATIONS, type HeritageVerification } from './heritageItem'

// What Story, Custom and Folk text share (GLOSSARY.md, "Intangible heritage"; docs/adr/0001): the limits, the
// vocabulary of places, narrators, dates and periods, and the parsers that turn the fields of an admin form into
// validated values. The three kinds' own validators (story.ts, custom.ts, folkText.ts) are built from these, and
// the database repeats every rule as a constraint (supabase/migrations/20261108000000_intangible_heritage.sql).

type Add = (path: string, message: string) => void

export const INTANGIBLE_LIMITS = {
  title: 200,
  slug: 120,
  text: 30000,
  period: 200,
  researchNotes: 5000,
  quote: 500,
  step: 500,
  wordId: 200
} as const

export const INTANGIBLE_MAX = {
  areaLinks: 20,
  narrators: 12,
  authors: 12,
  items: 12,
  themes: 12,
  sources: 10,
  quotes: 10,
  steps: 20,
  words: 30
} as const

/** Where a record was told, practised or collected (Zabilježeno u), or the place it is set in or tied to (Odnosi se na). */
export const AREA_RELATIONS = ['recorded_in', 'about'] as const
export type AreaRelation = typeof AREA_RELATIONS[number]
export const AREA_RELATION_LABELS: Record<AreaRelation, string> = {
  recorded_in: 'Zabilježeno u',
  about: 'Odnosi se na'
}

/**
 * How a Narrator (Kazivač) stands to a record: told it (narrator) or wrote it down (collector, Zapisivač). A collector
 * is recorded the same way as a narrator, as a Narrator record, so a person who only writes things down needs no Person.
 */
export const NARRATOR_ROLES = ['narrator', 'collector'] as const
export type NarratorRole = typeof NARRATOR_ROLES[number]
export const NARRATOR_ROLE_LABELS: Record<NarratorRole, string> = {
  narrator: 'Kazivač/ica',
  collector: 'Zapisivač/ica'
}

/** How precisely a date is known (Datum bilježenja): never a guessed exact day. */
export const RECORDED_PRECISIONS = ['year', 'month', 'day'] as const
export type RecordedPrecision = typeof RECORDED_PRECISIONS[number]
export const RECORDED_PRECISION_LABELS: Record<RecordedPrecision, string> = {
  year: 'Godina',
  month: 'Mjesec',
  day: 'Dan'
}

/** The approximate era a period names, for sorting: a decade (1960 = the 1960s) or a century (17 = 1601–1700). */
export const PERIOD_UNITS = ['decade', 'century'] as const
export type PeriodUnit = typeof PERIOD_UNITS[number]
export const PERIOD_UNIT_LABELS: Record<PeriodUnit, string> = {
  decade: 'Desetljeće',
  century: 'Stoljeće'
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const YEAR_MIN = 1000
const YEAR_MAX = 2100

export interface AreaLink {
  areaId: string
  relation: AreaRelation
}

/** A Narrator linked to a record, as its narrator or its collector. The Narrator's own record says how they are named publicly. */
export interface NarratorLink {
  narratorId: string
  role: NarratorRole
}

export interface RecordedOn {
  recordedPrecision: RecordedPrecision | null
  recordedYear: number | null
  recordedMonth: number | null
  recordedDay: number | null
}

export interface Period {
  period: string | null
  periodUnit: PeriodUnit | null
  periodValue: number | null
}

/** The links every kind has, in their API shape (the kind's `sidecars`). */
export interface IntangibleLinks {
  areaLinks: AreaLink[]
  narrators: NarratorLink[]
  /** Persons (historical people) who wrote the text, for literary retellings only. */
  authorIds: string[]
  itemIds: string[]
  themeIds: string[]
  sourceIds: string[]
}

/** The verification scale is the heritage one; its meaning for these kinds is in the Verification glossary entry. */
export { HERITAGE_VERIFICATIONS as INTANGIBLE_VERIFICATIONS, HERITAGE_VERIFICATION_LABELS as INTANGIBLE_VERIFICATION_LABELS } from './heritageItem'

/** A slug as given, or the one derived from the title; reports a missing or malformed one. */
export function checkSlug(add: Add, value: unknown, derive: () => string) {
  let slug = typeof value === 'string' ? value.trim() : ''
  if (!slug) slug = derive()
  if (!slug) add('slug', 'Polje „Slug“ je obavezno.')
  else if (slug.length > INTANGIBLE_LIMITS.slug) add('slug', `Polje „Slug“ može imati najviše ${INTANGIBLE_LIMITS.slug} znakova.`)
  else if (!SLUG_PATTERN.test(slug)) add('slug', 'Slug smije sadržavati samo mala slova, brojeve i crtice.')
  return slug
}

/** An optional whole number between two bounds; an empty value is null. */
function optionalInteger(add: Add, path: string, value: unknown, min: number, max: number, message: string) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    add(path, message)
    return null
  }
  return value
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/**
 * When a record was told or collected, as precise as it is known: the precision says which parts are there. A part
 * below the precision is refused, never filled in, so the data cannot hold a day nobody knew.
 */
export function parseRecordedOn(add: Add, body: Record<string, unknown>): RecordedOn {
  const empty: RecordedOn = { recordedPrecision: null, recordedYear: null, recordedMonth: null, recordedDay: null }
  const raw = body.recordedPrecision
  const year = optionalInteger(add, 'recordedYear', body.recordedYear, YEAR_MIN, YEAR_MAX, `Godina mora biti cijeli broj između ${YEAR_MIN} i ${YEAR_MAX}.`)
  const month = optionalInteger(add, 'recordedMonth', body.recordedMonth, 1, 12, 'Mjesec mora biti broj od 1 do 12.')
  const day = optionalInteger(add, 'recordedDay', body.recordedDay, 1, 31, 'Dan mora biti broj od 1 do 31.')

  if (raw === undefined || raw === null || raw === '') {
    if (year !== null || month !== null || day !== null) add('recordedPrecision', 'Odaberite koliko je datum precizan.')
    return empty
  }
  if (!(RECORDED_PRECISIONS as readonly unknown[]).includes(raw)) {
    add('recordedPrecision', 'Vrijednost polja „Preciznost datuma“ nije dopuštena.')
    return empty
  }
  const precision = raw as RecordedPrecision
  if (year === null) add('recordedYear', 'Godina je obavezna.')
  if (precision === 'year' && month !== null) add('recordedMonth', 'Mjesec se ne navodi kad je poznata samo godina.')
  if (precision !== 'day' && day !== null) add('recordedDay', 'Dan se ne navodi kad nije poznat.')
  if (precision !== 'year' && month === null) add('recordedMonth', 'Mjesec je obavezan.')
  if (precision === 'day') {
    if (day === null) add('recordedDay', 'Dan je obavezan.')
    else if (year !== null && month !== null && day > daysInMonth(year, month)) add('recordedDay', 'Taj dan ne postoji u odabranom mjesecu.')
  }
  return {
    recordedPrecision: precision,
    recordedYear: year,
    recordedMonth: precision === 'year' ? null : month,
    recordedDay: precision === 'day' ? day : null
  }
}

/** The era in the words people use ("u turska vremena", "do 1960-ih"), optionally with an approximate decade or century. */
export function parsePeriod(
  add: Add, body: Record<string, unknown>, optionalText: (path: string, value: unknown, max: number, label: string) => string | null, label: string
): Period {
  const period = optionalText('period', body.period, INTANGIBLE_LIMITS.period, label)
  const unitRaw = body.periodUnit
  const hasUnit = unitRaw !== undefined && unitRaw !== null && unitRaw !== ''
  const hasValue = body.periodValue !== undefined && body.periodValue !== null && body.periodValue !== ''
  if (!hasUnit && !hasValue) return { period, periodUnit: null, periodValue: null }
  if (!(PERIOD_UNITS as readonly unknown[]).includes(unitRaw)) {
    add('periodUnit', hasUnit ? 'Vrijednost polja „Približno razdoblje“ nije dopuštena.' : 'Odaberite desetljeće ili stoljeće.')
    return { period, periodUnit: null, periodValue: null }
  }
  const unit = unitRaw as PeriodUnit
  const decade = unit === 'decade'
  const value = optionalInteger(
    add, 'periodValue', body.periodValue, decade ? YEAR_MIN : 1, decade ? 2090 : 21,
    decade ? 'Desetljeće je prva godina desetljeća, npr. 1960.' : 'Stoljeće je broj od 1 do 21, npr. 17.'
  )
  if (value === null && !hasValue) add('periodValue', decade ? 'Navedite desetljeće.' : 'Navedite stoljeće.')
  if (decade && value !== null && value % 10 !== 0) add('periodValue', 'Desetljeće je prva godina desetljeća, npr. 1960.')
  return { period, periodUnit: unit, periodValue: value }
}

function parseList<T>(add: Add, path: string, value: unknown, max: number, parseRow: (row: unknown, index: number) => T | null) {
  if (value === undefined || value === null) return [] as T[]
  if (!Array.isArray(value)) {
    add(path, 'Popis mora biti niz.')
    return [] as T[]
  }
  if (value.length > max) add(path, `Najviše ${max} stavki.`)
  const rows: T[] = []
  for (const [index, row] of value.entries()) {
    const parsed = parseRow(row, index)
    if (parsed) rows.push(parsed)
  }
  return rows
}

/** A place with how the record relates to it. Several allowed; the same place and relation twice is kept once. */
export function parseAreaLinks(add: Add, value: unknown): AreaLink[] {
  const links = parseList(add, 'areaLinks', value, INTANGIBLE_MAX.areaLinks, (row, index) => {
    if (!isRecord(row)) {
      add(`areaLinks.${index}`, 'Veza na mjesto nije valjana.')
      return null
    }
    const areaId = typeof row.areaId === 'string' && isUuid(row.areaId) ? row.areaId.toLowerCase() : null
    if (!areaId) add(`areaLinks.${index}.areaId`, 'Mjesto nije valjano.')
    const relation = (AREA_RELATIONS as readonly unknown[]).includes(row.relation) ? row.relation as AreaRelation : null
    if (!relation) add(`areaLinks.${index}.relation`, 'Odaberite je li zapis zabilježen u tom mjestu ili se odnosi na njega.')
    return areaId && relation ? { areaId, relation } : null
  })
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = `${link.areaId}:${link.relation}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Narrators and collectors: Narrator records, each as its narrator or its collector. A narrator can be both on one
 * record; the same narrator in the same role twice is kept once. Whether the Narrator exists is checked against the
 * database, and how they are named in public is the Narrator record's own business (narrator.ts).
 */
export function parseNarratorLinks(add: Add, value: unknown): NarratorLink[] {
  const links = parseList(add, 'narrators', value, INTANGIBLE_MAX.narrators, (row, index) => {
    if (!isRecord(row)) {
      add(`narrators.${index}`, 'Veza na kazivača nije valjana.')
      return null
    }
    const narratorId = typeof row.narratorId === 'string' && isUuid(row.narratorId) ? row.narratorId.toLowerCase() : null
    if (!narratorId) add(`narrators.${index}.narratorId`, 'Kazivač nije valjan.')
    const role = (NARRATOR_ROLES as readonly unknown[]).includes(row.role) ? row.role as NarratorRole : null
    if (!role) add(`narrators.${index}.role`, 'Odaberite je li kazivač ispričao ili zapisao zapis.')
    return narratorId && role ? { narratorId, role } : null
  })
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = `${link.narratorId}:${link.role}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** A list of UUIDs (heritage items, themes, sources), deduplicated, in order. */
export function parseIdList(add: Add, path: string, value: unknown, max: number, label: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    add(path, `${label} moraju biti popis identifikatora.`)
    return []
  }
  if (value.length > max) add(path, `Najviše ${max} stavki.`)
  const ids: string[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !isUuid(entry)) add(`${path}.${index}`, `${label}: stavka nije valjana.`)
    else if (!ids.includes(entry.toLowerCase())) ids.push(entry.toLowerCase())
  }
  return ids
}

/** An optional UUID field (a type, an occasion, a custom); an empty value is null. */
export function parseOptionalId(add: Add, path: string, value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'string' && isUuid(value)) return value.toLowerCase()
  add(path, `Polje „${label}“ nije valjano.`)
  return null
}

/** A required UUID field. */
export function parseRequiredId(add: Add, path: string, value: unknown, message: string): string {
  if (typeof value === 'string' && isUuid(value)) return value.toLowerCase()
  add(path, message)
  return ''
}

/**
 * Verification confirms the attestation (that it was really told or practised here, in this form), which needs
 * someone or something to vouch for it: a narrator (named or described) or a source. It never blocks publishing.
 */
export function verifiedNeedsBacking(add: Add, verification: string, links: Pick<IntangibleLinks, 'narrators' | 'sourceIds'>) {
  if (verification !== 'verified') return
  if (links.narrators.some(link => link.role === 'narrator') || links.sourceIds.length) return
  add('verification', 'Provjereno traži barem jednog kazivača ili izvor koji potvrđuje da je ovako zaista pričano ili činjeno.')
}

/** What every kind carries besides its own text fields. */
export interface IntangibleCommon extends RecordedOn, IntangibleLinks {
  title: string
  slug: string
  verification: HeritageVerification
  researchNotes: string
  noindex: boolean
  status: ContentStatus
}

/**
 * Parses the fields all three kinds share (title, slug, recorded-on date, verification, notes, status and the
 * links) into `check`'s issues, so each kind's validator only adds its own fields and rules.
 */
export function parseIntangibleCommon(check: ReturnType<typeof issueCollector>, body: Record<string, unknown>): IntangibleCommon {
  const title = check.required('title', body.title, INTANGIBLE_LIMITS.title, 'Naslov')
  const slug = checkSlug(check.add, body.slug, () => (title ? atlasSlug(title) : ''))
  const recorded = parseRecordedOn(check.add, body)
  // A missing verification is Unverified (a Draft made from a Memory carries none).
  const verification = body.verification === undefined ? 'unverified' : check.oneOf('verification', body.verification, HERITAGE_VERIFICATIONS, 'Status provjere')
  const links: IntangibleLinks = {
    areaLinks: parseAreaLinks(check.add, body.areaLinks),
    narrators: parseNarratorLinks(check.add, body.narrators),
    authorIds: parseIdList(check.add, 'authorIds', body.authorIds, INTANGIBLE_MAX.authors, 'Autori'),
    itemIds: parseIdList(check.add, 'itemIds', body.itemIds, INTANGIBLE_MAX.items, 'Zapisi baštine'),
    themeIds: parseIdList(check.add, 'themeIds', body.themeIds, INTANGIBLE_MAX.themes, 'Teme'),
    sourceIds: parseIdList(check.add, 'sourceIds', body.sourceIds, INTANGIBLE_MAX.sources, 'Izvori')
  }
  verifiedNeedsBacking(check.add, verification, links)
  return {
    title,
    slug,
    ...recorded,
    verification,
    researchNotes: check.optional('researchNotes', body.researchNotes, INTANGIBLE_LIMITS.researchNotes, 'Bilješke istraživanja') ?? '',
    noindex: body.noindex === true,
    status: contentStatus(body.status, 'draft', check.add),
    ...links
  }
}

/** Whether `value` holds text once trimmed; for the "published needs a text" rules. */
export function hasText(value: string | null) {
  return value !== null && value.length > 0
}
