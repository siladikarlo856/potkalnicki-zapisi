import { describe, expect, it } from 'vitest'
import type { ContentList, ContentReferences } from '../shared/utils/content/common'
import type { Area } from '../shared/utils/content/area'
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

const BASE = '/api/admin/content/area'

function kitTestRegion() {
  const county = sql(`select id from areas where kind = 'county' limit 1`)
  return sql(`insert into public.areas (kind, parent_id, name, status) values ('region', '${county}', 'kit-test regija ' || gen_random_uuid()::text, 'draft') returning id`).toLowerCase()
}

describe.skipIf(!db.enabled)('admin areas API over real Postgres', () => {
  it('creates a draft settlement with region membership', async () => {
    const region = kitTestRegion()
    const town = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const response = await api<{ entity: Area }>(BASE, {
      method: 'POST',
      body: {
        kind: 'settlement',
        name: 'kit-test Naselje',
        parentId: town,
        slug: 'kit-test-naselje',
        status: 'draft',
        regionIds: [region]
      }
    })
    expect(response.status, JSON.stringify(response.body)).toBe(201)
    expect(response.body.entity).toMatchObject({ name: 'kit-test Naselje', kind: 'settlement', regionIds: [region] })
    expect(sql(`select count(*) from area_regions where area_id = '${response.body.entity.id}' and region_id = '${region}'`)).toBe('1')
  })

  it('refuses a region membership that is not a region before saving the area', async () => {
    const town = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const slug = `kit-test-bez-regije-${crypto.randomUUID().slice(0, 8)}`
    const response = await api(BASE, {
      method: 'POST',
      body: { kind: 'settlement', name: 'kit-test Bez regije', parentId: town, slug, status: 'draft', regionIds: [town] }
    })
    expect(response.status, JSON.stringify(response.body)).toBe(400)
    expect(response.body.data?.issues).toContainEqual(expect.objectContaining({ path: 'regionIds.0' }))
    expect(sql(`select count(*) from areas where slug = '${slug}'`)).toBe('0')
  })

  it('lists with the lau kind filter and blocks delete when referenced', async () => {
    const list = await api<ContentList<Area>>(`${BASE}?kind=lau&size=25`)
    expect(list.status).toBe(200)
    expect(list.body.rows.every(row => row.kind === 'town' || row.kind === 'municipality')).toBe(true)

    const town = list.body.rows[0]!
    const refs = await api<ContentReferences>(`${BASE}/${town.id}/references`)
    if (refs.body.blocking) {
      expect((await api(`${BASE}/${town.id}?mode=hard`, { method: 'DELETE' })).status).toBe(409)
    }
  })

  it('returns region ids on GET', async () => {
    const region = kitTestRegion()
    const country = sql(`select id from areas where kind = 'country' limit 1`)
    const created = await api<{ entity: Area }>(BASE, {
      method: 'POST',
      body: {
        kind: 'county',
        name: 'kit-test Županija',
        parentId: country,
        status: 'draft',
        regionIds: [region]
      }
    })
    expect(created.status).toBe(201)
    const loaded = await api<{ entity: Area, legacyIds: string[] }>(`${BASE}/${created.body.entity.id}`)
    expect(loaded.body.entity.regionIds).toEqual([region])
  })

  it('keeps an area\'s region membership when a save leaves regionIds out', async () => {
    const region = kitTestRegion()
    const town = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const suffix = crypto.randomUUID().slice(0, 8)
    let saved = (await api<{ entity: Area }>(BASE, {
      method: 'POST',
      body: { kind: 'settlement', name: `kit-test Izostavljeno ${suffix}`, parentId: town, slug: `kit-test-izostavljeno-${suffix}`, status: 'draft', regionIds: [region] }
    })).body.entity
    const id = saved.id

    for (const change of [{ name: `kit-test Izostavljeno nova ${suffix}` }, { description: 'kit-test opis' }]) {
      const response = await api<{ entity: Area }>(`${BASE}/${id}`, { method: 'PATCH', body: { revision: saved.revision, ...change } })
      expect(response.status, JSON.stringify(response.body)).toBe(200)
      saved = response.body.entity
      expect(saved).toMatchObject({ ...change, regionIds: [region] })
      expect(sql(`select string_agg(region_id::text, ',') from area_regions where area_id = '${id}'`)).toBe(region)
    }

    sql(`delete from areas where id = '${id}'`)
  })

  it('saves an area and its region membership in one transaction: a failing membership write leaves nothing written', async () => {
    const region = kitTestRegion()
    const otherRegion = kitTestRegion()
    const town = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const suffix = crypto.randomUUID().slice(0, 8)
    // Make the membership write fail for this test's areas only.
    sql(`
      create function public.kit_test_fail_area_region() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from public.areas where id = new.area_id and name like 'kit-test Neuspjeh%') then
          raise exception 'Forced link failure';
        end if;
        return new;
      end $$;
      create trigger kit_test_fail_area_region before insert on public.area_regions
        for each row execute function public.kit_test_fail_area_region();
    `)
    try {
      const slug = `kit-test-neuspjeh-${suffix}`
      const created = await api(BASE, {
        method: 'POST',
        body: { kind: 'settlement', name: `kit-test Neuspjeh ${suffix}`, parentId: town, slug, status: 'draft', regionIds: [region] }
      })
      expect(created.status).toBeGreaterThanOrEqual(400)
      expect(sql(`select count(*) from areas where slug = '${slug}'`)).toBe('0')

      const draft = await api<{ entity: Area }>(BASE, {
        method: 'POST',
        body: { kind: 'settlement', name: `kit-test Uspjeh ${suffix}`, parentId: town, slug: `kit-test-uspjeh-${suffix}`, status: 'draft', regionIds: [region] }
      })
      expect(draft.status, JSON.stringify(draft.body)).toBe(201)
      const id = draft.body.entity.id
      const before = sql(`select revision || ' ' || name from areas where id = '${id}'`)
      const updated = await api(`${BASE}/${id}`, {
        method: 'PATCH',
        body: { revision: draft.body.entity.revision, name: `kit-test Neuspjeh ${suffix}`, regionIds: [otherRegion] }
      })
      expect(updated.status).toBeGreaterThanOrEqual(400)
      expect(sql(`select revision || ' ' || name from areas where id = '${id}'`)).toBe(before)
      expect(sql(`select string_agg(region_id::text, ',') from area_regions where area_id = '${id}'`)).toBe(region)
      sql(`delete from areas where id = '${id}'`)
    } finally {
      sql(`drop trigger kit_test_fail_area_region on public.area_regions; drop function public.kit_test_fail_area_region();`)
    }
  })
})
