import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ContentList } from '../shared/utils/content/common'
import type { HeritageCategory } from '../shared/utils/content/category'
import type { HeritageItem } from '../shared/utils/content/heritageItem'

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

async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = {}
  headers.authorization = `Bearer ${SECRET}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

describe.skipIf(!url)('heritage admin content over real Postgres', () => {
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
