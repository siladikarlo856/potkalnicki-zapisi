import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { addDays, zagrebDay } from '../shared/utils/dailyWord'
import type { DailyAdminOverview, DailyPinResult } from '../shared/utils/dailyAdmin'
import type { Area, WordEntry } from '../app/types/heritage'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'

const SECRET = 'test-review-secret-0123456789'
const fake = await startFakeSupabase()
afterAll(() => fake.stop())

await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
  server: true,
  setupTimeout: 300_000,
  env: {
    NUXT_SUPABASE_URL: fake.url,
    NUXT_SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    NUXT_REVIEW_SECRET: SECRET
  }
})

const areas: Area[] = [
  { id: 'county', name: 'Županija', kind: 'county', parentId: null },
  { id: 'vil-a', name: 'Selo A', kind: 'settlement', parentId: 'county' }
]
const today = zagrebDay(new Date())
const day = (offset: number) => addDays(today, offset)

function entry(id: string, extra: Partial<WordEntry> = {}): WordEntry {
  return {
    id, headword: `riječ-${id}`, meaning: { hr: `značenje ${id}`, en: `meaning ${id}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    examples: [{ text: `Primjer za ${id}.`, translation: `Prijevod ${id}.` }],
    category: 'house',
    variants: [{ id: 'v1', form: `riječ-${id}`, status: 'community', usages: [{ areaId: 'vil-a', confidence: 'reported' }] }],
    ...extra
  }
}

function addWord(id: string, options: { active?: boolean, entry?: Partial<WordEntry> } = {}) {
  const now = new Date().toISOString()
  fake.words.push({
    id, entry: entry(id, options.entry), areas, active: options.active ?? true,
    submission_id: null, submission_place: null, created_at: now, updated_at: now
  })
}

/** Other words to draw wrong answers from, so the pinned word counts as fully daily-ready. */
function addFillers() {
  for (const id of ['f1', 'f2', 'f3']) addWord(id)
}

function row(date: string, wordId: string, extra: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  fake.daily.push({
    day: date, word_id: wordId, source: 'pinned', village: 'auto', snapshot: null, resolved_at: null, replaced_word_ids: [], created_at: now, updated_at: now, ...extra
  })
}

function resolved(date: string, wordId: string, extra: Record<string, unknown> = {}) {
  row(date, wordId, { source: 'auto', snapshot: { options: [], correctOptionId: 'a', villageAreaId: null, clues: [] }, resolved_at: `${date}T05:00:00.000Z`, ...extra })
}

let ipCounter = 0
function call(path: string, init: { method?: string, body?: unknown, secret?: string | null, ip?: string } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip ?? `198.51.100.${++ipCounter}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (init.secret !== null) headers.authorization = `Bearer ${init.secret ?? SECRET}`
  return fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
  })
}
const put = (date: string, body: unknown) => call(`/api/review/daily/${date}`, { method: 'PUT', body })
const remove = (date: string) => call(`/api/review/daily/${date}`, { method: 'DELETE' })
const overview = async () => await (await call('/api/review/daily')).json() as DailyAdminOverview

beforeEach(() => {
  fake.words.length = 0
  fake.daily.length = 0
})

describe('review daily authentication', () => {
  const routes = [
    { method: 'GET', path: '/api/review/daily' },
    { method: 'PUT', path: `/api/review/daily/${day(3)}`, body: { wordId: 'w1' } },
    { method: 'DELETE', path: `/api/review/daily/${day(3)}` }
  ]

  it.each(routes)('$method $path rejects a missing or wrong secret and changes nothing', async ({ method, path, body }) => {
    addWord('w1')
    row(day(3), 'w1')
    expect((await call(path, { method, body, secret: null })).status).toBe(401)
    expect((await call(path, { method, body, secret: 'wrong-secret-0123456789' })).status).toBe(401)
    expect(fake.daily).toHaveLength(1)
    expect(fake.daily[0]).toMatchObject({ day: day(3), word_id: 'w1' })
  })

  it('locks a client out of every daily route after too many wrong secrets', async () => {
    const ip = '203.0.113.200'
    for (let i = 0; i < 10; i++) expect((await call('/api/review/daily', { secret: 'guess', ip })).status).toBe(401)
    for (const { method, path, body } of routes) {
      expect((await call(path, { method, body, ip })).status).toBe(429)
    }
  })
})

