import type { ContentEntity, ContentStatus, ContentValidation } from './common'
import { contentStatus, isRecord, issueCollector } from './common'
import { atlasSlug } from '../atlasSlug'
import { checkSlug } from './intangible'

// The editor-managed lists of intangible heritage: the three type lists (story types, custom types, folk text
// types) and the occasions share the shape of the heritage categories; themes have a public page, so a slug and
// a description instead of a key.

export const INTANGIBLE_LIST_LIMITS = { key: 60, labelHr: 100, labelEn: 100, description: 5000 } as const
const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** A type or an occasion: a stable key for code and filters, Croatian and English labels, a sort order. */
export interface KeyedListValue {
  key: string
  labelHr: string
  labelEn: string | null
  sort: number
  status: ContentStatus
}

export type KeyedListEntry = ContentEntity & KeyedListValue
export type StoryType = KeyedListEntry
export type CustomType = KeyedListEntry
export type FolkTextType = KeyedListEntry
export type Occasion = KeyedListEntry

function parseSort(check: ReturnType<typeof issueCollector>, value: unknown) {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    check.add('sort', 'Polje „Redoslijed“ mora biti cijeli broj.')
    return 0
  }
  return value
}

/** `missing` is the message for a payload that is not an object ("Podaci vrste priče nedostaju."). */
function validateKeyedList(input: unknown, missing: string): ContentValidation<KeyedListValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', missing)
  const key = check.required('key', body.key, INTANGIBLE_LIST_LIMITS.key, 'Ključ')
  if (key && !KEY_PATTERN.test(key)) check.add('key', 'Ključ smije sadržavati samo mala slova, brojeve i crtice.')
  const value: KeyedListValue = {
    key,
    labelHr: check.required('labelHr', body.labelHr, INTANGIBLE_LIST_LIMITS.labelHr, 'Naziv (hr)'),
    labelEn: check.optional('labelEn', body.labelEn, INTANGIBLE_LIST_LIMITS.labelEn, 'Naziv (en)'),
    sort: parseSort(check, body.sort),
    status: contentStatus(body.status, 'published', check.add)
  }
  return { value, issues: check.issues }
}

export const validateStoryType = (input: unknown) => validateKeyedList(input, 'Podaci vrste priče nedostaju.')
export const validateCustomType = (input: unknown) => validateKeyedList(input, 'Podaci vrste običaja nedostaju.')
export const validateFolkTextType = (input: unknown) => validateKeyedList(input, 'Podaci vrste usmenog teksta nedostaju.')
export const validateOccasion = (input: unknown) => validateKeyedList(input, 'Podaci prigode nedostaju.')

export interface ThemeValue {
  slug: string
  labelHr: string
  labelEn: string | null
  description: string | null
  sort: number
  status: ContentStatus
}

export type Theme = ContentEntity & ThemeValue

/** Validates and projects a theme for the admin API; the slug comes from the Croatian label when omitted. */
export function validateTheme(input: unknown): ContentValidation<ThemeValue> {
  const check = issueCollector()
  const body = isRecord(input) ? input : {}
  if (!isRecord(input)) check.add('', 'Podaci teme nedostaju.')
  const labelHr = check.required('labelHr', body.labelHr, INTANGIBLE_LIST_LIMITS.labelHr, 'Naziv (hr)')
  const value: ThemeValue = {
    slug: checkSlug(check.add, body.slug, () => (labelHr ? atlasSlug(labelHr) : '')),
    labelHr,
    labelEn: check.optional('labelEn', body.labelEn, INTANGIBLE_LIST_LIMITS.labelEn, 'Naziv (en)'),
    description: check.optional('description', body.description, INTANGIBLE_LIST_LIMITS.description, 'Opis'),
    sort: parseSort(check, body.sort),
    status: contentStatus(body.status, 'published', check.add)
  }
  return { value, issues: check.issues }
}
