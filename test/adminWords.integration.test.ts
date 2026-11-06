import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { ContentList, ContentReferences } from '../shared/utils/content/common'
import type { Word } from '../shared/utils/content/word'
import { integrationDb } from './support/integrationDb'

const SECRET = 'content-kit-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, fetch } = db

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown, auth?: boolean } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': `192.0.2.${++ip % 250}` }
  if (init.auth !== false) headers.authorization = `Bearer ${SECRET}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

const BASE = '/api/admin/content/word'
const tag = () => randomUUID().slice(0, 8)

function entry(id: string, headword: string) {
  return {
    id, headword, meaning: { hr: `značenje ${headword}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    variants: [{ id: randomUUID(), form: headword, status: 'community', usages: [] }]
  }
}

describe.skipIf(!db.enabled)('admin word content API over real Postgres', () => {
  it('lists with search and status filters without loading every row at once', async () => {
    const headword = `kit-word-${tag()}`
    const id = randomUUID()
    const create = await api<{ entity: Word }>(BASE, { method: 'POST', body: { status: 'draft', entry: entry(id, headword), areas: [] } })
    expect(create.status).toBe(201)

    const found = await api<ContentList<Word>>(`${BASE}?q=${encodeURIComponent(headword)}`)
    expect(found.body.rows.some(row => row.id === id)).toBe(true)

    const drafts = await api<ContentList<Word>>(`${BASE}?status=draft&q=${encodeURIComponent('kit-word-')}`)
    expect(drafts.body.rows.every(row => row.status === 'draft')).toBe(true)
  })

  it('archives and blocks hard delete while a daily row references the word', async () => {
    const headword = `kit-daily-${tag()}`
    const id = randomUUID()
    const word = await api<{ entity: Word }>(BASE, { method: 'POST', body: { status: 'published', entry: entry(id, headword), areas: [] } })
    expect(word.status).toBe(201)
    sql(`insert into public.heritage_daily_words (day, word_id, source, village) values ('2099-01-01', '${id}', 'pinned', 'auto')`)

    const references = await api<ContentReferences>(`${BASE}/${id}/references`)
    expect(references.body.blocking).toBe(true)

    const refused = await api(`${BASE}/${id}?mode=hard`, { method: 'DELETE' })
    expect(refused.status).toBe(409)

    const archived = await api<{ entity: Word }>(`${BASE}/${id}`, { method: 'DELETE' })
    expect(archived.body.entity.status).toBe('archived')
    expect(sql(`select archived_at is not null from public.heritage_words where id = '${id}'`)).toBe('t')
  })
})