describe('GET /api/review/daily', () => {
  it('reports today, recent days, pins, the runway and warnings', async () => {
    for (const id of ['w1', 'w2', 'w3', 'w4', 'w5']) addWord(id)
    addWord('off', { active: false })
    addWord('bare', { entry: { examples: [], category: undefined } })
    resolved(day(-2), 'w1')
    resolved(day(-1), 'w2', { replaced_word_ids: ['w3'] })
    resolved(today, 'w4', { source: 'pinned' })
    row(day(5), 'w5', { village: 'vil-a' })
    row(day(2), 'off')
    row(day(3), 'bare')

    const body = await overview()
    expect(body.day).toBe(today)
    expect(body.today).toMatchObject({ day: today, wordId: 'w4', headword: 'riječ-w4', source: 'pinned', resolved: true, replacedWordIds: [] })
    expect(body.recent.map(item => item.day)).toEqual([day(-1), day(-2)])
    expect(body.recent[0]).toMatchObject({ wordId: 'w2', replacedWordIds: ['w3'], source: 'auto' })
    expect(body.pins.map(item => [item.day, item.wordId, item.active, item.village])).toEqual([
      [day(2), 'off', false, 'auto'],
      [day(3), 'bare', true, 'auto'],
      [day(5), 'w5', true, 'vil-a']
    ])
    expect(body.pins[0]!.headword).toBe('riječ-off')
    // w1 w2 w3 w4 w5 and bare are active; w1, w2, w3 (replaced), w4 (today) and both pinned words are reserved.
    expect(body.runway).toEqual({ readyUnused: 0, unused: 0, active: 6, daysLeft: 2 })
    expect(body.warnings.map(w => w.code).sort()).toEqual(['pin-inactive', 'pin-not-ready', 'runway-short'])
    expect(body.warnings.find(w => w.code === 'pin-inactive')).toMatchObject({ day: day(2), wordId: 'off' })
    expect(body.warnings.find(w => w.code === 'pin-not-ready')!.message).toContain('primjer, kategorija')
  })

  it('counts all active words, not just the first hundred', async () => {
    for (let i = 0; i < 130; i++) addWord(`bulk${String(i).padStart(4, '0')}`)
    resolved(day(-1), 'bulk0000')
    const body = await overview()
    expect(body.today).toBeNull()
    expect(body.runway.active).toBe(130)
    expect(body.runway.unused).toBe(129)
    expect(body.warnings).toEqual([])
  })

  it('does not write a row for today', async () => {
    addWord('w1')
    await overview()
    expect(fake.daily).toHaveLength(0)
  })
})

