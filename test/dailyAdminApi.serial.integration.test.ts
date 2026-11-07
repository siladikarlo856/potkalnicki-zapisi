import { describe, expect, it } from 'vitest'
import { addDays, zagrebDay } from '../shared/utils/dailyWord'
import type { DailyAdminOverview, DailyPinResult } from '../shared/utils/dailyAdmin'
import type { WordEntry } from '../app/types/heritage'
import { integrationDb } from './support/integrationDb'
import { ownDailyWordTables } from './helpers/dailyTables'
import { contentUuid } from './helpers/contentUuid'

// The daily word admin API through the server, on Postgres. Every test starts with no active word and no
// scheduled day (helpers/dailyTables.ts), so the overview and runway count only the words a test adds.
const SECRET = 'test-review-secret-0123456789'
const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET } })
const { sql, fetch } = db
ownDailyWordTables(db)

// A seeded area (the town of Križevci) and its county; a word's areas are read from the areas table.
const TOWN = contentUuid('area:krizevci')
const COUNTY = db.enabled ? sql(`select parent_id from public.areas where id = '${TOWN}';`) : ''
const today = zagrebDay(new Date())
const day = (offset: number) => addDays(today, offset)
/** Word ids are UUIDs; tests name their words. */
const W = (name: string) => contentUuid(`daily-admin-test-word:${name}`)

