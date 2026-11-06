import { describe, expect, it } from 'vitest'
import { addDays, zagrebDay } from '../shared/utils/dailyWord'
import type { WordEntry } from '../app/types/heritage'
import { integrationDb } from './support/integrationDb'
import { ownDailyWordTables } from './helpers/dailyTables'
import { contentUuid } from './helpers/contentUuid'

// GET /api/heritage/daily through the server, on Postgres. Every test starts with no active word and no scheduled
// day (helpers/dailyTables.ts); the resolver's rules are in dailyWordResolver.serial.integration.test.ts.
const db = await integrationDb({ server: { NUXT_DAILY_WORD_EPOCH: '2020-01-01' } })
const { sql, fetch } = db
ownDailyWordTables(db)

// A seeded area (the town of Križevci); a usage needs a row in the areas table to be public.
const AREA = contentUuid('area:krizevci')
const wordId = (name: string) => contentUuid(`daily-api-test-word:${name}`)

function entry(name: string): WordEntry {
  return {
    id: wordId(name), headword: `riječ-${name}`, meaning: { hr: `značenje ${name}`, en: `meaning ${name}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    examples: [{ text: `Primjer za ${name}.`, translation: `Prijevod ${name}.` }],
    category: 'house',
    variants: [{ id: 'v1', form: `riječ-${name}`, status: 'community', usages: [{ areaId: AREA, confidence: 'reported' }] }]
  }
}

async function addWords(...names: string[]) {
  const { error } = await db.service.from('heritage_words').insert(names.map(name => ({ id: wordId(name), entry: entry(name), active: true })))
  expect(error).toBeNull()
}

const seedWords = (count: number) => addWords(...Array.from({ length: count }, (_, i) => `api${String(i).padStart(4, '0')}`))

function pin(day: string, name: string) {
  sql(`insert into public.heritage_daily_words (day, word_id, source) values ('${day}', '${wordId(name)}', 'pinned');`)
}

async function dailyRows() {
  const { data, error } = await db.service.from('heritage_daily_words').select('*')
  expect(error).toBeNull()
  return data!
}

function dailyRequest() {
  return fetch('/api/heritage/daily', { headers: { 'x-forwarded-for': '203.0.113.88' } })
}

describe.skipIf(!db.enabled)('GET /api/heritage/daily after launch', () => {
  it('auto-picks once, returns identical JSON on repeat and concurrent calls', async () => {
    await seedWords(12)
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => dailyRequest()))
    for (const response of concurrent) expect(response.status).toBe(200)
    const bodies = await Promise.all(concurrent.map(response => response.json()))
    expect(new Set(bodies.map(body => JSON.stringify(body))).size).toBe(1)
    const again = await dailyRequest()
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual(bodies[0])
    const rows = await dailyRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ day: zagrebDay(new Date()), source: 'auto', village: 'auto', replaced_word_ids: [] })
  })

  it('returns 404 no-words when every active word is reserved by a future pin', async () => {
    await addWords('api0000', 'api0001')
    const today = zagrebDay(new Date())
    pin(addDays(today, 1), 'api0000')
    pin(addDays(today, 2), 'api0001')
    const response = await dailyRequest()
    expect(response.status).toBe(404)
    expect(await response.text()).toContain('no-words')
    expect((await dailyRows()).find(row => row.day === today)).toBeUndefined()
  })

  it('keeps entry.meaning aligned with the frozen correct option after a catalog edit', async () => {
    await seedWords(8)
    const first = await dailyRequest()
    expect(first.status).toBe(200)
    const before = await first.json()
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{meaning}', '{"hr":"promijenjeno u katalogu"}') where id = '${before.entry.id}';`)
    const second = await dailyRequest()
    expect(second.status).toBe(200)
    const after = await second.json()
    expect(after.options).toEqual(before.options)
    expect(after.entry.meaning).toEqual(before.entry.meaning)
    expect(after.options.find((option: { id: string }) => option.id === after.correctOptionId)!.text.hr).toBe(after.entry.meaning.hr)
  })

  it('sets Cache-Control capped by 30 seconds and the end of the Zagreb day', async () => {
    await seedWords(8)
    const response = await dailyRequest()
    expect(response.status).toBe(200)
    const payload = await response.json()
    const cacheControl = response.headers.get('cache-control') ?? ''
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1])
    const secondsUntilMidnight = Math.max(0, Math.ceil((Date.parse(payload.nextAt) - Date.now()) / 1000))
    expect(cacheControl).toBe(`public, max-age=${maxAge}, s-maxage=${maxAge}, must-revalidate`)
    expect(maxAge).toBeLessThanOrEqual(30)
    expect(maxAge).toBeLessThanOrEqual(secondsUntilMidnight)
  })
})
