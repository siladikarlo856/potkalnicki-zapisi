import type { H3Event } from 'h3'
import { CONTENT_PAGE_SIZES, isUuid } from '../../../shared/utils/content/common'
import type {
  HistoryAction, HistoryKind, HistoryLog, HistoryLogRow, HistoryRestoreResult, HistoryRevision, HistoryRevisions
} from '../../../shared/utils/content/history'
import {
  HISTORY_ACTIONS, HISTORY_ACTOR_PATTERN, HISTORY_REVISIONS_LIMIT, HISTORY_REVISIONS_MAX, diffSnapshots, isHistoryKind
} from '../../../shared/utils/content/history'
import type { AnyContentKindDefinition } from './definition'
import { findContentKind } from './registry'
import {
  conflict, contentDatabaseError, editable, fail, invalid, queryInteger, queryText, readRow, toEntity, toRow
} from './store'

// Change history over `content_revisions`, which the database fills: `content_audit` copies the full
// row on every insert, update and delete (docs/database.md). Reading is generic over every kind that
// is in the audit table; the per-row drawer and restore need the kind's registry definition.
//
// A restore writes the stored version back through the same path as an edit, so the database
// bumps `revision`, the audit trigger records it as a new revision, and nothing is ever rewritten.

type Row = Record<string, unknown>

interface RevisionRow {
  id: number
  revision: number
  action: HistoryAction
  data: Row
  submission_id: number | null
  actor: string
  created_at: string
}

const REVISION_COLUMNS = 'id,revision,action,data,submission_id,actor,created_at'
const LOG_COLUMNS = 'id,entity_kind,entity_id,revision,action,actor,created_at,submission_id,data'
const MAX_PAGE = 10_000
/** Keys that name a row in a snapshot, for kinds without a registry definition. */
const LABEL_KEYS = ['name', 'title', 'label_hr', 'key']

/** The editable API fields of a kind, in its field order, with `status`. */
function historyFields(def: AnyContentKindDefinition) {
  return [...Object.keys(def.fields), 'status']
}

/** A stored snapshot (database columns) as the editable API fields. */
function projected(def: AnyContentKindDefinition, data: Row) {
  return editable(def, toEntity(def, data))
}

function labelOf(def: AnyContentKindDefinition | undefined, data: Row, entityId: string) {
  const keys = def ? [def.labelColumn] : LABEL_KEYS
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  // Words keep their headword inside the JSON entry.
  const entry = data.entry
  if (!def && typeof entry === 'object' && entry !== null) {
    const headword = (entry as Row).headword
    if (typeof headword === 'string' && headword.trim()) return headword
  }
  return entityId
}

function revisionView(def: AnyContentKindDefinition, row: RevisionRow, previous: RevisionRow | undefined): HistoryRevision {
  const fields = historyFields(def)
  const after = projected(def, row.data)
  const changes = row.action === 'insert'
    ? diffSnapshots(null, after, fields)
    : row.action === 'delete'
      ? diffSnapshots(after, null, fields)
      : diffSnapshots(previous ? projected(def, previous.data) : null, after, fields)
  return {
    id: row.id,
    revision: row.revision,
    action: row.action,
    actor: row.actor,
    createdAt: row.created_at,
    submissionId: row.submission_id,
    changes
  }
}

async function newestRevision(def: AnyContentKindDefinition, id: string) {
  const { data, error } = await useDatabaseClient().from('content_revisions').select(REVISION_COLUMNS)
    .eq('entity_kind', def.kind).eq('entity_id', id).order('id', { ascending: false }).limit(1)
  if (error) contentDatabaseError(def, error)
  return ((data ?? []) as unknown as RevisionRow[])[0]
}

/**
 * The newest revisions of one row, each with the fields it changed (compared with the revision
 * before it), 20 at a time: `?limit=` (at most 50) and `?before=<id of the last one listed>`.
 * Works for a deleted row too, which is how a deletion is undone.
 */