function entry(name: string, extra: Partial<WordEntry> = {}): WordEntry {
  return {
    id: W(name), headword: `riječ-${name}`, meaning: { hr: `značenje ${name}`, en: `meaning ${name}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    examples: [{ text: `Primjer za ${name}.`, translation: `Prijevod ${name}.` }],
    category: 'house',
    variants: [{ id: 'v1', form: `riječ-${name}`, status: 'community', usages: [{ areaId: TOWN, confidence: 'reported' }] }],
    ...extra
  }
}

async function addWords(names: string[], options: { active?: boolean, entry?: Partial<WordEntry> } = {}) {
  const rows = names.map(name => ({ id: W(name), entry: JSON.parse(JSON.stringify(entry(name, options.entry))), active: options.active ?? true }))
  const { error } = await db.service.from('heritage_words').insert(rows)
  expect(error).toBeNull()
}
const addWord = (name: string, options: { active?: boolean, entry?: Partial<WordEntry> } = {}) => addWords([name], options)

/** Other words to draw wrong answers from, so the pinned word counts as fully daily-ready. */
const addFillers = () => addWords(['f1', 'f2', 'f3'])

async function row(date: string, name: string, extra: Record<string, unknown> = {}) {
  const { error } = await db.service.from('heritage_daily_words').insert({ day: date, word_id: W(name), source: 'pinned', village: 'auto', ...extra })
  expect(error).toBeNull()
}

function resolved(date: string, name: string, extra: Record<string, unknown> = {}) {
  return row(date, name, { source: 'auto', snapshot: { options: [], correctOptionId: 'a', villageAreaId: null, clues: [] }, resolved_at: `${date}T05:00:00.000Z`, ...extra })
}

async function daily() {
  const { data, error } = await db.service.from('heritage_daily_words').select('*').order('day')
  expect(error).toBeNull()
  return data!
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

describe.skipIf(!db.enabled)('review daily authentication', () => {
  const routes = [
    { method: 'GET', path: '/api/review/daily' },
    { method: 'PUT', path: `/api/review/daily/${day(3)}`, body: { wordId: W('w1') } },
    { method: 'DELETE', path: `/api/review/daily/${day(3)}` }
  ]

  it.each(routes)('$method $path rejects a missing or wrong secret and changes nothing', async ({ method, path, body }) => {
    await addWord('w1')
    await row(day(3), 'w1')
    expect((await call(path, { method, body, secret: null })).status).toBe(401)
    expect((await call(path, { method, body, secret: 'wrong-secret-0123456789' })).status).toBe(401)
    expect((await daily())).toHaveLength(1)
    expect((await daily())[0]).toMatchObject({ day: day(3), word_id: W('w1') })
  })

  it('locks a client out of every daily route after too many wrong secrets', async () => {
    const ip = '203.0.113.200'
    for (let i = 0; i < 10; i++) expect((await call('/api/review/daily', { secret: 'guess', ip })).status).toBe(401)
    for (const { method, path, body } of routes) {
      expect((await call(path, { method, body, ip })).status).toBe(429)
    }
  })
})

describe.skipIf(!db.enabled)('GET /api/review/daily', () => {
  it('reports today, recent days, pins, the runway and warnings', async () => {
    await addWords(['w1', 'w2', 'w3', 'w4', 'w5'])
    await addWord('off', { active: false })
    await addWord('bare', { entry: { examples: [], category: undefined } })
    await resolved(day(-2), 'w1')
    await resolved(day(-1), 'w2', { replaced_word_ids: [W('w3')] })
    await resolved(today, 'w4', { source: 'pinned' })
    await row(day(5), 'w5', { village: TOWN })
    await row(day(2), 'off')
    await row(day(3), 'bare')

    const body = await overview()
    expect(body.day).toBe(today)
    expect(body.today).toMatchObject({ day: today, wordId: W('w4'), headword: 'riječ-w4', source: 'pinned', resolved: true, replacedWordIds: [] })
    expect(body.recent.map(item => item.day)).toEqual([day(-1), day(-2)])
    expect(body.recent[0]).toMatchObject({ wordId: W('w2'), replacedWordIds: [W('w3')], source: 'auto' })
    expect(body.pins.map(item => [item.day, item.wordId, item.active, item.village])).toEqual([
      [day(2), W('off'), false, 'auto'],
      [day(3), W('bare'), true, 'auto'],
      [day(5), W('w5'), true, TOWN]
    ])
    expect(body.pins[0]!.headword).toBe('riječ-off')
    // w1 w2 w3 w4 w5 and bare are active; w1, w2, w3 (replaced), w4 (today) and both pinned words are reserved.
    expect(body.runway).toEqual({ readyUnused: 0, unused: 0, active: 6, daysLeft: 2 })
    expect(body.warnings.map(w => w.code).sort()).toEqual(['pin-inactive', 'pin-not-ready', 'runway-short'])
    expect(body.warnings.find(w => w.code === 'pin-inactive')).toMatchObject({ day: day(2), wordId: W('off') })
    expect(body.warnings.find(w => w.code === 'pin-not-ready')!.message).toContain('primjer, kategorija')
  })

  it('counts all active words, not just the first hundred', async () => {
    await addWords(Array.from({ length: 130 }, (_, i) => `bulk${String(i).padStart(4, '0')}`))
    await resolved(day(-1), 'bulk0000')
    const body = await overview()
    expect(body.today).toBeNull()
    expect(body.runway.active).toBe(130)
    expect(body.runway.unused).toBe(129)
    expect(body.warnings).toEqual([])
  })

  it('does not write a row for today', async () => {
    await addWord('w1')
    await overview()
    expect((await daily())).toHaveLength(0)
  })
})

describe.skipIf(!db.enabled)('PUT /api/review/daily/[day]', () => {
  it('pins an active word for a future day', async () => {
    await addWord('w1')
    await addFillers()
    const response = await put(day(4), { wordId: W('w1'), village: TOWN })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ day: day(4), wordId: W('w1'), headword: 'riječ-w1', village: TOWN, source: 'pinned', warnings: [] })
    expect((await daily())).toHaveLength(1)
    expect((await daily())[0]).toMatchObject({ day: day(4), word_id: W('w1'), source: 'pinned', village: TOWN, snapshot: null, resolved_at: null })
  })

  it('defaults the village to auto and replaces the word of an unresolved pin', async () => {
    await addWord('w1')
    await addWord('w2')
    expect((await put(day(4), { wordId: W('w1') })).status).toBe(200)
    expect((await daily())[0]).toMatchObject({ word_id: W('w1'), village: 'auto' })
    expect((await put(day(4), { wordId: W('w2'), village: 'none' })).status).toBe(200)
    expect((await daily())).toHaveLength(1)
    expect((await daily())[0]).toMatchObject({ word_id: W('w2'), village: 'none', source: 'pinned' })
  })

  it('accepts tomorrow and the last allowed day, and refuses beyond it', async () => {
    await addWord('w1')
    await addWord('w2')
    expect((await put(day(1), { wordId: W('w1') })).status).toBe(200)
    expect((await put(day(366), { wordId: W('w2') })).status).toBe(200)
    expect((await put(day(367), { wordId: W('w2') })).status).toBe(400)
    expect((await daily()).map(r => r.day)).toEqual([day(1), day(366)])
  })

  it('refuses today and past days without touching their rows', async () => {
    await addWord('w1')
    await addWord('w2')
    await resolved(today, 'w1')
    await resolved(day(-1), 'w1')
    const before = JSON.stringify(await daily())
    for (const date of [today, day(-1), day(-400)]) {
      const response = await put(date, { wordId: W('w2') })
      expect(response.status).toBe(400)
      expect(await response.text()).toContain('Only future days')
    }
    expect(JSON.stringify(await daily())).toBe(before)
  })

  it('refuses malformed and impossible dates', async () => {
    await addWord('w1')
    for (const date of ['tomorrow', '2030-02-30', '2030-1-5', '20300105']) {
      expect((await put(date, { wordId: W('w1') })).status).toBe(400)
    }
    expect((await daily())).toHaveLength(0)
  })

  it('refuses inactive, unknown and invalid words', async () => {
    await addWord('off', { active: false })
    await addWord('w1')
    expect((await put(day(4), { wordId: W('off') })).status).toBe(400)
    expect((await put(day(4), { wordId: 'missing' })).status).toBe(404)
    for (const body of [{}, { wordId: 7 }, { wordId: 'bad id!' }, { wordId: W('w1'), village: '' }, { wordId: W('w1'), village: 4 }, null, []]) {
      expect((await put(day(4), body)).status).toBe(400)
    }
    expect((await put(day(4), { wordId: W('w1'), village: 'elsewhere' })).status).toBe(400)
    expect((await put(day(4), { wordId: W('w1'), village: COUNTY })).status).toBe(200)
    expect((await put(day(5), 'not json')).status).toBe(400)
    expect((await daily())).toHaveLength(1)
  })

  it('refuses an oversized body', async () => {
    await addWord('w1')
    expect((await put(day(4), { wordId: W('w1'), padding: 'x'.repeat(9000) })).status).toBe(413)
    expect((await daily())).toHaveLength(0)
  })

  it('refuses a word that is already pinned for another future day', async () => {
    await addWord('w1')
    expect((await put(day(4), { wordId: W('w1') })).status).toBe(200)
    const response = await put(day(6), { wordId: W('w1') })
    expect(response.status).toBe(409)
    expect(await response.text()).toContain('Word already pinned')
    expect((await daily()).map(r => r.day)).toEqual([day(4)])
  })

  it('refuses a day whose row is already resolved', async () => {
    await addWord('w1')
    await addWord('w2')
    await resolved(day(4), 'w1')
    expect((await put(day(4), { wordId: W('w2') })).status).toBe(409)
    expect((await daily())[0]).toMatchObject({ word_id: W('w1') })
  })

  it('allows a previously used word and warns', async () => {
    await addWord('w1')
    await addWord('w2')
    await addFillers()
    await resolved(day(-10), 'w1')
    await resolved(day(-3), 'w2', { replaced_word_ids: [W('w1')] })
    const response = await put(day(4), { wordId: W('w1') })
    expect(response.status).toBe(200)
    const body = await response.json() as DailyPinResult
    expect(body.warnings).toEqual([expect.objectContaining({ code: 'previously-used', day: day(4), wordId: W('w1') })])
    expect(body.warnings[0]!.message).toContain(day(-3))
    expect((await daily()).find(r => r.day === day(4))).toMatchObject({ word_id: W('w1') })
  })

  it('warns when the word lacks an example or category', async () => {
    await addWord('bare', { entry: { examples: [], category: undefined } })
    const body = await (await put(day(4), { wordId: W('bare') })).json() as DailyPinResult
    expect(body.warnings.map(w => w.code)).toEqual(['pin-not-ready'])
  })
})

describe.skipIf(!db.enabled)('DELETE /api/review/daily/[day]', () => {
  it('removes an unresolved pin', async () => {
    await addWord('w1')
    await row(day(4), 'w1')
    const response = await remove(day(4))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ day: day(4), removed: true })
    expect((await daily())).toHaveLength(0)
  })

  it('answers 404 when nothing is pinned', async () => {
    expect((await remove(day(4))).status).toBe(404)
  })

  it('refuses today, past days and resolved rows', async () => {
    await addWord('w1')
    await resolved(today, 'w1')
    await resolved(day(-1), 'w1')
    await resolved(day(4), 'w1')
    for (const date of [today, day(-1)]) expect((await remove(date)).status).toBe(400)
    expect((await remove(day(4))).status).toBe(409)
    expect((await remove('2030-02-30')).status).toBe(400)
    expect((await daily())).toHaveLength(3)
  })
})
