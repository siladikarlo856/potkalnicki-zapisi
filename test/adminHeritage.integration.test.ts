import { describe, expect, it } from 'vitest'
import type { ContentList } from '../shared/utils/content/common'
import type { HeritageCategory } from '../shared/utils/content/category'
import type { HeritageItem } from '../shared/utils/content/heritageItem'
import type { AtlasHeritageItemResponse } from '../shared/types/publicAtlas'
import { integrationDb } from './support/integrationDb'

const SECRET = 'content-kit-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, fetch } = db

async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown, auth?: boolean } = {}) {
  const headers: Record<string, string> = {}
  if (init.auth !== false) headers.authorization = `Bearer ${SECRET}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

describe.skipIf(!db.enabled)('heritage admin content over real Postgres', () => {
  it('creates a category and an item with ordered sources, then archives the item', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const category = await api<{ entity: HeritageCategory }>('/api/admin/content/heritage_category', {
      method: 'POST',
      body: { key: `kit-test-kapela-${suffix}`, labelHr: `kit-test Kapela ${suffix}`, labelEn: null, sort: 999, status: 'published' }
    })
    expect(category.status).toBe(201)

    const municipality = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const settlement = sql(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const source = sql(`select id from sources limit 1`)

    const item = await api<{ entity: HeritageItem }>('/api/admin/content/heritage_item', {
      method: 'POST',
      body: {
        name: `kit-test Crkva ${suffix}`,
        slug: `kit-test-crkva-${suffix}`,
        categoryId: category.body.entity.id,
        municipalityId: municipality,
        settlementId: settlement,
        verification: 'unverified',
        researchNotes: 'kit-test bilješka',
        sourceIds: [source],
        status: 'published'
      }
    })
    expect(item.status).toBe(201)
    expect(item.body.entity.sourceIds).toEqual([source])

    const listed = await api<ContentList<HeritageItem>>(`/api/admin/content/heritage_item?q=kit-test`)
    expect(listed.body.rows.some(row => row.id === item.body.entity.id)).toBe(true)

    const archived = await api(`/api/admin/content/heritage_item/${item.body.entity.id}`, { method: 'DELETE' })
    expect(archived.status).toBe(200)
    expect((await api(`/api/content/target?kind=heritage_item&id=${item.body.entity.id}`)).status).toBe(410)

    sql(`delete from heritage_items where id = '${item.body.entity.id}'`)
    sql(`delete from heritage_categories where id = '${category.body.entity.id}'`)
  })

  it('saves photos with the item, keeps them when a save leaves them out and shows them on the public page', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const category = sql(`select id from heritage_categories where status = 'published' limit 1`)
    const municipality = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const source = sql(`select id from sources where status = 'published' limit 1`)
    const file = crypto.randomUUID()
    const photo = {
      path: `heritage/${file}.webp`, thumbPath: `heritage/${file}-thumb.webp`, width: 1600, height: 1200,
      alt: `kit-test pročelje ${suffix}`, caption: null, author: 'Ivan Horvat', authorUrl: null,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kit-test.jpg', license: 'cc-by-sa-4.0'
    }
    const second = { ...photo, path: `heritage/${file.slice(0, -1)}0.jpg`, thumbPath: `heritage/${file.slice(0, -1)}0-thumb.jpg`, license: 'permission', sourceUrl: null }

    const refused = await api('/api/admin/content/heritage_item', {
      method: 'POST',
      body: {
        name: `kit-test Foto ${suffix}`, slug: `kit-test-foto-${suffix}`, categoryId: category, municipalityId: municipality,
        verification: 'unverified', researchNotes: '', sourceIds: [source], status: 'draft', images: [{ ...photo, sourceUrl: null }]
      }
    })
    expect(refused.status).toBe(400)
    expect(refused.body.data?.issues).toEqual([expect.objectContaining({ path: 'images.0.sourceUrl' })])

    const created = await api<{ entity: HeritageItem }>('/api/admin/content/heritage_item', {
      method: 'POST',
      body: {
        name: `kit-test Foto ${suffix}`, slug: `kit-test-foto-${suffix}`, categoryId: category, municipalityId: municipality,
        settlementId: sql(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`),
        verification: 'unverified', researchNotes: '', sourceIds: [source], status: 'published', images: [photo, second]
      }
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.entity.id
    try {
      expect(created.body.entity.images).toEqual([photo, second])
      expect(sql(`select string_agg(position || ':' || license, ',' order by position) from heritage_item_images where item_id = '${id}'`))
        .toBe('0:cc-by-sa-4.0,1:permission')

      const renamed = await api<{ entity: HeritageItem }>(`/api/admin/content/heritage_item/${id}`, {
        method: 'PATCH', body: { revision: created.body.entity.revision, name: `kit-test Foto nova ${suffix}` }
      })
      expect(renamed.status, JSON.stringify(renamed.body)).toBe(200)
      expect(renamed.body.entity.images).toEqual([photo, second])

      const page = await api<AtlasHeritageItemResponse>(`/api/atlas/heritage/apatovec/kit-test-foto-${suffix}`, { auth: false })
      expect(page.status).toBe(200)
      expect(page.body.item.images.map(image => [image.license, image.licenseLabel])).toEqual([['cc-by-sa-4.0', 'CC BY-SA 4.0'], ['permission', 'Uz dopuštenje autora']])
      expect(page.body.item.images[0]!.url).toMatch(new RegExp(`/storage/v1/object/public/heritage-media/heritage/${file}\\.webp$`))
      expect(page.body.item.thumb).toMatchObject({ author: 'Ivan Horvat', licenseLabel: 'CC BY-SA 4.0' })

      const reordered = await api<{ entity: HeritageItem }>(`/api/admin/content/heritage_item/${id}`, {
        method: 'PATCH', body: { revision: renamed.body.entity.revision, images: [second] }
      })
      expect(reordered.status, JSON.stringify(reordered.body)).toBe(200)
      expect(sql(`select string_agg(position || ':' || path, ',') from heritage_item_images where item_id = '${id}'`)).toBe(`0:${second.path}`)
      const credits = await api<{ photos: Array<{ item: { id: string }, author: string }> }>('/api/atlas/photos', { auth: false })
      expect(credits.body.photos.filter(credit => credit.item.id === id).map(credit => credit.author)).toEqual(['Ivan Horvat'])
    } finally {
      sql(`delete from heritage_items where id = '${id}'`)
    }
    expect(sql(`select count(*) from heritage_item_images where item_id = '${id}'`)).toBe('0')
  })

  it('checks a photo upload before anything reaches Storage', async () => {
    expect((await api('/api/admin/images', { method: 'POST', body: { image: 'x', thumb: 'y' }, auth: false })).status).toBe(401)
    const invalid = await api('/api/admin/images', {
      method: 'POST',
      body: { image: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'), thumb: 42 }
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.data?.issues).toEqual([
      { path: 'image', message: 'Fotografija: samo WebP ili JPEG.' },
      { path: 'thumb', message: 'Umanjena fotografija: datoteka nedostaje.' }
    ])
  })

  it('keeps a heritage item\'s sources when a save leaves sourceIds out', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const category = sql(`select id from heritage_categories limit 1`)
    const municipality = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const source = sql(`select id from sources limit 1`)
    let saved = (await api<{ entity: HeritageItem }>('/api/admin/content/heritage_item', {
      method: 'POST',
      body: {
        name: `kit-test Izostavljeno ${suffix}`, slug: `kit-test-izostavljeno-${suffix}`, categoryId: category,
        municipalityId: municipality, verification: 'unverified', researchNotes: '', sourceIds: [source], status: 'draft'
      }
    })).body.entity
    const id = saved.id

    // A Draft keeps its sources; a Published item keeps the source it needs, so the save is not refused.
    for (const change of [{ name: `kit-test Izostavljeno nova ${suffix}` }, { status: 'published' }, { period: '18. st.' }]) {
      const response = await api<{ entity: HeritageItem }>(`/api/admin/content/heritage_item/${id}`, {
        method: 'PATCH',
        body: { revision: saved.revision, ...change }
      })
      expect(response.status, JSON.stringify(response.body)).toBe(200)
      saved = response.body.entity
      expect(saved).toMatchObject({ ...change, sourceIds: [source] })
      expect(sql(`select string_agg(source_id::text, ',') from heritage_item_sources where item_id = '${id}'`)).toBe(source)
    }

    sql(`delete from heritage_items where id = '${id}'`)
  })

  it('saves a heritage item and its sources in one transaction: a failing source write leaves nothing written', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const category = sql(`select id from heritage_categories limit 1`)
    const municipality = sql(`select id from areas where kind = 'town' and slug = 'grad-krizevci' limit 1`)
    const source = sql(`select id from sources limit 1 offset 0`)
    const otherSource = sql(`select id from sources limit 1 offset 1`)
    const item = (name: string, slug: string) => ({
      name, slug, categoryId: category, municipalityId: municipality, verification: 'unverified', researchNotes: '', sourceIds: [source], status: 'draft'
    })
    // Make the source write fail for this test's items only.
    sql(`
      create function public.kit_test_fail_item_source() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from public.heritage_items where id = new.item_id and name like 'kit-test Neuspjeh%') then
          raise exception 'Forced link failure';
        end if;
        return new;
      end $$;
      create trigger kit_test_fail_item_source before insert on public.heritage_item_sources
        for each row execute function public.kit_test_fail_item_source();
    `)
    try {
      const slug = `kit-test-neuspjeh-${suffix}`
      const created = await api('/api/admin/content/heritage_item', { method: 'POST', body: item(`kit-test Neuspjeh ${suffix}`, slug) })
      expect(created.status).toBeGreaterThanOrEqual(400)
      expect(sql(`select count(*) from heritage_items where slug = '${slug}'`)).toBe('0')

      const draft = await api<{ entity: HeritageItem }>('/api/admin/content/heritage_item', {
        method: 'POST', body: item(`kit-test Uspjeh ${suffix}`, `kit-test-uspjeh-${suffix}`)
      })
      expect(draft.status, JSON.stringify(draft.body)).toBe(201)
      const id = draft.body.entity.id
      const before = sql(`select revision || ' ' || name from heritage_items where id = '${id}'`)
      const updated = await api(`/api/admin/content/heritage_item/${id}`, {
        method: 'PATCH',
        body: { revision: draft.body.entity.revision, name: `kit-test Neuspjeh ${suffix}`, sourceIds: [otherSource] }
      })
      expect(updated.status).toBeGreaterThanOrEqual(400)
      expect(sql(`select revision || ' ' || name from heritage_items where id = '${id}'`)).toBe(before)
      expect(sql(`select string_agg(source_id::text, ',') from heritage_item_sources where item_id = '${id}'`)).toBe(source)
      sql(`delete from heritage_items where id = '${id}'`)
    } finally {
      sql(`drop trigger kit_test_fail_item_source on public.heritage_item_sources; drop function public.kit_test_fail_item_source();`)
    }
  })
})