describe('PUT /api/review/daily/[day]', () => {
  it('pins an active word for a future day', async () => {
    addWord('w1')
    addFillers()
    const response = await put(day(4), { wordId: 'w1', village: 'vil-a' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ day: day(4), wordId: 'w1', headword: 'riječ-w1', village: 'vil-a', source: 'pinned', warnings: [] })
    expect(fake.daily).toHaveLength(1)
    expect(fake.daily[0]).toMatchObject({ day: day(4), word_id: 'w1', source: 'pinned', village: 'vil-a', snapshot: null, resolved_at: null })
  })

  it('defaults the village to auto and replaces the word of an unresolved pin', async () => {
    addWord('w1')
    addWord('w2')
    expect((await put(day(4), { wordId: 'w1' })).status).toBe(200)
    expect(fake.daily[0]).toMatchObject({ word_id: 'w1', village: 'auto' })
    expect((await put(day(4), { wordId: 'w2', village: 'none' })).status).toBe(200)
    expect(fake.daily).toHaveLength(1)
    expect(fake.daily[0]).toMatchObject({ word_id: 'w2', village: 'none', source: 'pinned' })
  })

  it('accepts tomorrow and the last allowed day, and refuses beyond it', async () => {
    addWord('w1')
    addWord('w2')
    expect((await put(day(1), { wordId: 'w1' })).status).toBe(200)
    expect((await put(day(366), { wordId: 'w2' })).status).toBe(200)
    expect((await put(day(367), { wordId: 'w2' })).status).toBe(400)
    expect(fake.daily.map(r => r.day)).toEqual([day(1), day(366)])
  })

  it('refuses today and past days without touching their rows', async () => {
    addWord('w1')
    addWord('w2')
    resolved(today, 'w1')
    resolved(day(-1), 'w1')
    const before = JSON.stringify(fake.daily)
    for (const date of [today, day(-1), day(-400)]) {
      const response = await put(date, { wordId: 'w2' })
      expect(response.status).toBe(400)
      expect(await response.text()).toContain('Only future days')
    }
    expect(JSON.stringify(fake.daily)).toBe(before)
  })

  it('refuses malformed and impossible dates', async () => {
    addWord('w1')
    for (const date of ['tomorrow', '2030-02-30', '2030-1-5', '20300105']) {
      expect((await put(date, { wordId: 'w1' })).status).toBe(400)
    }
    expect(fake.daily).toHaveLength(0)
  })

  it('refuses inactive, unknown and invalid words', async () => {
    addWord('off', { active: false })
    addWord('w1')
    expect((await put(day(4), { wordId: 'off' })).status).toBe(400)
    expect((await put(day(4), { wordId: 'missing' })).status).toBe(404)
    for (const body of [{}, { wordId: 7 }, { wordId: 'bad id!' }, { wordId: 'w1', village: '' }, { wordId: 'w1', village: 4 }, null, []]) {
      expect((await put(day(4), body)).status).toBe(400)
    }
    expect((await put(day(4), { wordId: 'w1', village: 'elsewhere' })).status).toBe(400)
    expect((await put(day(4), { wordId: 'w1', village: 'county' })).status).toBe(200)
    expect((await put(day(5), 'not json')).status).toBe(400)
    expect(fake.daily).toHaveLength(1)
  })

  it('refuses an oversized body', async () => {
    addWord('w1')
    expect((await put(day(4), { wordId: 'w1', padding: 'x'.repeat(9000) })).status).toBe(413)
    expect(fake.daily).toHaveLength(0)
  })

  it('refuses a word that is already pinned for another future day', async () => {
    addWord('w1')
    expect((await put(day(4), { wordId: 'w1' })).status).toBe(200)
    const response = await put(day(6), { wordId: 'w1' })
    expect(response.status).toBe(409)
    expect(await response.text()).toContain('Word already pinned')
    expect(fake.daily.map(r => r.day)).toEqual([day(4)])
  })

  it('refuses a day whose row is already resolved', async () => {
    addWord('w1')
    addWord('w2')
    resolved(day(4), 'w1')
    expect((await put(day(4), { wordId: 'w2' })).status).toBe(409)
    expect(fake.daily[0]).toMatchObject({ word_id: 'w1' })
  })

  it('allows a previously used word and warns', async () => {
    addWord('w1')
    addWord('w2')
    addFillers()
    resolved(day(-10), 'w1')
    resolved(day(-3), 'w2', { replaced_word_ids: ['w1'] })
    const response = await put(day(4), { wordId: 'w1' })
    expect(response.status).toBe(200)
    const body = await response.json() as DailyPinResult
    expect(body.warnings).toEqual([expect.objectContaining({ code: 'previously-used', day: day(4), wordId: 'w1' })])
    expect(body.warnings[0]!.message).toContain(day(-3))
    expect(fake.daily.find(r => r.day === day(4))).toMatchObject({ word_id: 'w1' })
  })

  it('warns when the word lacks an example or category', async () => {
    addWord('bare', { entry: { examples: [], category: undefined } })
    const body = await (await put(day(4), { wordId: 'bare' })).json() as DailyPinResult
    expect(body.warnings.map(w => w.code)).toEqual(['pin-not-ready'])
  })
})

describe('DELETE /api/review/daily/[day]', () => {
  it('removes an unresolved pin', async () => {
    addWord('w1')
    row(day(4), 'w1')
    const response = await remove(day(4))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ day: day(4), removed: true })
    expect(fake.daily).toHaveLength(0)
  })

  it('answers 404 when nothing is pinned', async () => {
    expect((await remove(day(4))).status).toBe(404)
  })

  it('refuses today, past days and resolved rows', async () => {
    addWord('w1')
    resolved(today, 'w1')
    resolved(day(-1), 'w1')
    resolved(day(4), 'w1')
    for (const date of [today, day(-1)]) expect((await remove(date)).status).toBe(400)
    expect((await remove(day(4))).status).toBe(409)
    expect((await remove('2030-02-30')).status).toBe(400)
    expect(fake.daily).toHaveLength(3)
  })
})
