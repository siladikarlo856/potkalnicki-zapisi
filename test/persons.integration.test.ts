import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import type { ContentList } from '../shared/utils/content/common'
import type { Person } from '../shared/utils/content/person'
import { validateSubmission } from '../shared/utils/submission'
import { setupNuxtServer } from './support/nuxtServer'

const url = process.env.TEST_CHALLENGE_API_URL
const key = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''
const SECRET = 'content-person-review-secret-0123456789'

if (url) await setupNuxtServer({ NUXT_SUPABASE_URL: url, NUXT_SUPABASE_SERVICE_ROLE_KEY: key, NUXT_REVIEW_SECRET: SECRET })

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

function failure(input: string) {
  try {
    sql(input)
    return ''
  } catch (error) {
    return String(error)
  }
}

async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown, auth?: boolean } = {}) {
  const headers: Record<string, string> = {}
  if (init.auth !== false) headers.authorization = `Bearer ${SECRET}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}

describe.skipIf(!url)('person content over real Postgres', () => {
  it('creates, publishes with ordered sidecars, refuses publish without sources, records slug history, accepts person submissions, denies anon', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const settlement = sql(`select id from areas where kind = 'settlement' and slug = 'apatovec' limit 1`)
    const settlementB = sql(`select id from areas where kind = 'settlement' and slug = 'miholec' limit 1`)
    const item = sql(`select id from heritage_items limit 1`)
    const sourceA = sql(`select id from sources limit 1 offset 0`)
    const sourceB = sql(`select id from sources limit 1 offset 1`)

    const draft = await api<{ entity: Person }>('/api/admin/content/person', {
      method: 'POST',
      body: {
        name: `kit-test Osoba ${suffix}`,
        slug: `kit-test-osoba-${suffix}`,
        died: '1. 1. 1900.',
        diedYear: 1900,
        clue: 'povijesna ličnost iz testa',
        verification: 'unverified',
        researchNotes: '',
        areaLinks: [
          { areaId: settlement, role: 'rodjen' },
          { areaId: settlementB, role: 'umro' }
        ],
        itemLinks: [{ itemId: item, relation: 'povezana kapela' }],
        sourceIds: [sourceA],
        status: 'draft'
      }
    })
    expect(draft.status, JSON.stringify(draft.body)).toBe(201)
    const id = draft.body.entity.id
    expect(sql(`select count(*) from person_areas where person_id = '${id}'`)).toBe('2')

    const noSource = await api(`/api/admin/content/person/${id}`, {
      method: 'PATCH',
      body: {
        ...draft.body.entity,
        revision: draft.body.entity.revision,
        status: 'published',
        sourceIds: []
      }
    })
    expect(noSource.status).toBe(400)

    const published = await api<{ entity: Person }>(`/api/admin/content/person/${id}`, {
      method: 'PATCH',
      body: {
        ...draft.body.entity,
        revision: draft.body.entity.revision,
        status: 'published',
        sourceIds: [sourceB, sourceA]
      }
    })
    expect(published.status).toBe(200)
    expect(published.body.entity.sourceIds).toEqual([sourceB, sourceA])
    expect(sql(`select count(*) from person_areas where person_id = '${id}'`)).toBe('2')
    expect(sql(`select count(*) from person_heritage_items where person_id = '${id}'`)).toBe('1')

    const newSlug = `${draft.body.entity.slug}-nova`
    const slugChange = await api<{ entity: Person }>(`/api/admin/content/person/${id}`, {
      method: 'PATCH',
      body: { ...published.body.entity, revision: published.body.entity.revision, slug: newSlug }
    })
    expect(slugChange.status).toBe(200)
    expect(sql(`select count(*) from content_slug_history where kind = 'person' and entity_id = '${id}' and slug = '${draft.body.entity.slug}'`)).toBe('1')

    const submission = validateSubmission({
      text: 'Prijedlog osobe',
      type: 'proposal',
      targetKind: 'person',
      payload: {
        name: `Predložena ${suffix}`,
        born: '1880.',
        died: '1950.',
        settlementId: settlement,
        significance: 'Važna za test',
        sourceUrl: 'https://example.com/osoba'
      },
      name: 'Test',
      consentPublish: true,
      locale: 'hr'
    })
    expect(submission.ok).toBe(true)

    expect(failure('set role anon; select count(*) from public.persons;')).toMatch(/permission denied/)

    sql(`delete from persons where id = '${id}'`)
  })

  it('lists persons in admin search', async () => {
    const listed = await api<ContentList<Person>>('/api/admin/content/person?q=kit-test')
    expect(listed.status).toBe(200)
    expect(Array.isArray(listed.body.rows)).toBe(true)
  })
})
