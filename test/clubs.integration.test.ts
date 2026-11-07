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

  it('keeps a club\'s seasons and sources when a save leaves those fields out', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const settlement = sql(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const source = sql(`select id from sources limit 1`)
    const seasons = () => sql(`select string_agg(season || ':' || competition, ',') from club_seasons where club_id = '${id}'`)
    let saved = (await api<{ entity: Club }>('/api/admin/content/club', {
      method: 'POST',
      body: {
        name: `kit-test Izostavljeno ${suffix}`, slug: `kit-test-izostavljeno-${suffix}`, sport: 'nogomet', settlementId: settlement,
        researchNotes: '', verification: 'unverified', noindex: false, status: 'draft', sourceIds: [source],
        seasons: [{ season: '2026/27', competition: 'III ŽNL-a', team: 'seniori', sourceUrl: null, checkedAt: '2026-11-04' }]
      }
    })).body.entity!
    const id = saved.id

    // A Draft keeps its links; a Published club keeps the source it needs, so the save is not refused.
    for (const change of [{ name: `kit-test Izostavljeno nova ${suffix}` }, { status: 'published' }, { homeGround: 'kit-test igralište' }]) {
      const response = await api<{ entity: Club }>(`/api/admin/content/club/${id}`, { method: 'PATCH', body: { revision: saved.revision, ...change } })
      expect(response.status, JSON.stringify(response.body)).toBe(200)
      saved = response.body.entity!
      expect(saved).toMatchObject({ ...change, sourceIds: [source] })
      expect(sql(`select string_agg(source_id::text, ',') from club_sources where club_id = '${id}'`)).toBe(source)
      expect(seasons()).toBe('2026/27:III ŽNL-a')
    }

    sql(`delete from clubs where id = '${id}'`)
  })

  it('saves a club, its seasons and sources in one transaction: a failing source write leaves nothing written', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const settlement = sql(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const source = sql(`select id from sources limit 1 offset 0`)
    const otherSource = sql(`select id from sources limit 1 offset 1`)
    const club = (name: string, slug: string) => ({
      name, slug, sport: 'nogomet', settlementId: settlement, researchNotes: '', verification: 'unverified', noindex: false,
      status: 'draft', sourceIds: [source],
      seasons: [{ season: '2026/27', competition: 'III ŽNL-a', team: 'seniori', sourceUrl: null, checkedAt: '2026-11-04' }]
    })
    // Sources are written last; make that write fail for this test's clubs only.
    sql(`
      create function public.kit_test_fail_club_source() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from public.clubs where id = new.club_id and name like 'kit-test Neuspjeh%') then
          raise exception 'Forced link failure';
        end if;
        return new;
      end $$;
      create trigger kit_test_fail_club_source before insert on public.club_sources
        for each row execute function public.kit_test_fail_club_source();
    `)
    try {
      const slug = `kit-test-neuspjeh-${suffix}`
      const created = await api('/api/admin/content/club', { method: 'POST', body: club(`kit-test Neuspjeh ${suffix}`, slug) })
      expect(created.status).toBeGreaterThanOrEqual(400)
      expect(sql(`select count(*) from clubs where slug = '${slug}'`)).toBe('0')

      const draft = await api<{ entity: Club }>('/api/admin/content/club', {
        method: 'POST', body: club(`kit-test Uspjeh ${suffix}`, `kit-test-uspjeh-${suffix}`)
      })
      expect(draft.status, JSON.stringify(draft.body)).toBe(201)
      const id = draft.body.entity!.id
      const before = sql(`select revision || ' ' || name from clubs where id = '${id}'`)
      const updated = await api(`/api/admin/content/club/${id}`, {
        method: 'PATCH',
        body: {
          revision: draft.body.entity!.revision, name: `kit-test Neuspjeh ${suffix}`, sourceIds: [otherSource],
          seasons: [{ season: '2025/26', competition: 'II ŽNL-a', team: 'seniori', sourceUrl: null, checkedAt: '2026-11-04' }]
        }
      })
      expect(updated.status).toBeGreaterThanOrEqual(400)
      expect(sql(`select revision || ' ' || name from clubs where id = '${id}'`)).toBe(before)
      expect(sql(`select string_agg(season || ':' || competition, ',') from club_seasons where club_id = '${id}'`)).toBe('2026/27:III ŽNL-a')
      expect(sql(`select string_agg(source_id::text, ',') from club_sources where club_id = '${id}'`)).toBe(source)
      sql(`delete from clubs where id = '${id}'`)
    } finally {
      sql(`drop trigger kit_test_fail_club_source on public.club_sources; drop function public.kit_test_fail_club_source();`)
    }
  })

  it('replays the clubs seed idempotently with at least eight clubs', () => {
    const seed = readFileSync(new URL('../supabase/migrations/20261104030000_seed_clubs.sql', import.meta.url), 'utf8')
    sql(seed)
    sql(seed)
    expect(Number(sql('select count(*) from public.clubs where status = \'published\';'))).toBeGreaterThanOrEqual(8)
    expect(Number(sql('select count(*) from public.club_seasons;'))).toBeGreaterThanOrEqual(10)
  })
})
