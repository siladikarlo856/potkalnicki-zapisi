import type { H3Event } from 'h3'
import type { ContentErrorData, ContentIssue, ContentList, ContentLookupItem, ContentReferences, ContentStatus } from '../../../shared/utils/content/common'
import {
  CONTENT_BODY_LIMIT, CONTENT_LOOKUP_LIMIT, CONTENT_PAGE_SIZES, CONTENT_SEARCH_MAX, CONTENT_STATUSES, contentFold, isUuid
} from '../../../shared/utils/content/common'
import type { AnyContentKindDefinition, ContentFilter } from './definition'

// Generic admin operations over one registry definition. The database owns the invariants:
// `revision`, `updated_at` and `search_text` are set by the `content_before_write` trigger, every
// write is recorded in `content_revisions` by `content_audit`, and foreign keys restrict deletes.
// This module validates input, uses `revision` for optimistic concurrency and maps database errors
// to responses the admin dialogs understand.

type Row = Record<string, unknown>
export type ContentEntityRecord = Record<string, unknown> & { id: string, status: ContentStatus, revision: number }

const COMMON_COLUMNS = { id: 'id', status: 'status', revision: 'revision', createdAt: 'created_at', updatedAt: 'updated_at' } as const
/** Sorts every kind accepts, on top of its own. */
const COMMON_SORTS = { status: 'status', updatedAt: 'updated_at', createdAt: 'created_at' } as const
const MAX_PAGE = 10_000
const MAX_LOOKUP_IDS = 50

export function fail(statusCode: number, statusMessage: string, data: ContentErrorData = {}): never {
  throw createError({ statusCode, statusMessage, data })
}

export function invalid(issues: ContentIssue[], message = 'Provjeri označena polja.'): never {
  fail(400, 'Invalid content', { code: 'invalid', message, issues })
}

function columnsOf(def: AnyContentKindDefinition) {
  return def.adapter?.columns ?? { ...COMMON_COLUMNS, ...def.fields }
}

export function selectList(def: AnyContentKindDefinition) {
  const columns = columnsOf(def)
  const dbColumns = new Set(Object.values(columns))
  if (def.adapter) {
    dbColumns.add('active')
    dbColumns.add('archived_at')
  }
  return [...dbColumns].join(',')
}

export function toEntity(def: AnyContentKindDefinition, row: Row): ContentEntityRecord {
  if (def.adapter) return def.adapter.toEntity(row) as ContentEntityRecord
  const entity = Object.fromEntries(Object.entries(columnsOf(def)).map(([field, column]) => [field, row[column] ?? null])) as ContentEntityRecord
  if (def.toEntityExtra) Object.assign(entity, def.toEntityExtra(row))
  return entity
}

export function toRow(def: AnyContentKindDefinition, value: Row) {
  if (def.adapter) return def.adapter.toRow(value)
  const row: Row = { status: value.status }
  for (const [field, column] of Object.entries(def.fields as Record<string, string>)) row[column] = value[field]
  return row
}

/** Only the editable fields and `status`: ids, revisions and timestamps are never taken from a client. */
export function editable(def: AnyContentKindDefinition, source: Row) {
  const keys = [...Object.keys(def.fields), ...(def.inputFields ?? []), 'status']
  return Object.fromEntries(keys.filter(key => key in source).map(key => [key, source[key]]))
}

/** The kind's validator, after its derived fields have been filled from the database. */
export async function validateInput(def: AnyContentKindDefinition, input: Row, id?: string) {
  return def.validate(def.prepareInput ? await def.prepareInput(useDatabaseClient(), input) : input, id)
}

export function conflict(def: AnyContentKindDefinition, current: Row): never {
  fail(409, 'Revision conflict', {
    code: 'revision-conflict',
    message: 'Netko je u međuvremenu spremio ovaj zapis. Učitaj najnoviju verziju ili prepiši svojom.',
    current: toEntity(def, current)
  })
}

