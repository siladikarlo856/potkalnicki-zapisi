import { describe, expect, it } from 'vitest'
import type { ContentList } from '../shared/utils/content/common'
import type { HistoryLog, HistoryRestoreResult, HistoryRevisions } from '../shared/utils/content/history'
import type { Source } from '../shared/utils/content/source'
import { integrationDb } from './support/integrationDb'

// Change history over real Postgres: the revisions the audit trigger records, their field diffs,
// restoring a version (an update, a recreation after a hard delete, stale and invalid cases) and
// the global log. Run with `node scripts/test-challenges.mjs` (disposable Postgres and PostgREST,
// every migration applied); skipped everywhere else. Rows created here have a `history-test` title.
const SECRET = 'content-history-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, fetch } = db

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown, auth?: boolean } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': `198.51.100.${++ip % 250}` }
  if (init.auth !== false) headers.authorization = `Bearer ${SECRET}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

const BASE = '/api/admin/content/source'
const create = async (body: Record<string, unknown>) => {
  const response = await api<{ entity: Source }>(BASE, { method: 'POST', body })
  expect(response.status, JSON.stringify(response.body)).toBe(201)
  return response.body.entity
}
const edit = async (id: string, body: Record<string, unknown>) => {
  const response = await api<{ entity: Source }>(`${BASE}/${id}`, { method: 'PATCH', body })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return response.body.entity
}
const history = (id: string, query = '') => api<HistoryRevisions>(`${BASE}/${id}/revisions${query}`)
const restore = (id: string, body: Record<string, unknown>) => api<HistoryRestoreResult>(`${BASE}/${id}/restore`, { method: 'POST', body })

describe.skipIf(!db.enabled)('change history over real Postgres', () => {
  it('is closed without the session or secret', async () => {
    const id = '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10'
    expect((await api(`${BASE}/${id}/revisions`, { auth: false })).status).toBe(401)
    expect((await api(`${BASE}/${id}/restore`, { method: 'POST', body: {}, auth: false })).status).toBe(401)
    expect((await api('/api/admin/history', { auth: false })).status).toBe(401)
  })

  it('lists revisions newest first, each with the fields it changed', async () => {
    const first = await create({ title: 'history-test Zapisnik', type: 'publication', note: 'prva bilješka' })
    const second = await edit(first.id, { title: 'history-test Zapisnik (2. izdanje)', note: null, revision: first.revision })
    await edit(first.id, { status: 'archived', revision: second.revision })

    const result = await history(first.id)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ kind: 'source', entityId: first.id, label: 'history-test Zapisnik (2. izdanje)', exists: true, currentRevision: 3, hasMore: false })
    expect(result.body.revisions.map(revision => [revision.revision, revision.action, revision.actor])).toEqual([
      [3, 'update', 'admin'], [2, 'update', 'admin'], [1, 'insert', 'admin']
    ])
    expect(result.body.revisions[0]!.changes).toEqual([{ field: 'status', before: 'published', after: 'archived' }])
    expect(result.body.revisions[1]!.changes).toEqual([
      { field: 'title', before: 'history-test Zapisnik', after: 'history-test Zapisnik (2. izdanje)' },
      { field: 'note', before: 'prva bilješka', after: null }
    ])
    expect(result.body.revisions[2]!.changes).toEqual([
      { field: 'title', before: null, after: 'history-test Zapisnik' },
      { field: 'type', before: null, after: 'publication' },
      { field: 'note', before: null, after: 'prva bilješka' },
      { field: 'status', before: null, after: 'published' }
    ])
    for (const revision of result.body.revisions) expect(revision).not.toHaveProperty('data')
  })

  it('pages with before and limit and reports whether more remain', async () => {
    const source = await create({ title: 'history-test Straničenje', type: 'website' })
    let current = source
    for (const title of ['history-test Straničenje a', 'history-test Straničenje b', 'history-test Straničenje c']) current = await edit(source.id, { title, revision: current.revision })

    const firstPage = await history(source.id, '?limit=2')
    expect(firstPage.body.revisions.map(revision => revision.revision)).toEqual([4, 3])
    expect(firstPage.body.hasMore).toBe(true)
    const secondPage = await history(source.id, `?limit=2&before=${firstPage.body.revisions.at(-1)!.id}`)
    expect(secondPage.body.revisions.map(revision => revision.revision)).toEqual([2, 1])
    expect(secondPage.body.hasMore).toBe(false)
    // The oldest row listed on a page is still compared with the revision just before it.
    expect(firstPage.body.revisions[1]!.changes).toEqual([{ field: 'title', before: 'history-test Straničenje a', after: 'history-test Straničenje b' }])

    expect((await history(source.id, '?limit=0')).status).toBe(400)
    expect((await history(source.id, '?limit=51')).status).toBe(400)
    expect((await history(source.id, '?before=abc')).status).toBe(400)
  })

  it('answers 404 for an unknown row and a non-UUID id', async () => {
    expect((await history('0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6')).status).toBe(404)
    expect((await history('not-a-uuid')).status).toBe(404)
    expect((await api('/api/admin/content/word/0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6/revisions')).status).toBe(404)
    expect((await restore('0a4f3d2e-8b1c-4d5e-9f60-718293a4b5c6', { revisionId: 1 })).status).toBe(404)
  })

  it('restores an earlier version as a new revision and keeps the history', async () => {
    const source = await create({ title: 'history-test Vraćanje', type: 'publication', url: 'https://example.org/a', note: 'izvorna' })
    const changed = await edit(source.id, { title: 'history-test Vraćanje (izmijenjeno)', url: null, note: 'druga', status: 'draft', revision: source.revision })
    const original = (await history(source.id)).body.revisions.find(revision => revision.revision === 1)!

    const result = await restore(source.id, { revisionId: original.id, revision: changed.revision })
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(result.body).toMatchObject({ unchanged: false, recreated: false, entity: { title: 'history-test Vraćanje', url: 'https://example.org/a', note: 'izvorna', status: 'published', revision: 3 } })

    const after = await history(source.id)
    expect(after.body.revisions.map(revision => [revision.revision, revision.action])).toEqual([[3, 'update'], [2, 'update'], [1, 'insert']])
    expect(after.body.revisions[0]!.changes.map(change => change.field)).toEqual(['title', 'url', 'note', 'status'])
    // The row keeps its id and creation time; the database set the new revision and timestamp.
    expect(sql(`select (created_at = (select created_at from content_revisions where entity_id = '${source.id}' and revision = 1)) from sources where id = '${source.id}'`)).toBe('t')
  })

  it('leaves a row that is already in that version alone', async () => {
    const source = await create({ title: 'history-test Isto', type: 'other' })
    const { body } = await history(source.id)
    const result = await restore(source.id, { revisionId: body.revisions[0]!.id, revision: 1 })
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ unchanged: true, recreated: false })
    expect((await history(source.id)).body.revisions).toHaveLength(1)
  })

  it('refuses a stale revision with the current row, and malformed requests', async () => {
    const source = await create({ title: 'history-test Zastarjelo', type: 'other' })
    const next = await edit(source.id, { title: 'history-test Zastarjelo 2', revision: 1 })
    const first = (await history(source.id)).body.revisions.find(revision => revision.revision === 1)!

    const stale = await restore(source.id, { revisionId: first.id, revision: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.data).toMatchObject({ code: 'revision-conflict', current: { id: source.id, revision: next.revision, title: 'history-test Zastarjelo 2' } })

    expect((await restore(source.id, { revision: 2 })).status).toBe(400)
    expect((await restore(source.id, { revisionId: first.id })).status).toBe(400)
    expect((await restore(source.id, { revisionId: 'x', revision: 2 })).status).toBe(400)
    expect((await restore(source.id, { revisionId: 999999999, revision: 2 })).status).toBe(404)
  })

  it('does not restore a revision of another row', async () => {
    const one = await create({ title: 'history-test Prvi', type: 'other' })
    const two = await create({ title: 'history-test Drugi', type: 'other' })
    const foreign = (await history(one.id)).body.revisions[0]!
    const result = await restore(two.id, { revisionId: foreign.id, revision: 1 })
    expect(result.status).toBe(404)
    expect((await api<{ entity: Source }>(`${BASE}/${two.id}`)).body.entity.title).toBe('history-test Drugi')
  })

  it('refuses a stored version that no longer passes validation', async () => {
    const source = await create({ title: 'history-test Neispravno', type: 'other' })
    const next = await edit(source.id, { title: 'history-test Neispravno 2', revision: 1 })
    // A snapshot from before a rule was tightened: the stored type is not allowed any more.
    sql(`update content_revisions set data = jsonb_set(data, '{type}', '"retired_type"') where entity_id = '${source.id}' and revision = 1`)
    const first = (await history(source.id)).body.revisions.find(revision => revision.revision === 1)!
    const result = await restore(source.id, { revisionId: first.id, revision: next.revision })
    expect(result.status).toBe(400)
    expect(result.body.data).toMatchObject({ code: 'invalid', issues: [{ path: 'type' }] })
  })

  it('recreates a hard-deleted row under its id, creation time and continuing revision', async () => {
    const source = await create({ title: 'history-test Obrisano', type: 'interview', note: 'ostaje u povijesti' })
    const edited = await edit(source.id, { note: 'zadnja bilješka', revision: source.revision })
    expect((await api(`${BASE}/${source.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    const createdAt = sql(`select created_at from content_revisions where entity_id = '${source.id}' and revision = 1`)

    const gone = await history(source.id)
    expect(gone.status).toBe(200)
    expect(gone.body).toMatchObject({ exists: false, currentRevision: null, label: 'history-test Obrisano' })
    expect(gone.body.revisions.map(revision => [revision.revision, revision.action])).toEqual([[3, 'delete'], [2, 'update'], [1, 'insert']])
    expect(gone.body.revisions[0]!.changes).toEqual(expect.arrayContaining([{ field: 'note', before: 'zadnja bilješka', after: null }]))
    expect((await api(`${BASE}/${source.id}`)).status).toBe(404)

    // Restoring the state it had before the update (revision 1) brings the row back.
    const first = gone.body.revisions.find(revision => revision.revision === 1)!
    const result = await restore(source.id, { revisionId: first.id })
    expect(result.status, JSON.stringify(result.body)).toBe(200)
    expect(result.body).toMatchObject({ unchanged: false, recreated: true, entity: { id: source.id, title: 'history-test Obrisano', note: 'ostaje u povijesti', revision: 4 } })
    expect(sql(`select created_at from sources where id = '${source.id}'`)).toBe(createdAt)
    expect(edited.revision).toBe(2)

    const back = await history(source.id)
    expect(back.body).toMatchObject({ exists: true, currentRevision: 4 })
    expect(back.body.revisions.map(revision => [revision.revision, revision.action])).toEqual([[4, 'insert'], [3, 'delete'], [2, 'update'], [1, 'insert']])
  })

  it('refuses a restore that would duplicate a unique value, and a missing referenced row, without writing', async () => {
    const source = await create({ title: 'history-test Poveznica', type: 'website' })
    expect((await restore(source.id, { revisionId: (await history(source.id)).body.revisions[0]!.id, revision: 1 })).body)
      .toMatchObject({ unchanged: true })
    // Rows that reference a deleted source keep a foreign key; restoring one needs nothing else to exist.
    expect((await api(`${BASE}/${source.id}?mode=hard`, { method: 'DELETE' })).status).toBe(200)
    const gone = await history(source.id)
    expect((await restore(source.id, { revisionId: gone.body.revisions[0]!.id })).status).toBe(200)
  })

  it('lists the global log with filters, paging and labels, imported rows included', async () => {
    const unique = await create({ title: 'history-test Zapisnik dnevnik', type: 'other' })
    const log = await api<HistoryLog>('/api/admin/history?kind=source&action=insert&size=25')
    expect(log.status).toBe(200)
    expect(log.body.size).toBe(25)
    expect(log.body.rows.length).toBeGreaterThan(0)
    expect(log.body.rows.every(row => row.kind === 'source' && row.action === 'insert' && row.registered)).toBe(true)
    expect(log.body.rows.some(row => row.entityId === unique.id && row.label === 'history-test Zapisnik dnevnik' && row.actor === 'admin')).toBe(true)
    expect(log.body.rows.map(row => row.id)).toEqual([...log.body.rows.map(row => row.id)].sort((a, b) => b - a))

    // Seed migrations record their rows with the actor `import`; heritage items now have admin CRUD too.
    const imported = await api<HistoryLog>('/api/admin/history?actor=import&kind=heritage_item&size=25')
    expect(imported.body.total).toBeGreaterThan(0)
    expect(imported.body.rows[0]).toMatchObject({ kind: 'heritage_item', actor: 'import', registered: true })
    expect(imported.body.rows[0]!.label).not.toBe(imported.body.rows[0]!.entityId)
    const words = await api<HistoryLog>('/api/admin/history?kind=word&size=25')
    expect(words.body.rows[0]).toMatchObject({ kind: 'word', registered: true })
    expect(words.body.rows[0]!.label).not.toBe(words.body.rows[0]!.entityId)

    const one = await api<HistoryLog>(`/api/admin/history?entity=${unique.id.toUpperCase()}`)
    expect(one.body.rows.map(row => row.entityId)).toEqual([unique.id])

    const pastEnd = await api<HistoryLog>('/api/admin/history?page=9999')
    expect(pastEnd.status).toBe(200)
    expect(pastEnd.body.rows).toEqual([])
    expect(pastEnd.body.total).toBeGreaterThan(0)

    for (const bad of ['kind=sources', 'action=remove', 'actor=A%20B', 'entity=nope', 'size=7', 'page=0']) {
      expect((await api(`/api/admin/history?${bad}`)).status, bad).toBe(400)
    }
  })

  it('shows deletions in the log', async () => {
    const source = await create({ title: 'history-test Dnevnik brisanja', type: 'other' })
    await api(`${BASE}/${source.id}?mode=hard`, { method: 'DELETE' })
    const log = await api<HistoryLog>(`/api/admin/history?action=delete&entity=${source.id}`)
    expect(log.body.rows).toHaveLength(1)
    expect(log.body.rows[0]).toMatchObject({ kind: 'source', action: 'delete', label: 'history-test Dnevnik brisanja', revision: 2 })
    const list = await api<ContentList<Source>>(`${BASE}?q=history-test+Dnevnik+brisanja`)
    expect(list.body.total).toBe(0)
  })
})
