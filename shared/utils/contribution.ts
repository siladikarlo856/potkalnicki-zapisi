// Corrections and proposals ("predloži ispravak", "predloži novi zapis"): which content kinds accept which,
// the whitelisted payload fields per kind, and the pure helpers the form, the API and the admin inbox share.
// Nothing here reaches public content: an admin applies an approved correction through the target's own
// edit dialog, or opens a draft from a proposal (docs/database.md, "Corrections and proposals inbox").

export const CONTRIBUTION_KINDS = ['word', 'heritage_item', 'area', 'source', 'person', 'club'] as const
export type ContributionKind = typeof CONTRIBUTION_KINDS[number]
export const CONTRIBUTION_MODES = ['correction', 'proposal'] as const
export type ContributionMode = typeof CONTRIBUTION_MODES[number]

export function isContributionKind(value: unknown): value is ContributionKind {
  return (CONTRIBUTION_KINDS as readonly unknown[]).includes(value)
}

/**
 * Who may submit what: words, heritage items and settlements take corrections and proposals, sources
 * take proposals only. Everything else (countries, counties, regions, categories, challenge sets) is
 * admin-only, because it has no entry here.
 */
export const CONTRIBUTION_ALLOWED: Record<ContributionKind, readonly ContributionMode[]> = {
  word: ['correction', 'proposal'],
  heritage_item: ['correction', 'proposal'],
  area: ['correction', 'proposal'],
  source: ['proposal'],
  person: ['correction', 'proposal'],
  club: ['correction']
}

export const CONTRIBUTION_KIND_LABELS: Record<ContributionKind, string> = {
  word: 'Riječ',
  heritage_item: 'Zapis baštine',
  area: 'Naselje',
  source: 'Izvor',
  person: 'Osoba',
  club: 'Klub'
}

/** The admin page whose dialogs edit each kind; the inbox deep-links there. */
export const CONTRIBUTION_ADMIN_PATHS: Record<ContributionKind, string> = {
  word: '/admin/rijeci',
  heritage_item: '/admin/bastina',
  area: '/admin/mjesta',
  source: '/admin/izvori',
  person: '/admin/osobe',
  club: '/admin/klubovi'
}

export const SOURCE_PROPOSAL_TYPES = [
  'official_registry', 'conservation_study', 'conservation_document', 'planning_document',
  'development_document', 'municipal_source', 'publication', 'dictionary', 'interview', 'website', 'other'
] as const

export type FieldType = 'text' | 'long' | 'uuid' | 'geonames' | 'url' | 'sourceType'

export interface ContributionField {
  key: string
  label: string
  type: FieldType
  max: number
  required?: boolean
  /** True when applying a correction changes the entity's own field; false for context kept in the inbox only. */
  apply?: boolean
}

const text = (key: string, label: string, max: number, extra: Partial<ContributionField> = {}): ContributionField => ({ key, label, type: 'text', max, ...extra })
const long = (key: string, label: string, max: number, extra: Partial<ContributionField> = {}): ContributionField => ({ key, label, type: 'long', max, ...extra })
const uuid = (key: string, label: string, extra: Partial<ContributionField> = {}): ContributionField => ({ key, label, type: 'uuid', max: 36, ...extra })
const place = (key: string, label: string): ContributionField => ({ key, label, type: 'geonames', max: 20 })

