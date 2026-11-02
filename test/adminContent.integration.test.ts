import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ContentList, ContentReferences } from '../shared/utils/content/common'
import type { Source } from '../shared/utils/content/source'

// The generic admin content API (/api/admin/content/:kind) over real Postgres: the revision,
// search and audit triggers, foreign-key restricted deletes and the error mapping. Run with
// `node scripts/test-challenges.mjs`, which provisions a disposable Postgres and PostgREST and
// applies every migration; skipped everywhere else. Rows created here use a `kit-test` title.
const url = process.env.TEST_CHALLENGE_API_URL
const key = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''
const SECRET = 'content-kit-review-secret-0123456789'

if (url) await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)), server: true, setupTimeout: 300_000,
  env: { NUXT_SUPABASE_URL: url, NUXT_SUPABASE_SERVICE_ROLE_KEY: key, NUXT_REVIEW_SECRET: SECRET }
})

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown, auth?: boolean, origin?: string } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': `192.0.2.${++ip % 250}` }
  if (init.auth !== false) headers.authorization = `Bearer ${SECRET}`
  if (init.origin) headers.origin = init.origin
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> }, cache: response.headers.get('cache-control') }
}

const BASE = '/api/admin/content/source'
const create = async (body: Record<string, unknown>) => {
  const response = await api<{ entity: Source }>(BASE, { method: 'POST', body })
  expect(response.status, JSON.stringify(response.body)).toBe(201)
  return response.body.entity
}