export async function listRevisions(event: H3Event, def: AnyContentKindDefinition, id: string): Promise<HistoryRevisions> {
  const query = getQuery(event)
  const limit = queryInteger(query.limit, 'limit', HISTORY_REVISIONS_LIMIT, HISTORY_REVISIONS_MAX)
  const before = queryText(query.before, 'before') ? queryInteger(query.before, 'before', 0, Number.MAX_SAFE_INTEGER) : undefined

  // One extra row says whether there are more, and is the baseline for the oldest row listed.
  let request = useDatabaseClient().from('content_revisions').select(REVISION_COLUMNS)
    .eq('entity_kind', def.kind).eq('entity_id', id)
    .order('id', { ascending: false }).limit(limit + 1)
  if (before) request = request.lt('id', before)
  const { data, error } = await request
  if (error) contentDatabaseError(def, error)
  const rows = (data ?? []) as unknown as RevisionRow[]

  const current = await readRow(def, id)
  const newest = current ? undefined : (before ? await newestRevision(def, id) : rows[0])
  if (!current && !newest) fail(404, 'Not found', { message: 'Zapis nije pronađen.' })

  return {
    kind: def.kind,
    entityId: id,
    label: labelOf(def, current ?? newest!.data, id),
    exists: !!current,
    currentRevision: current ? current.revision as number : null,
    revisions: rows.slice(0, limit).map((row, index) => revisionView(def, row, rows[index + 1])),
    hasMore: rows.length > limit
  }
}

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : undefined
}

function referenceFailure(): never {
  fail(409, 'Referenced', { code: 'referenced', message: 'Verzija se ne može vratiti jer zapis na koji se poziva više ne postoji.' })
}

/**
 * Writes a stored version back: the editable fields and status of `revisionId` become the row's
 * new state (a new revision, attributed to the admin). Needs `revision`, the revision the screen
 * saw, so a stale screen gets the usual 409. A deleted row is recreated under its old id and
 * creation time; a row that is already in that state is left alone.
 */
export async function restoreRevision(event: H3Event, def: AnyContentKindDefinition, id: string): Promise<HistoryRestoreResult> {
  const body = await readJsonObject(event, 1024)
  const revisionId = positiveInteger(body.revisionId)
  if (!revisionId) invalid([{ path: 'revisionId', message: 'Nedostaje verzija koju treba vratiti.' }], 'Nedostaje verzija koju treba vratiti.')

  const db = useDatabaseClient()
  const { data, error } = await db.from('content_revisions').select(REVISION_COLUMNS)
    .eq('id', revisionId).eq('entity_kind', def.kind).eq('entity_id', id).maybeSingle()
  if (error) contentDatabaseError(def, error)
  const target = data as unknown as RevisionRow | null
  if (!target) fail(404, 'Not found', { message: 'Verzija nije pronađena.' })

  const current = await readRow(def, id)
  // Fields the kind keeps on a restore (e.g. which challenge template is current) stay as they are now.
  const now = current ? projected(def, current) : {}
  const kept = Object.fromEntries((def.restoreKeeps ?? []).filter(field => field in now).map(field => [field, now[field]]))
  // The stored version must still satisfy today's rules; the validator also normalizes it.
  const { value, issues } = def.validate({ ...projected(def, target.data), ...kept })
  if (issues.length) invalid(issues, 'Ta se verzija ne može vratiti jer više ne zadovoljava pravila uređivanja.')

  if (current) {
    const expected = positiveInteger(body.revision)
    if (!expected) invalid([{ path: '', message: 'Nedostaje revizija zapisa; učitaj ga ponovno.' }], 'Nedostaje revizija zapisa.')
    if (current.revision !== expected) conflict(def, current)
    if (!diffSnapshots(projected(def, current), value, historyFields(def)).length) {
      return { unchanged: true, recreated: false, entity: toEntity(def, current) }
    }
    const { data: saved, error: updateError } = await db.from(def.table).update(toRow(def, value))
      .eq('id', id).eq('revision', expected).select('*')
    if (updateError) {
      if (updateError.code === '23503') referenceFailure()
      contentDatabaseError(def, updateError)
    }
    const rows = (saved ?? []) as Row[]
    // Someone saved between the read and the write.
    if (!rows.length) conflict(def, (await readRow(def, id)) ?? fail(404, 'Not found', { message: 'Zapis nije pronađen.' }))
    await def.afterWrite?.(event)
    return { unchanged: false, recreated: false, entity: toEntity(def, rows[0]!) }
  }

  // The row is gone: bring it back under its old id, continuing the revision count and keeping its creation time.
  const newest = await newestRevision(def, id)
  const { data: created, error: insertError } = await db.from(def.table)
    .insert({ ...toRow(def, value), id, revision: (newest?.revision ?? target.revision) + 1, created_at: target.data.created_at })
    .select('*').single()
  if (insertError) {
    if (insertError.code === '23503') referenceFailure()
    contentDatabaseError(def, insertError)
  }
  await def.afterWrite?.(event)
  return { unchanged: false, recreated: true, entity: toEntity(def, created as Row) }
}

