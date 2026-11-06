import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Club } from '../shared/utils/content/club'
import { integrationDb } from './support/integrationDb'

const SECRET = 'content-club-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, failure, fetch } = db

async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown, auth?: boolean } = {}) {
  const headers: Record<string, string> = {}
  if (init.auth !== false) headers.authorization = `Bearer ${SECRET}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { entity?: Club } }
}

describe.skipIf(!db.enabled)('club content over real Postgres', () => {
  it('creates, publishes with seasons and sources, refuses publish without sources, records slug history, denies anon', async () => {
    const settlement = sql(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const sourceA = sql(`select id from sources limit 1`)

    const draft = await api<{ entity: Club }>('/api/admin/content/club', {
      method: 'POST',
      body: {
        name: 'NK Test Klub', slug: `nk-test-${crypto.randomUUID().slice(0, 8)}`, sport: 'nogomet',
        settlementId: settlement, researchNotes: '', verification: 'unverified', noindex: false,
        status: 'draft', sourceIds: [], seasons: []
      }
    })
    expect(draft.status, JSON.stringify(draft.body)).toBe(201)
    const id = draft.body!.entity!.id

    const noSource = await api(`/api/admin/content/club/${id}`, {
      method: 'PATCH',
      body: { ...draft.body!.entity, revision: draft.body!.entity!.revision, status: 'published', sourceIds: [] }
    })
    expect(noSource.status).toBe(400)

    const published = await api<{ entity: Club }>(`/api/admin/content/club/${id}`, {
      method: 'PATCH',
      body: {
        ...draft.body!.entity,
        revision: draft.body!.entity!.revision,
        status: 'published',
        sourceIds: [sourceA],
        seasons: [{ season: '2026/27', competition: 'III ŽNL-a', team: 'seniori', sourceUrl: 'https://semafor.hns.family/', checkedAt: '2026-11-04' }]
      }
    })
    expect(published.status).toBe(200)
    expect(sql(`select count(*) from club_seasons where club_id = '${id}'`)).toBe('1')

    const slugChange = await api<{ entity: Club }>(`/api/admin/content/club/${id}`, {
      method: 'PATCH',
      body: { ...published.body!.entity, revision: published.body!.entity!.revision, slug: `${published.body!.entity!.slug}-v2` }
    })
    expect(slugChange.status).toBe(200)
    expect(sql(`select count(*) from content_slug_history where kind = 'club' and entity_id = '${id}'`)).toBe('1')

    expect(failure('set role anon; select count(*) from public.clubs;')).toMatch(/permission denied/)
    sql(`delete from clubs where id = '${id}'`)
  })

  it('replays the clubs seed idempotently with at least eight clubs', () => {
    const seed = readFileSync(new URL('../supabase/migrations/20261104030000_seed_clubs.sql', import.meta.url), 'utf8')
    sql(seed)
    sql(seed)
    expect(Number(sql('select count(*) from public.clubs where status = \'published\';'))).toBeGreaterThanOrEqual(8)
    expect(Number(sql('select count(*) from public.club_seasons;'))).toBeGreaterThanOrEqual(10)
  })
})
