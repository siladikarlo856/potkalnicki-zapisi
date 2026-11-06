import { describe, expect, it } from 'vitest'
import type { ContentList } from '../shared/utils/content/common'
import type { HeritageCategory } from '../shared/utils/content/category'
import type { HeritageItem } from '../shared/utils/content/heritageItem'
import { integrationDb } from './support/integrationDb'

const SECRET = 'content-kit-review-secret-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, fetch } = db

async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = {}
  headers.authorization = `Bearer ${SECRET}`
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
})