/** Maps a PostgREST/Postgres error to a response; anything unexpected is a logged 500. */
export function contentDatabaseError(def: AnyContentKindDefinition, error: { code?: string, message: string, details?: string | null }): never {
  const text = `${error.message} ${error.details ?? ''}`
  switch (error.code) {
    case '23505': {
      const constraint = /constraint "([^"]+)"/.exec(text)?.[1] ?? ''
      const path = def.uniqueConstraints?.[constraint] ?? ''
      return fail(409, 'Duplicate', { code: 'duplicate', message: 'Zapis s tom vrijednošću već postoji.', issues: [{ path, message: 'Ta vrijednost već postoji.' }] })
    }
    // A foreign key: the row is referenced, or points at a row that no longer exists.
    case '23503':
      return fail(409, 'Referenced', { code: 'referenced', message: 'Zapis je povezan s drugim zapisima, pa se ne može obrisati ni spremiti tako.' })
    case '23514':
    case '23502':
    case '22P02':
      return fail(400, 'Invalid content', { code: 'invalid', message: 'Podaci ne zadovoljavaju pravila baze podataka.' })
    // A trigger's `raise exception` explains itself (for example a settlement outside its municipality).
    case 'P0001':
      return fail(400, 'Invalid content', { code: 'invalid', message: error.message })
    case '42P01':
    case 'PGRST205':
      console.error(`[content] Table for ${def.kind} is missing; apply the content migrations.`)
      return fail(503, 'Content tables are not migrated', { code: 'not-migrated', message: 'Tablice sadržaja još nisu postavljene u bazi.' })
  }
  databaseError(error)
}

export function contentIdParam(event: H3Event) {
  const id = getRouterParam(event, 'id')
  if (!isUuid(id)) fail(404, 'Not found', { message: 'Zapis nije pronađen.' })
  return id.toLowerCase()
}

export async function readRow(def: AnyContentKindDefinition, id: string) {
  const { data, error } = await useDatabaseClient().from(def.table).select(selectList(def)).eq('id', id).maybeSingle()
  if (error) contentDatabaseError(def, error)
  return data as Row | null
}

async function requireRow(def: AnyContentKindDefinition, id: string) {
  const row = await readRow(def, id)
  if (!row) fail(404, 'Not found', { message: 'Zapis nije pronađen.' })
  return row
}

export function queryText(value: unknown, name: string) {
  if (value === undefined) return ''
  if (typeof value !== 'string') fail(400, `Invalid ${name}`, { message: `Parametar ${name} nije ispravan.` })
  return value
}

export function queryInteger(value: unknown, name: string, fallback: number, max: number) {
  const text = queryText(value, name)
  if (!text) return fallback
  const number = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 1 || number > max) fail(400, `Invalid ${name}`, { message: `Parametar ${name} nije ispravan.` })
  return number
}

/** An `ilike` pattern for the folded search text; LIKE wildcards in the query are matched literally. */
function searchPattern(value: string) {
  const folded = contentFold(value.trim()).replace(/\*/g, '').replace(/[\\%_]/g, char => `\\${char}`)
  return `%${folded}%`
}