describe.skipIf(!url)('admin content API over real Postgres', () => {
  it('is closed without the session or secret, and never cached', async () => {
    const response = await api(BASE, { auth: false })
    expect(response.status).toBe(401)
    expect((await api(BASE)).cache).toBe('no-store')
  })

  it('creates with the shared validator and lets the database own ids, revision and timestamps', async () => {
    const invalid = await api(BASE, { method: 'POST', body: { title: ' ', type: 'poem' } })
    expect(invalid.status).toBe(400)
    expect(invalid.body.data).toMatchObject({ code: 'invalid', issues: [{ path: 'title' }, { path: 'type' }] })

    const entity = await create({ title: '  kit-test Čakovečki zapisnik ', type: 'publication', url: '', note: null, id: 'forged', revision: 40, status: 'draft' })
    expect(entity).toMatchObject({ title: 'kit-test Čakovečki zapisnik', type: 'publication', url: null, note: null, status: 'draft', revision: 1 })
    expect(entity.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(sql(`select actor || ':' || action || ':' || revision from content_revisions where entity_kind = 'source' and entity_id = '${entity.id}'`)).toBe('admin:insert:1')
  })

  it('lists with folded search, filters, sorting and pagination', async () => {
    await create({ title: 'kit-test Žabno rječnik', type: 'dictionary' })
    await create({ title: 'kit-test Đurđevac studija', type: 'conservation_study' })

    const folded = await api<ContentList<Source>>(`${BASE}?q=${encodeURIComponent('cakovecki')}`)
    expect(folded.status).toBe(200)
    expect(folded.body.rows.map(row => row.title)).toEqual(['kit-test Čakovečki zapisnik'])

    const accented = await api<ContentList<Source>>(`${BASE}?q=${encodeURIComponent('kit-test ŽABNO')}`)
    expect(accented.body.rows.map(row => row.title)).toEqual(['kit-test Žabno rječnik'])

    const wildcard = await api<ContentList<Source>>(`${BASE}?q=${encodeURIComponent('kit%test')}`)
    expect(wildcard.body.total).toBe(0)

    const sorted = await api<ContentList<Source>>(`${BASE}?q=kit-test&sort=-title&size=25`)
    expect(sorted.body).toMatchObject({ total: 3, page: 1, size: 25 })
    expect(sorted.body.rows.map(row => row.title)).toEqual(['kit-test Žabno rječnik', 'kit-test Đurđevac studija', 'kit-test Čakovečki zapisnik'])

    const filtered = await api<ContentList<Source>>(`${BASE}?q=kit-test&type=dictionary`)
    expect(filtered.body.rows.map(row => row.type)).toEqual(['dictionary'])
    expect((await api<ContentList<Source>>(`${BASE}?q=kit-test&status=draft`)).body.total).toBe(1)

    const second = await api<ContentList<Source>>(`${BASE}?q=kit-test&sort=title&size=25&page=2`)
    expect(second.body).toMatchObject({ rows: [], total: 3, page: 2 })

    for (const query of ['size=10', 'page=0', 'sort=search_text', 'type=poem', 'status=deleted', `q=${'x'.repeat(101)}`]) {
      expect((await api(`${BASE}?${query}`)).status, query).toBe(400)
    }
  })

  it('updates the given fields only, at the expected revision, and answers 409 with the current row otherwise', async () => {
    const entity = await create({ title: 'kit-test revizije', type: 'website', url: 'https://example.org/a' })
    sql(`insert into content_legacy_ids (kind, legacy_id, entity_id) values ('source', 'kit-test-legacy', '${entity.id}')`)
    const loaded = await api<{ entity: Source, legacyIds: string[] }>(`${BASE}/${entity.id}`)
    expect(loaded.body).toEqual({ entity, legacyIds: ['kit-test-legacy'] })

    const saved = await api<{ entity: Source }>(`${BASE}/${entity.id}`, { method: 'PATCH', body: { note: 'Bilješka', revision: 1 } })
    expect(saved.status).toBe(200)
    expect(saved.body.entity).toMatchObject({ title: 'kit-test revizije', url: 'https://example.org/a', note: 'Bilješka', revision: 2 })
    expect(Date.parse(saved.body.entity.updatedAt)).toBeGreaterThanOrEqual(Date.parse(entity.updatedAt))
    expect(saved.body.entity.createdAt).toBe(entity.createdAt)

    const stale = await api(`${BASE}/${entity.id}`, { method: 'PATCH', body: { title: 'kit-test stara verzija', revision: 1 } })
    expect(stale.status).toBe(409)
    expect(stale.body.data).toMatchObject({ code: 'revision-conflict', current: { note: 'Bilješka', revision: 2 } })

    const invalid = await api(`${BASE}/${entity.id}`, { method: 'PATCH', body: { url: 'example.org', revision: 2 } })
    expect(invalid.status).toBe(400)
    expect(invalid.body.data).toMatchObject({ issues: [{ path: 'url' }] })
    expect((await api(`${BASE}/${entity.id}`, { method: 'PATCH', body: { note: 'x' } })).status).toBe(400)

    expect(sql(`select string_agg(action || revision, ',' order by id) from content_revisions where entity_id = '${entity.id}'`)).toBe('insert1,update2')
    expect((await api(`${BASE}/00000000-0000-4000-8000-000000000000`, { method: 'PATCH', body: { note: 'x', revision: 1 } })).status).toBe(404)
  })

  it('blocks a hard delete while heritage items cite the source, archives it, and deletes once unreferenced', async () => {
    const entity = await create({ title: 'kit-test citirani izvor', type: 'official_registry' })
    sql(`
      insert into areas (id, kind, parent_id, name, slug, status) values
        ('7a000000-0000-4000-8000-000000000001', 'country', null, 'kit-test Država', 'kit-test-drzava', 'published'),
        ('7a000000-0000-4000-8000-000000000005', 'county', '7a000000-0000-4000-8000-000000000001', 'kit-test Županija', 'kit-test-zupanija', 'published'),
        ('7a000000-0000-4000-8000-000000000002', 'municipality', '7a000000-0000-4000-8000-000000000005', 'kit-test Općina', 'kit-test-opcina', 'published');
      insert into heritage_categories (id, key, label_hr) values ('7a000000-0000-4000-8000-000000000003', 'kit-test-kapela', 'Kapela') on conflict do nothing;
      insert into heritage_items (id, name, slug, category_id, municipality_id, status) values
        ('7a000000-0000-4000-8000-000000000004', 'kit-test Kapela sv. Roka', 'kapela-sv-roka', '7a000000-0000-4000-8000-000000000003', '7a000000-0000-4000-8000-000000000002', 'published');
      insert into heritage_item_sources (item_id, source_id, position) values ('7a000000-0000-4000-8000-000000000004', '${entity.id}', 0);
    `)

    const references = await api<ContentReferences>(`${BASE}/${entity.id}/references`)
    expect(references.body).toEqual({
      blocking: true,
      groups: [{ kind: 'heritage_item', label: 'Zapisi baštine', count: 1, blocking: true, items: [{ id: '7a000000-0000-4000-8000-000000000004', label: 'kit-test Kapela sv. Roka' }] }]
    })
    const refused = await api(`${BASE}/${entity.id}?mode=hard`, { method: 'DELETE' })
    expect(refused.status).toBe(409)
    expect(refused.body.data).toMatchObject({ code: 'referenced', references: { blocking: true } })

    const archived = await api<{ mode: string, entity: Source }>(`${BASE}/${entity.id}`, { method: 'DELETE' })
    expect(archived.status).toBe(200)
    expect(archived.body).toMatchObject({ mode: 'archive', entity: { status: 'archived', revision: 2 } })
    expect((await api<{ items: unknown[] }>(`/api/admin/lookup/source?q=citirani`)).body.items).toEqual([])
    expect((await api<{ items: unknown[] }>(`/api/admin/lookup/source?ids=${entity.id}`)).body.items)
      .toEqual([{ id: entity.id, label: 'kit-test citirani izvor', status: 'archived' }])

    sql(`delete from heritage_items where id = '7a000000-0000-4000-8000-000000000004'`)
    expect((await api<ContentReferences>(`${BASE}/${entity.id}/references`)).body).toEqual({ blocking: false, groups: [] })
    expect((await api(`${BASE}/${entity.id}?mode=hard`, { method: 'DELETE' })).body).toEqual({ mode: 'hard', id: entity.id })
    expect((await api(`${BASE}/${entity.id}`)).status).toBe(404)
    expect(sql(`select action from content_revisions where entity_id = '${entity.id}' order by id desc limit 1`)).toBe('delete')
    expect((await api(`${BASE}/${entity.id}?mode=hard`, { method: 'DELETE' })).status).toBe(404)
    expect((await api(`${BASE}/${entity.id}?mode=gone`, { method: 'DELETE' })).status).toBe(400)
  })

  it('looks up labels for select menus and refuses malformed lookups', async () => {
    const entity = await create({ title: 'kit-test Kajkavski rječnik', type: 'dictionary' })
    expect((await api<{ items: unknown[] }>('/api/admin/lookup/source?q=kajkavski')).body.items)
      .toEqual([{ id: entity.id, label: 'kit-test Kajkavski rječnik', status: 'published' }])
    expect((await api('/api/admin/lookup/source?ids=not-a-uuid')).status).toBe(400)
  })

  it('refuses a cross-site write and an oversized body before touching the database', async () => {
    expect((await api(BASE, { method: 'POST', body: { title: 'kit-test cross-site', type: 'other' }, origin: 'https://evil.example' })).status).toBe(403)
    expect((await api(BASE, { method: 'POST', body: { title: 'kit-test velik', type: 'other', note: 'x'.repeat(70_000) } })).status).toBe(413)
    expect(sql(`select count(*) from sources where title in ('kit-test cross-site', 'kit-test velik')`)).toBe('0')
  })
})
