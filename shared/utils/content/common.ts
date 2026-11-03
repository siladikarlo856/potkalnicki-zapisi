// Shared vocabulary of the content admin (CMS) kit: kinds, statuses, the API shapes and the small
// helpers every per-kind validator builds on. The browser dialog and the server use the same
// validators, so a form never accepts what the API would refuse.

/**
 * Entity kinds, named as in the database (`content_revisions.entity_kind`, `content_legacy_ids.kind`
 * and, later, `heritage_submissions.target_kind`), so one name follows a row everywhere.
 * A kind is added here when its admin resource is built.
 */
export const CONTENT_KINDS = ['source', 'challenge_template'] as const
export type ContentKind = typeof CONTENT_KINDS[number]

export function isContentKind(value: unknown): value is ContentKind {
  return (CONTENT_KINDS as readonly unknown[]).includes(value)
}

/** Publication state: only `published` is public; `archived` hides a row but keeps its references. */
export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const
export type ContentStatus = typeof CONTENT_STATUSES[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Skica',
  published: 'Objavljeno',
  archived: 'Arhivirano'
}

/** Body cap for admin content writes (words, which are larger, keep their own 128 KiB cap). */
export const CONTENT_BODY_LIMIT = 64 * 1024
export const CONTENT_PAGE_SIZES = [25, 50, 100] as const
export const CONTENT_SEARCH_MAX = 100
export const CONTENT_LOOKUP_LIMIT = 20

/** Columns every content table has, in their API (camelCase) form. */
export interface ContentEntity {
  id: string
  status: ContentStatus
  revision: number
  createdAt: string
  updatedAt: string
}

/** One validation problem: `path` is the field name the form shows it under ('' for the whole form). */
export interface ContentIssue {
  path: string
  message: string
}

export interface ContentValidation<T> {
  value: T
  issues: ContentIssue[]
}

export interface ContentList<T> {
  rows: T[]
  total: number
  page: number
  size: number
}

export interface ContentReferenceGroup {
  kind: string
  /** Croatian label for the referencing kind, e.g. "Zapisi baštine". */
  label: string
  count: number
  /** A blocking group prevents a hard delete (a foreign key with `on delete restrict`). */
  blocking: boolean
  /** Up to five examples. */
  items: Array<{ id: string, label: string, to?: string }>
}

export interface ContentReferences {
  blocking: boolean
  groups: ContentReferenceGroup[]
}

export interface ContentLookupItem {
  id: string
  label: string
  status: ContentStatus
}

/** The `data` of an error response from the admin content API. */
export interface ContentErrorData {
  code?: 'invalid' | 'revision-conflict' | 'duplicate' | 'referenced' | 'not-migrated'
  /** Croatian text for the admin screen. */
  message?: string
  issues?: ContentIssue[]
  /** On a revision conflict: the row as it is now. */
  current?: Record<string, unknown>
  references?: ContentReferences
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/**
 * Accent folding for search, identical to the database's `content_fold` (čćđšž → ccdsz, lowercased),
 * so a query is folded the same way as the `search_text` column it is matched against.
 */
export function contentFold(value: string) {
  return value
    .replace(/[ČĆĐŠŽčćđšž]/g, char => ({ Č: 'C', Ć: 'C', Đ: 'D', Š: 'S', Ž: 'Z', č: 'c', ć: 'c', đ: 'd', š: 's', ž: 'z' })[char]!)
    .toLowerCase()
}

/** A small builder for hand-rolled validators, in the style of `validateWord`. */
export function issueCollector() {
  const issues: ContentIssue[] = []
  const add = (path: string, message: string) => {
    issues.push({ path, message })
  }
  /** Optional text: trimmed; empty becomes null. */
  const optional = (path: string, value: unknown, max: number, label: string) => {
    if (value === undefined || value === null) return null
    if (typeof value !== 'string') {
      add(path, `Polje „${label}“ mora biti tekst.`)
      return null
    }
    const text = value.trim()
    if (text.length > max) add(path, `Polje „${label}“ može imati najviše ${max} znakova.`)
    return text || null
  }
  return {
    issues,
    add,
    optional,
    /** Required text: trimmed, 1..max characters. */
    required(path: string, value: unknown, max: number, label: string) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        add(path, `Polje „${label}“ mora biti tekst.`)
        return ''
      }
      const text = typeof value === 'string' ? value.trim() : ''
      if (!text) add(path, `Polje „${label}“ je obavezno.`)
      else if (text.length > max) add(path, `Polje „${label}“ može imati najviše ${max} znakova.`)
      return text
    },
    /** Optional http(s) URL without whitespace. */
    url(path: string, value: unknown, max: number, label: string) {
      const text = optional(path, value, max, label)
      if (text && !/^https?:\/\/\S+$/.test(text)) add(path, `Polje „${label}“ mora počinjati s http:// ili https:// i ne smije sadržavati razmake.`)
      return text
    },
    /** One of a fixed list of values. */
    oneOf<T extends string>(path: string, value: unknown, allowed: readonly T[], label: string): T {
      if ((allowed as readonly unknown[]).includes(value)) return value as T
      add(path, value === undefined || value === null || value === '' ? `Polje „${label}“ je obavezno.` : `Vrijednost polja „${label}“ nije dopuštena.`)
      return '' as T
    }
  }
}

/** Status shared by every kind; a missing status is the given default. */
export function contentStatus(value: unknown, fallback: ContentStatus, add: (path: string, message: string) => void): ContentStatus {
  if (value === undefined) return fallback
  if ((CONTENT_STATUSES as readonly unknown[]).includes(value)) return value as ContentStatus
  add('status', 'Vrijednost polja „Status“ nije dopuštena.')
  return fallback
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