export async function listContent(event: H3Event, def: AnyContentKindDefinition): Promise<ContentList<ContentEntityRecord>> {
  const query = getQuery(event)
  const q = queryText(query.q, 'q').trim()
  if (q.length > CONTENT_SEARCH_MAX) fail(400, 'Invalid q', { message: `Pretraga može imati najviše ${CONTENT_SEARCH_MAX} znakova.` })
  const page = queryInteger(query.page, 'page', 1, MAX_PAGE)
  const size = queryInteger(query.size, 'size', CONTENT_PAGE_SIZES[0], Math.max(...CONTENT_PAGE_SIZES))
  if (!(CONTENT_PAGE_SIZES as readonly number[]).includes(size)) fail(400, 'Invalid size', { message: 'Parametar size nije ispravan.' })

  const sortText = queryText(query.sort, 'sort') || def.defaultSort
  const descending = sortText.startsWith('-')
  const sortColumn = ({ ...COMMON_SORTS, ...def.sorts } as Record<string, string>)[descending ? sortText.slice(1) : sortText]
  if (!sortColumn) fail(400, 'Invalid sort', { message: 'Parametar sort nije ispravan.' })

  const filters = { status: { column: 'status', values: CONTENT_STATUSES as readonly string[] }, ...def.filters }
  const statusFilter = queryText(query.status, 'status')
  if (statusFilter && !(CONTENT_STATUSES as readonly string[]).includes(statusFilter)) {
    fail(400, 'Invalid status', { message: 'Parametar status nije ispravan.' })
  }
  for (const [name, filter] of Object.entries(filters)) {
    if (name === 'status') continue
    const value = queryText(query[name], name)
    if (!value) continue
    if (filter.values.length && !filter.values.includes(value)) fail(400, `Invalid ${name}`, { message: `Parametar ${name} nije ispravan.` })
    if (!filter.values.length && !isUuid(value)) fail(400, `Invalid ${name}`, { message: `Parametar ${name} nije ispravan.` })
  }
  const filtered = (head: boolean) => {
    let request = useDatabaseClient().from(def.table).select(head ? 'id' : selectList(def), { count: 'exact', head })
    for (const [name, filter] of Object.entries(filters)) {
      if (name === 'status') continue
      const value = queryText(query[name], name)
      if (!value) continue
      const expanded = (filter as ContentFilter).in?.[value]
      if (expanded) request = request.in(filter.column, [...expanded])
      else request = request.eq(filter.column, value)
    }
    if (statusFilter) {
      if (def.adapter?.statusFilter) def.adapter.statusFilter(statusFilter as ContentStatus, (column, value) => {
        if (value === 'not.null') request = request.not(column, 'is', null)
        else if (value === null) request = request.is(column, null)
        else request = request.eq(column, value)
      })
      else request = request.eq('status', statusFilter)
    }
    if (q) request = request.ilike('search_text', searchPattern(q))
    return request
  }

  const from = (page - 1) * size
  const { data, count, error } = await filtered(false)
    .order(sortColumn, { ascending: !descending })
    .order('id')
    .range(from, from + size - 1)
  if (error?.code === 'PGRST103') {
    // PostgREST refuses a range past the last row; answer an empty page with the real total.
    const counted = await filtered(true)
    if (counted.error) contentDatabaseError(def, counted.error)
    return { rows: [], total: counted.count ?? 0, page, size }
  }
  if (error) contentDatabaseError(def, error)
  let rows = (data ?? []) as unknown as Row[]
  if (def.enrichRows) rows = await def.enrichRows(useDatabaseClient(), rows) as Row[]
  return { rows: rows.map(row => toEntity(def, row)), total: count ?? 0, page, size }
}

export async function getContent(def: AnyContentKindDefinition, id: string) {
  const row = await requireRow(def, id)
  const db = useDatabaseClient()
  const { data, error } = await db.from('content_legacy_ids')
    .select('legacy_id').eq('kind', def.kind).eq('entity_id', id).order('legacy_id')
  if (error) contentDatabaseError(def, error)
  const entity = toEntity(def, row)
  const extras = await def.loadEntity?.(db, entity) ?? {}
  return { entity: { ...entity, ...extras }, legacyIds: (data ?? []).map(entry => entry.legacy_id as string) }
}

const APPLY_KINDS = new Set<string>(['word', 'heritage_item', 'area', 'source'])

/**
 * `applySubmissionId` (and `applyCredit`: false leaves the contributor out of the credits) turn an update into
 * the apply of a correction or the publication of a proposal's draft. They are not fields of the entity: the
 * database trigger (content_apply_submission) checks them, approves the submission and clears the columns,
 * all in the same statement as the update.
 */