function logError(error: { code?: string, message: string }): never {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    console.error('[content] content_revisions is missing; apply the content migrations.')
    fail(503, 'Content tables are not migrated', { code: 'not-migrated', message: 'Tablice sadržaja još nisu postavljene u bazi.' })
  }
  databaseError(error)
}

/**
 * The change log across all kinds, newest first: `?kind=`, `?action=`, `?actor=`, `?entity=<uuid>`,
 * `?page=` and `?size=` (25, 50 or 100). Imported rows and kinds without an admin resource yet are
 * listed too; only registered kinds can be opened and restored.
 */
export async function listHistoryLog(event: H3Event): Promise<HistoryLog> {
  const query = getQuery(event)
  const page = queryInteger(query.page, 'page', 1, MAX_PAGE)
  const size = queryInteger(query.size, 'size', CONTENT_PAGE_SIZES[0], Math.max(...CONTENT_PAGE_SIZES))
  if (!(CONTENT_PAGE_SIZES as readonly number[]).includes(size)) fail(400, 'Invalid size', { message: 'Parametar size nije ispravan.' })

  const kind = queryText(query.kind, 'kind')
  const action = queryText(query.action, 'action')
  const actor = queryText(query.actor, 'actor')
  const entity = queryText(query.entity, 'entity')
  if (kind && !isHistoryKind(kind)) fail(400, 'Invalid kind', { message: 'Parametar kind nije ispravan.' })
  if (action && !(HISTORY_ACTIONS as readonly string[]).includes(action)) fail(400, 'Invalid action', { message: 'Parametar action nije ispravan.' })
  if (actor && !HISTORY_ACTOR_PATTERN.test(actor)) fail(400, 'Invalid actor', { message: 'Parametar actor nije ispravan.' })
  if (entity && !isUuid(entity)) fail(400, 'Invalid entity', { message: 'Parametar entity nije ispravan.' })

  const filtered = (head: boolean) => {
    let request = useDatabaseClient().from('content_revisions').select(head ? 'id' : LOG_COLUMNS, { count: 'exact', head })
    if (kind) request = request.eq('entity_kind', kind)
    if (action) request = request.eq('action', action)
    if (actor) request = request.eq('actor', actor)
    if (entity) request = request.eq('entity_id', entity.toLowerCase())
    return request
  }

  const from = (page - 1) * size
  const { data, count, error } = await filtered(false).order('id', { ascending: false }).range(from, from + size - 1)
  if (error?.code === 'PGRST103') {
    // PostgREST refuses a range past the last row; answer an empty page with the real total.
    const counted = await filtered(true)
    if (counted.error) logError(counted.error)
    return { rows: [], total: counted.count ?? 0, page, size }
  }
  if (error) logError(error)

  const rows = ((data ?? []) as unknown as Array<RevisionRow & { entity_kind: HistoryKind, entity_id: string }>).map((row): HistoryLogRow => {
    const def = findContentKind(row.entity_kind)
    return {
      id: row.id,
      kind: row.entity_kind,
      entityId: row.entity_id,
      revision: row.revision,
      action: row.action,
      actor: row.actor,
      createdAt: row.created_at,
      submissionId: row.submission_id,
      label: labelOf(def, row.data, row.entity_id),
      registered: !!def
    }
  })
  return { rows, total: count ?? 0, page, size }
}