export const CONTRIBUTION_FIELDS: { [K in ContributionKind]: { [M in ContributionMode]?: ContributionField[] } } = {
  heritage_item: {
    correction: [
      text('name', 'Naziv', 200, { apply: true }),
      uuid('categoryId', 'Kategorija', { apply: true }),
      uuid('settlementId', 'Naselje', { apply: true }),
      text('locality', 'Lokalitet', 200, { apply: true }),
      text('period', 'Razdoblje', 200, { apply: true }),
      long('description', 'Opis', 2000, { apply: true }),
      text('locationHint', 'Smještaj', 500),
      text('sourceNote', 'Izvor ili literatura', 500)
    ],
    proposal: [
      text('name', 'Naziv', 200, { required: true }),
      uuid('categoryId', 'Kategorija', { required: true }),
      uuid('settlementId', 'Naselje'),
      uuid('municipalityId', 'Grad ili općina'),
      text('locality', 'Lokalitet', 200),
      long('description', 'Opis', 2000),
      text('sourceNote', 'Izvor ili literatura', 500)
    ]
  },
  word: {
    correction: [
      text('meaningHr', 'Značenje (hr)', 500),
      text('meaningEn', 'Značenje (en)', 500),
      text('partOfSpeech', 'Vrsta riječi', 100),
      text('example', 'Primjer', 500),
      text('variantForm', 'Nova inačica', 200),
      place('variantPlaceId', 'Mjesto inačice')
    ],
    proposal: [
      text('headword', 'Riječ', 200, { required: true }),
      text('meaningHr', 'Značenje (hr)', 500),
      text('example', 'Primjer', 500),
      place('placeId', 'Mjesto')
    ]
  },
  area: {
    correction: [
      text('name', 'Naziv naselja', 200, { apply: true }),
      text('localNames', 'Mjesni nazivi', 500),
      text('locationHint', 'Smještaj', 500)
    ],
    proposal: [
      text('name', 'Naziv naselja ili mjesta', 200, { required: true }),
      uuid('parentId', 'Grad ili općina', { required: true }),
      text('localNames', 'Mjesni nazivi', 500),
      text('locationHint', 'Smještaj', 500)
    ]
  },
  source: {
    proposal: [
      text('title', 'Naslov', 500, { required: true }),
      { key: 'type', label: 'Vrsta', type: 'sourceType', max: 40 },
      text('author', 'Autor', 200),
      text('year', 'Godina', 20),
      { key: 'url', label: 'Poveznica', type: 'url', max: 1000 },
      long('note', 'Napomena', 1000)
    ]
  },
  person: {
    correction: [
      text('name', 'Ime', 200, { apply: true }),
      text('born', 'Rođen/a', 60, { apply: true }),
      text('died', 'Umro/la', 60, { apply: true }),
      text('role', 'Uloga', 200, { apply: true }),
      long('bio', 'Biografija', 2000, { apply: true }),
      { key: 'sourceUrl', label: 'Izvor (URL)', type: 'url', max: 1000 }
    ],
    proposal: [
      text('name', 'Ime', 200, { required: true }),
      text('born', 'Rođen/a', 60, { required: true }),
      text('died', 'Umro/la', 60, { required: true }),
      uuid('settlementId', 'Mjesto u našem kraju', { required: true }),
      long('significance', 'Zašto je važna', 2000, { required: true }),
      { key: 'sourceUrl', label: 'Izvor (URL)', type: 'url', max: 1000, required: true }
    ]
  },
  club: {
    correction: [
      text('name', 'Ime', 200, { apply: true }),
      text('sport', 'Sport', 80, { apply: true }),
      text('competition', 'Liga (sezona)', 200, { apply: true }),
      { key: 'sourceUrl', label: 'Izvor (URL)', type: 'url', max: 1000 }
    ]
  }
}

export function contributionFields(kind: ContributionKind, mode: ContributionMode) {
  return CONTRIBUTION_FIELDS[kind][mode] ?? []
}

export type ContributionPayload = Record<string, string>