function applyColumns(def: AnyContentKindDefinition, body: Row) {
  const id = body.applySubmissionId
  if (id === undefined || id === null) return {}
  if (!APPLY_KINDS.has(def.kind) || typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
    invalid([{ path: '', message: 'Prijedlog se ne može primijeniti na ovaj zapis.' }], 'Prijedlog se ne može primijeniti na ovaj zapis.')
  }
  return { apply_submission_id: id, apply_credit: body.applyCredit !== false }
}

async function readInput(event: H3Event, def: AnyContentKindDefinition) {
  return readJsonObject(event, def.bodyLimit ?? CONTENT_BODY_LIMIT)
}

/** Every write makes the public snapshot reload on the next request; the kind's own hook runs after that. */
export async function contentAfterWrite(event: H3Event, def: AnyContentKindDefinition) {
  invalidatePublicContent()
  await def.afterWrite?.(event)
}

export async function createContent(event: H3Event, def: AnyContentKindDefinition) {
  const body = editable(def, await readInput(event, def))
  const { value, issues } = await validateInput(def, body)
  if (issues.length) invalid(issues)
  const row = toRow(def, value)
  if (def.adapter?.createId) row.id = def.adapter.createId(value)
  const { data, error } = await useDatabaseClient().from(def.table).insert(row).select(selectList(def)).single()
  if (error) contentDatabaseError(def, error)
  const saved = toEntity(def, data as unknown as Row)
  await def.persistEntity?.(useDatabaseClient(), saved.id as string, value as Row)
  await contentAfterWrite(event, def)
  setResponseStatus(event, 201)
  return { entity: { ...saved, ...(await def.loadEntity?.(useDatabaseClient(), saved) ?? {}) } }
}

/**
 * Applies the given fields on top of the stored row (unnamed fields keep their value), validates
 * the result as a whole and saves it only if the row is still at `revision`. A stale revision is a
 * 409 carrying the current row, so the dialog can reload or overwrite.
 */
export async function updateContent(event: H3Event, def: AnyContentKindDefinition, id: string) {
  const body = await readInput(event, def)
  const revision = body.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) {
    invalid([{ path: '', message: 'Nedostaje revizija zapisa; učitaj ga ponovno.' }], 'Nedostaje revizija zapisa.')
  }
  const current = await requireRow(def, id)
  if (current.revision !== revision) conflict(def, current)

  const { value, issues } = await validateInput(def, { ...editable(def, toEntity(def, current)), ...editable(def, body) }, id)
  if (issues.length) invalid(issues)
  const { data, error } = await useDatabaseClient().from(def.table).update({ ...toRow(def, value), ...applyColumns(def, body) })
    .eq('id', id).eq('revision', revision).select(selectList(def))
  if (error) contentDatabaseError(def, error)
  const saved = (data ?? []) as unknown as Row[]
  if (!saved.length) {
    // Someone saved between the read and the write.
    conflict(def, await requireRow(def, id))
  }
  const entity = toEntity(def, saved[0]!)
  await def.persistEntity?.(useDatabaseClient(), id, value as Row)
  await contentAfterWrite(event, def)
  const extras = await def.loadEntity?.(useDatabaseClient(), entity) ?? {}
  return { entity: { ...entity, ...extras } }
}

export async function contentReferences(def: AnyContentKindDefinition, id: string): Promise<ContentReferences> {
  await requireRow(def, id)
  let groups: ContentReferences['groups'] = []
  try {
    groups = (await def.references?.(useDatabaseClient(), id)) ?? []
  } catch (error) {
    contentDatabaseError(def, error as { code?: string, message: string })
  }
  return { blocking: groups.some(group => group.blocking && group.count > 0), groups: groups.filter(group => group.count > 0) }
}

