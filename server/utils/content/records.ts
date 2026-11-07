import type { ContentKind } from '../../../shared/utils/content/common'
import { isUuid } from '../../../shared/utils/content/common'
import { suggestContentSlug } from './areaLookup'
import { contentKind } from './registry'
import type { ContentEntityRecord } from './store'
import {
  columnsOf, contentAfterWrite, contentDatabaseError, editable, invalid, persistValue, selectList, toEntity, toRow, validateInput, whereStatus
} from './store'

// Content as the rest of the server sees it, by kind: what is Published, what a row is called, and Drafts made
// from Proposals. Callers (Contributions, the inbox) name a kind and API fields; which table, which columns and
// what Published means for that kind (a word is active and not archived) stay in its registry definition.

type Row = Record<string, unknown>

/** An entity with its plain name, for messages and lists. */
export type ContentRecord = ContentEntityRecord & { label: string }

/** API field → the value it must have (an array: one of these). */
export type ContentMatch = Record<string, string | number | boolean | readonly string[]>

const CHUNK = 100

function labelOf(def: ReturnType<typeof contentKind>, row: Row) {
  return def.title?.(row) ?? String(row[def.labelColumn] ?? '')
}

function toRecord(def: ReturnType<typeof contentKind>, row: Row): ContentRecord {
  return { ...toEntity(def, row), label: labelOf(def, row) }
}

function columnOf(def: ReturnType<typeof contentKind>, field: string) {
  const column = (columnsOf(def) as Record<string, string>)[field]
  if (!column) throw new Error(`[content] ${def.kind} has no field ${field}.`)
  return column
}

/** The UUID behind a key: the key itself, or the row an old id (content_legacy_ids) names; null when there is none. */
async function entityId(kind: ContentKind, key: string) {
  const id = key.toLowerCase()
  if (isUuid(id)) return id
  const { data, error } = await useDatabaseClient().from('content_legacy_ids').select('entity_id').eq('kind', kind).eq('legacy_id', key).maybeSingle()
  if (error) contentDatabaseError(contentKind(kind), error)
  return data ? String(data.entity_id) : null
}

/**
 * The Published row of a kind, in that kind's own notion of Published, or null. `key` is its UUID (or an old
 * id, for kinds that had one), or fields it must match (`{ id, kind: 'settlement' }`, `{ geonamesId }`).
 */
export async function findPublished(kind: ContentKind, key: string | ContentMatch): Promise<ContentRecord | null> {
  const def = contentKind(kind)
  const match: ContentMatch = { ...(typeof key === 'string' ? { id: key } : key) }
  if (typeof match.id === 'string') {
    const id = await entityId(kind, match.id)
    if (!id) return null
    match.id = id
  }
  let request = useDatabaseClient().from(def.table).select(selectList(def))
  for (const [field, value] of Object.entries(match)) {
    request = Array.isArray(value) ? request.in(columnOf(def, field), [...value]) : request.eq(columnOf(def, field), value)
  }
  const { data, error } = await whereStatus(def, request, 'published').limit(1)
  if (error) contentDatabaseError(def, error)
  const row = (data as unknown as Row[] | null)?.[0]
  return row ? toRecord(def, row) : null
}

/** True when every id names a Published row of the kind that also matches `match`. */
export async function allPublished(kind: ContentKind, ids: readonly string[], match: ContentMatch = {}) {
  for (const id of new Set(ids)) {
    if (!await findPublished(kind, { ...match, id })) return false
  }
  return true
}

async function readWhere(kind: ContentKind, column: string, values: readonly (string | number)[], extraColumns = '') {
  const def = contentKind(kind)
  const rows: Row[] = []
  const unique = [...new Set(values)]
  for (let from = 0; from < unique.length; from += CHUNK) {
    const { data, error } = await useDatabaseClient().from(def.table).select(selectList(def) + extraColumns).in(column, unique.slice(from, from + CHUNK))
    if (error) contentDatabaseError(def, error)
    rows.push(...(data as unknown as Row[]))
  }
  return rows
}

/** Rows of a kind by id, whatever their status (an unknown id is left out). */
export async function readContent(kind: ContentKind, ids: readonly string[]): Promise<ContentRecord[]> {
  const def = contentKind(kind)
  return (await readWhere(kind, 'id', ids)).map(row => toRecord(def, row))
}

/** The rows made from these Contributions (Drafts of Proposals, whatever their status now), by submission id. */
export async function createdFrom(kind: ContentKind, submissionIds: readonly number[]): Promise<Map<number, ContentRecord>> {
  const def = contentKind(kind)
  const found = new Map<number, ContentRecord>()
  if (!def.createdFrom || !submissionIds.length) return found
  for (const row of await readWhere(kind, def.createdFrom, submissionIds, `,${def.createdFrom}`)) {
    found.set(Number(row[def.createdFrom]), toRecord(def, row))
  }
  return found
}

/** A slug for a new row of the kind that no row has yet (for a heritage item: within its settlement). */
export function suggestSlug(kind: ContentKind, base: string, scopeId: string | null) {
  return suggestContentSlug(useDatabaseClient(), contentKind(kind).table, base, scopeId)
}

/**
 * Saves `value` (API fields) as a new Draft made from the Contribution `submissionId`, through the kind's own
 * validate → persist, exactly like an admin create: a value that breaks a rule is refused (400 with issues) and
 * nothing is written. Idempotent per Contribution: when a row was already made from it, that row is returned
 * with `created: false`, also when a concurrent call made it first. `origin` fills the kind's `createdFromFields`.
 */
export async function createDraft(kind: ContentKind, value: Row, { submissionId, origin = {} }: { submissionId: number, origin?: Row }) {
  const def = contentKind(kind)
  if (!def.createdFrom) throw new Error(`[content] ${kind} takes no Draft from a Proposal.`)
  const originRow: Row = {}
  for (const [field, fieldValue] of Object.entries(origin)) {
    const column = def.createdFromFields?.[field]
    if (!column) throw new Error(`[content] ${kind} records no ${field} from a Contribution.`)
    originRow[column] = fieldValue
  }
  const existing = async () => (await createdFrom(kind, [submissionId])).get(submissionId)?.id ?? null
  const prior = await existing()
  if (prior) return { id: prior, created: false }

  const { value: valid, issues } = await validateInput(def, editable(def, { ...value, status: 'draft' }))
  if (issues.length) invalid(issues)
  const row = { ...toRow(def, valid), ...originRow, [def.createdFrom]: submissionId }
  if (def.adapter?.createId) row.id = def.adapter.createId(valid)
  let id: string | null
  try {
    id = await persistValue(def, null, valid as Row, { row })
  } catch (error) {
    // The unique link: a concurrent call made the Draft first.
    const again = (error as { statusCode?: number }).statusCode === 409 ? await existing() : null
    if (again) return { id: again, created: false }
    throw error
  }
  contentAfterWrite()
  return { id: id!, created: true }
}