export type PayloadIssueCode = 'required' | 'tooLong' | 'invalid' | 'unknown' | 'links'
export interface PayloadIssue {
  path: string
  code: PayloadIssueCode
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GEONAMES_PATTERN = /^geonames:[0-9]{1,10}$/
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi
/** At most this many links in a submission's free text and payload together; none at all in word fields. */
export const CONTRIBUTION_LINK_LIMIT = 2

export function countLinks(value: string) {
  return value.match(URL_PATTERN)?.length ?? 0
}

/** Every string value of a payload plus the free text, joined, so a link cap covers all of it. */
export function totalLinks(note: string, payload: ContributionPayload | null) {
  return countLinks(note) + Object.values(payload ?? {}).reduce((sum, value) => sum + countLinks(value), 0)
}

/** A source proposal's own url field is a link by design, so it counts towards the cap like any other. */
function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validates and projects a payload against the whitelist of its kind and mode. Unknown keys are refused
 * (never copied), strings are trimmed, empty values are dropped, and the shape rules of each kind hold:
 * a correction changes something, a proposal has its required fields, a word variant comes with its
 * place, an item proposal names its settlement or municipality.
 */
export function validateContributionPayload(kind: ContributionKind, mode: ContributionMode, input: unknown) {
  const issues: PayloadIssue[] = []
  const value: ContributionPayload = {}
  const fields = contributionFields(kind, mode)
  if (!fields.length) return { value, issues: [{ path: '', code: 'invalid' } as PayloadIssue] }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { value, issues: [{ path: '', code: 'invalid' } as PayloadIssue] }
  const body = input as Record<string, unknown>

  for (const key of Object.keys(body)) {
    if (!fields.some(field => field.key === key)) issues.push({ path: key, code: 'unknown' })
  }
  for (const field of fields) {
    const raw = body[field.key]
    if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
      if (field.required) issues.push({ path: field.key, code: 'required' })
      continue
    }
    if (typeof raw !== 'string') {
      issues.push({ path: field.key, code: 'invalid' })
      continue
    }
    const trimmed = raw.trim()
    if (trimmed.length > field.max) {
      issues.push({ path: field.key, code: 'tooLong' })
      continue
    }
    if (field.type === 'uuid' && !UUID_PATTERN.test(trimmed)) issues.push({ path: field.key, code: 'invalid' })
    else if (field.type === 'geonames' && !GEONAMES_PATTERN.test(trimmed)) issues.push({ path: field.key, code: 'invalid' })
    else if (field.type === 'url' && !isHttpUrl(trimmed)) issues.push({ path: field.key, code: 'invalid' })
    else if (field.type === 'sourceType' && !(SOURCE_PROPOSAL_TYPES as readonly string[]).includes(trimmed)) issues.push({ path: field.key, code: 'invalid' })
    else value[field.key] = field.type === 'uuid' ? trimmed.toLowerCase() : trimmed
  }

  if (mode === 'correction' && !issues.length && !Object.keys(value).length) issues.push({ path: '', code: 'required' })
  if (kind === 'word' && mode === 'correction' && !!value.variantForm !== !!value.variantPlaceId) {
    issues.push({ path: value.variantForm ? 'variantPlaceId' : 'variantForm', code: 'required' })
  }
  if (kind === 'heritage_item' && mode === 'proposal' && !value.settlementId && !value.municipalityId && !issues.some(issue => issue.path === 'settlementId')) {
    issues.push({ path: 'settlementId', code: 'required' })
  }
  if (kind === 'person' && mode === 'proposal' && !value.settlementId && !issues.some(issue => issue.path === 'settlementId')) {
    issues.push({ path: 'settlementId', code: 'required' })
  }
  // Word fields are plain dictionary text, so a link there is never legitimate.
  if (kind === 'word' && Object.values(value).some(entry => countLinks(entry) > 0)) issues.push({ path: '', code: 'links' })
  if (totalLinks('', value) > CONTRIBUTION_LINK_LIMIT) issues.push({ path: '', code: 'links' })
  return { value, issues }
}

/** What the inbox shows for one changed field: the label and both values, ready for a diff. */
export interface ContributionChange {
  field: string
  label: string
  current: string | null
  proposed: string
  /** False for context that applying does not write (e.g. a source note). */
  applicable: boolean
}

interface WordEntryShape {
  meaning?: Record<string, unknown>
  partOfSpeech?: unknown
  examples?: unknown
  variants?: unknown
  [key: string]: unknown
}

/**
 * The word entry with a correction's changes made: meaning, part of speech, one more example and one
 * more variant (with a reported usage in the area of its place, when that area is known). The admin still
 * reviews and saves it in the word editor; this only prepares the form.
 */
export function applyWordCorrection<E extends WordEntryShape>(entry: E, payload: ContributionPayload, variantAreaId: string | null, newId: () => string): E {
  const next: WordEntryShape = { ...entry, meaning: { ...(entry.meaning ?? {}) } }
  if (payload.meaningHr) next.meaning!.hr = payload.meaningHr
  if (payload.meaningEn) next.meaning!.en = payload.meaningEn
  if (payload.partOfSpeech) next.partOfSpeech = payload.partOfSpeech
  if (payload.example) next.examples = [...(Array.isArray(entry.examples) ? entry.examples : []), { text: payload.example }]
  if (payload.variantForm) {
    next.variants = [...(Array.isArray(entry.variants) ? entry.variants : []), {
      id: newId(), form: payload.variantForm, status: 'community',
      usages: variantAreaId ? [{ areaId: variantAreaId, confidence: 'reported' }] : []
    }]
  }
  return next as E
}