/** Hides a row publicly while keeping its references and history. Archiving twice is a no-op. */
async function archiveContent(event: H3Event, def: AnyContentKindDefinition, id: string) {
  const current = await requireRow(def, id)
  const currentEntity = toEntity(def, current)
  if (currentEntity.status === 'archived') return { mode: 'archive' as const, entity: currentEntity }
  const patch = def.adapter?.archivePatch() ?? { status: 'archived' }
  const { data, error } = await useDatabaseClient().from(def.table).update(patch)
    .eq('id', id).select(selectList(def))
  if (error) contentDatabaseError(def, error)
  const saved = (data ?? []) as unknown as Row[]
  if (!saved.length) fail(404, 'Not found', { message: 'Zapis nije pronađen.' })
  await contentAfterWrite(event, def)
  return { mode: 'archive' as const, entity: toEntity(def, saved[0]!) }
}

/** Removes a row that nothing refers to. The audit trigger keeps its last state in the history. */
async function hardDeleteContent(event: H3Event, def: AnyContentKindDefinition, id: string) {
  const references = await contentReferences(def, id)
  if (references.blocking) {
    fail(409, 'Referenced', { code: 'referenced', message: 'Zapis se koristi pa se ne može trajno obrisati. Možeš ga arhivirati.', references })
  }
  const { data, error } = await useDatabaseClient().from(def.table).delete().eq('id', id).select('id')
  if (error) {
    // A reference added after the check above.
    if (error.code === '23503') {
      fail(409, 'Referenced', { code: 'referenced', message: 'Zapis se koristi pa se ne može trajno obrisati. Možeš ga arhivirati.', references: await contentReferences(def, id) })
    }
    contentDatabaseError(def, error)
  }
  if (!data?.length) fail(404, 'Not found', { message: 'Zapis nije pronađen.' })
  await contentAfterWrite(event, def)
  return { mode: 'hard' as const, id }
}

export function deleteContent(event: H3Event, def: AnyContentKindDefinition, id: string) {
  const mode = getQuery(event).mode ?? 'archive'
  if (mode === 'archive') return archiveContent(event, def, id)
  if (mode === 'hard') return hardDeleteContent(event, def, id)
  fail(400, 'Invalid mode', { message: 'Način brisanja mora biti archive ili hard.' })
}

/**
 * Short `{ id, label, status }` lists for select menus: `?q=` searches rows that are not archived,
 * `?ids=a,b` resolves the labels of already chosen rows whatever their status.
 */
export async function lookupContent(event: H3Event, def: AnyContentKindDefinition): Promise<{ items: ContentLookupItem[] }> {
  const query = getQuery(event)
  const q = queryText(query.q, 'q').trim()
  if (q.length > CONTENT_SEARCH_MAX) fail(400, 'Invalid q', { message: `Pretraga može imati najviše ${CONTENT_SEARCH_MAX} znakova.` })
  const idsText = queryText(query.ids, 'ids')
  const ids = idsText ? idsText.split(',') : []
  if (ids.length > MAX_LOOKUP_IDS || !ids.every(isUuid)) fail(400, 'Invalid ids', { message: 'Parametar ids nije ispravan.' })

  let request = useDatabaseClient().from(def.table).select(def.adapter ? selectList(def) : `id,status,${def.labelColumn}`)
  if (ids.length) {
    request = request.in('id', ids.map(id => id.toLowerCase()))
  } else {
    if (def.adapter?.statusFilter) {
      def.adapter.statusFilter('published', (column, value) => {
        if (value === null) request = request.is(column, null)
        else request = request.eq(column, value)
      })
    } else {
      request = request.neq('status', 'archived')
    }
    if (q) request = request.ilike('search_text', searchPattern(q))
  }
  const { data, error } = await request.order(def.adapter ? 'search_text' : def.labelColumn).order('id').limit(ids.length || CONTENT_LOOKUP_LIMIT)
  if (error) contentDatabaseError(def, error)
  return {
    items: ((data ?? []) as unknown as Row[]).map((row) => {
      const entity = toEntity(def, row)
      return {
        id: entity.id as string,
        label: def.lookupLabel?.(row) ?? def.adapter?.lookupLabel?.(row) ?? String(row[def.labelColumn] ?? ''),
        status: entity.status as ContentStatus
      }
    })
  }
}
