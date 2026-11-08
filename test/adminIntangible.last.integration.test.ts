import { describe, expect, it } from 'vitest'
import type { InboxMemoryDraftResult } from '../shared/types/inbox'
import type { ContentList, ContentLookupItem } from '../shared/utils/content/common'
import type { Custom } from '../shared/utils/content/custom'
import type { Narrator } from '../shared/utils/content/narrator'
import type { Story } from '../shared/utils/content/story'
import { integrationDb } from './support/integrationDb'

// What the admin pages for intangible heritage need from the server, over real Postgres: narrators found by their
// real name even without consent, lookups for places of every level and for words, and a Draft started from a Memory.
// Run with `node scripts/test-challenges.mjs test/adminIntangible.last.integration.test.ts`; skipped elsewhere. It runs
// last because it publishes content and approves a Memory, which other files' counts must not see.
const SECRET = 'admin-intangible-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, fetch } = db

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = { 'authorization': `Bearer ${SECRET}`, 'x-forwarded-for': `198.51.101.${(++ip % 250) + 1}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const send = () => fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  // A request after a SQL-only step can hit a socket the server has closed ("other side closed"); sending it once more is safe.
  const response = await send().catch((error: { cause?: { code?: string } }) => {
    if (error.cause?.code === 'UND_ERR_SOCKET') return send()
    throw error
  })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

const typeId = (table: string, key: string) => sql(`select id from ${table} where key = '${key}'`)
const lookup = async (kind: string, query: string) => (await api<{ items: ContentLookupItem[] }>(`/api/admin/lookup/${kind}?${query}`)).body.items

describe.skipIf(!db.enabled)('admin support for intangible heritage over real Postgres', () => {
  it('finds a narrator by the real name in the list and in lookups, with or without consent', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const created = await api<{ entity: Narrator }>('/api/admin/content/narrator', {
      method: 'POST',
      body: { name: `Šimun Ćurić${suffix}`, slug: `kazivac-${suffix}`, publicDescription: 'kazivač, r. 1930.', consentNamed: false, status: 'published' }
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const narrator = created.body.entity
    // The database keeps the name out of search_text without consent: the admin must still find the narrator by it.
    expect(sql(`select search_text like '%curic%' from narrators where id = '${narrator.id}'`)).toBe('f')

    const byName = async (q: string) => (await api<ContentList<Narrator>>(`/api/admin/content/narrator?q=${encodeURIComponent(q)}`)).body.rows.map(row => row.id)
    expect(await byName(`Ćurić${suffix}`)).toEqual([narrator.id])
    expect(await byName(`curic${suffix}`)).toEqual([narrator.id])
    expect(await byName(`SIMUN`)).toContain(narrator.id)
    expect(await byName('kazivač, r. 1930')).toContain(narrator.id)
    expect((await lookup('narrator', `q=${encodeURIComponent(`curic${suffix}`)}`)).map(item => item.id)).toEqual([narrator.id])
    expect((await lookup('narrator', `ids=${narrator.id}`)).map(item => item.label)).toEqual([`Šimun Ćurić${suffix}`])
    expect(await byName(`nepostojeci${suffix}`)).toEqual([])

    // A query cannot reshape the filter it is part of.
    for (const q of ['a,name.eq.x)(', '"quoted', 'back\\slash', '50%_']) {
      const reply = await api<ContentList<Narrator>>(`/api/admin/content/narrator?q=${encodeURIComponent(q)}`)
      expect(reply.status, q).toBe(200)
      expect(reply.body.rows.map(row => row.id), q).not.toContain(narrator.id)
    }
    // A comma in a query is text, not part of the filter: it still finds what holds it.
    expect(await byName('kazivač, r. 1930.')).toContain(narrator.id)
    sql(`delete from narrators where id = '${narrator.id}'`)
  })

  it('looks up places of every level, and words by their old ids', async () => {
    const all = await lookup('area', 'scope=all&q=krizevci')
    expect(all.length).toBeGreaterThan(0)
    expect(all.every(item => /· (Država|Županija|Regija|Grad|Općina|Naselje)$/.test(item.label))).toBe(true)
    const region = sql(`select name from areas where kind = 'region' limit 1`)
    expect((await lookup('area', `scope=all&q=${encodeURIComponent(region)}`)).some(item => item.label === `${region} · Regija`)).toBe(true)
    expect((await api('/api/admin/lookup/area?scope=nowhere')).status).toBe(400)
    // The scopes the other pages use are unchanged: no level in the label.
    expect((await lookup('area', 'scope=settlement&q=apatovec')).map(item => item.label)).toContain('Apatovec')

    const wordId = sql(`select id from heritage_words order by id limit 1`)
    expect((await lookup('word', `ids=${encodeURIComponent(wordId)}`)).map(item => item.id)).toEqual([wordId])
    expect((await api('/api/admin/lookup/word?ids=not%20a%20word%20id!')).status).toBe(400)
    expect((await api('/api/admin/lookup/source?ids=not-a-uuid')).status).toBe(400)
  })

  it('starts a Draft from a Memory, once, and publishing it credits the sender unless the editor leaves the credit out', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const memory = (type: string, name: string | null, status = 'pending') => sql(`with s as (insert into heritage_submissions (text, type, name, place, consent_publish, consent_version, locale, status)
      values ('Na Martinje smo pekli kestenje. Pili smo mošt i pjevali. ${suffix}', '${type}', ${name ? `'${name}'` : 'null'}, 'Sveti Petar Orehovec', true, 'test', 'hr', '${status}') returning id) select id from s`)
    const start = (id: string, body: Record<string, unknown>) => api<InboxMemoryDraftResult & { data?: Record<string, unknown> }>(`/api/admin/inbox/${id}/memory-draft`, { method: 'POST', body })
    const storyType = typeId('story_types', 'zivotna-prica')
    const customType = typeId('custom_types', 'godisnji-obicaji')

    const sender = memory('memory', 'Ana Testić')
    const first = await start(sender, { kind: 'story', typeId: storyType })
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    expect(first.body).toMatchObject({ kind: 'story', created: true })
    expect(sql(`select status || ' | ' || title || ' | ' || type_id::text || ' | ' || source_submission_id::text from stories where id = '${first.body.id}'`))
      .toBe(`draft | Na Martinje smo pekli kestenje | ${storyType} | ${sender}`)
    const draft = (await api<{ entity: Story }>(`/api/admin/content/story/${first.body.id}`)).body.entity
    expect(draft).toMatchObject({ textStandard: expect.stringContaining('pekli kestenje'), verification: 'unverified', areaLinks: [], narrators: [] })
    expect(sql(`select research_notes from stories where id = '${draft.id}'`)).toContain(`Nastalo iz sjećanja #${sender}`)
    expect(sql(`select research_notes from stories where id = '${draft.id}'`)).toContain('Sveti Petar Orehovec')
    expect(sql(`select count(*) from stories where slug like 'na-martinje-smo-pekli-kestenje%'`)).toBe('1')

    // The inbox shows which Draft the Memory produced.
    const listed = await api<{ rows: Array<{ id: number, created: { kind: string, id: string } | null }> }>('/api/admin/inbox?status=all&size=100')
    expect(listed.body.rows.find(row => row.id === Number(sender))?.created).toMatchObject({ kind: 'story', id: draft.id })

    // Asking again, even for another kind, gives the same Draft: one Memory yields one Draft.
    const again = await start(sender, { kind: 'story', typeId: storyType })
    expect(again.status).toBe(200)
    expect(again.body).toMatchObject({ kind: 'story', id: draft.id, created: false })
    const other = await start(sender, { kind: 'custom', typeId: customType })
    expect(other.body).toMatchObject({ kind: 'story', id: draft.id, created: false })
    expect(sql(`select count(*) from customs where source_submission_id = ${sender}`)).toBe('0')

    // Publishing applies the Memory; the editor may leave the sender out of the credits.
    const thanked = await api<{ entity: Story }>(`/api/admin/content/story/${draft.id}`, {
      method: 'PATCH', body: { ...draft, status: 'published', revision: draft.revision, applySubmissionId: Number(sender), applyCredit: false }
    })
    expect(thanked.status, JSON.stringify(thanked.body)).toBe(200)
    expect(sql(`select status || ' ' || (applied_entity_id = '${draft.id}')::text from heritage_submissions where id = ${sender}`)).toBe('approved true')
    expect(sql(`select jsonb_array_length(credits) from stories where id = '${draft.id}'`)).toBe('0')

    // The default thanks a named, consenting sender (a Custom this time).
    const second = memory('memory', 'Ivo Testić')
    const custom = await start(second, { kind: 'custom', typeId: customType })
    expect(custom.body).toMatchObject({ kind: 'custom', created: true })
    expect(sql(`select description from customs where id = '${custom.body.id}'`)).toContain('pekli kestenje')
    const customDraft = (await api<{ entity: Custom }>(`/api/admin/content/custom/${custom.body.id}`)).body.entity
    expect((await api(`/api/admin/content/custom/${customDraft.id}`, { method: 'PATCH', body: { ...customDraft, status: 'published', revision: customDraft.revision } })).status).toBe(200)
    expect(sql(`select credits->0->>'name' from customs where id = '${customDraft.id}'`)).toBe('Ivo Testić')

    sql(`delete from stories where id = '${draft.id}'; delete from customs where id = '${customDraft.id}'; delete from heritage_submissions where id in (${sender}, ${second});`)
  })

  it('refuses what is not a Memory, a rejected Memory, an unknown kind and a missing type', async () => {
    const insert = (type: string, status: string) => sql(`with s as (insert into heritage_submissions (text, type, consent_publish, consent_version, locale, status)
      values ('Tekst bez veze.', '${type}', true, 'test', 'hr', '${status}') returning id) select id from s`)
    const start = (id: string, body: Record<string, unknown>) => api(`/api/admin/inbox/${id}/memory-draft`, { method: 'POST', body })
    const type = typeId('story_types', 'bajka')

    const word = insert('word', 'pending')
    expect((await start(word, { kind: 'story', typeId: type })).status).toBe(400)
    const rejected = insert('memory', 'rejected')
    expect((await start(rejected, { kind: 'story', typeId: type })).status).toBe(409)
    const memory = insert('memory', 'pending')
    expect((await start(memory, { kind: 'heritage_item', typeId: type })).status).toBe(400)
    expect((await start(memory, { kind: 'story' })).status).toBe(400)
    expect((await start(memory, { kind: 'story', typeId: '6f1c1c36-3a5e-4b7f-9a52-0d3f0b6c1a10' })).status).toBe(400)
    expect((await start('999999999', { kind: 'story', typeId: type })).status).toBe(404)
    expect(sql(`select (select count(*) from stories where source_submission_id in (${word}, ${rejected}, ${memory}))`)).toBe('0')
    sql(`delete from heritage_submissions where id in (${word}, ${rejected}, ${memory});`)
  })
})
