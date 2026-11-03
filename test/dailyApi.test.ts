import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { addDays, zagrebDay } from '../shared/utils/dailyWord'
import type { Area, WordEntry } from '../app/types/heritage'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'

const fake = await startFakeSupabase()
afterAll(() => fake.stop())

await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
  server: true,
  setupTimeout: 300_000,
  env: {
    NUXT_SUPABASE_URL: fake.url,
    NUXT_SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    NUXT_DAILY_WORD_EPOCH: '2020-01-01'
  }
})

const areas: Area[] = [
  { id: 'county', name: 'Županija', kind: 'county', parentId: null },
  { id: 'vil-a', name: 'Selo A', kind: 'settlement', parentId: 'county' }
]
// A word's areas are read from the areas table, not stored with the word.
fake.seedAreas(areas)

function entry(id: string, meaning = `značenje ${id}`): WordEntry {
  return {
    id, headword: `riječ-${id}`, meaning: { hr: meaning, en: `meaning ${id}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    examples: [{ text: `Primjer za ${id}.`, translation: `Prijevod ${id}.` }],
    category: 'house',
    variants: [{ id: 'v1', form: `riječ-${id}`, status: 'community', usages: [{ areaId: 'vil-a', confidence: 'reported' }] }]
  }
}

function addWord(id: string, meaning?: string) {
  const now = new Date().toISOString()
  fake.words.push({
    id, entry: entry(id, meaning), active: true,
    submission_id: 7, submission_place: null, created_at: now, updated_at: now
  })
}

function seedWords(count: number, prefix = 'api') {
  for (let i = 0; i < count; i++) addWord(`${prefix}${String(i).padStart(4, '0')}`)
}

function pin(day: string, wordId: string) {
  const now = new Date().toISOString()
  fake.daily.push({
    day, word_id: wordId, source: 'pinned', village: 'auto', snapshot: null, resolved_at: null, replaced_word_ids: [], created_at: now, updated_at: now
  })
}

function dailyRequest() {
  return fetch('/api/heritage/daily', { headers: { 'x-forwarded-for': '203.0.113.88' } })
}

beforeEach(() => {
  fake.words.length = 0
  fake.daily.length = 0
})

describe('GET /api/heritage/daily after launch', () => {
  it('auto-picks once, returns identical JSON on repeat and concurrent calls', async () => {
    seedWords(12)
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => dailyRequest()))
    for (const response of concurrent) expect(response.status).toBe(200)
    const bodies = await Promise.all(concurrent.map(response => response.json()))
    expect(new Set(bodies.map(body => JSON.stringify(body))).size).toBe(1)
    const again = await dailyRequest()
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual(bodies[0])
    expect(fake.daily).toHaveLength(1)
    expect(fake.daily[0]).toMatchObject({ day: zagrebDay(new Date()), source: 'auto', village: 'auto', replaced_word_ids: [] })
  })

  it('returns 404 no-words when every active word is reserved by a future pin', async () => {
    addWord('api0000')
    addWord('api0001')
    const today = zagrebDay(new Date())
    pin(addDays(today, 1), 'api0000')
    pin(addDays(today, 2), 'api0001')
    const response = await dailyRequest()
    expect(response.status).toBe(404)
    expect(await response.text()).toContain('no-words')
    expect(fake.daily.find(row => row.day === today)).toBeUndefined()
  })

  it('keeps entry.meaning aligned with the frozen correct option after a catalog edit', async () => {
    seedWords(8)
    const first = await dailyRequest()
    expect(first.status).toBe(200)
    const before = await first.json()
    const stored = fake.words.find(word => word.id === before.entry.id)!
    ;(stored.entry as WordEntry).meaning = { hr: 'promijenjeno u katalogu' }
    const second = await dailyRequest()
    expect(second.status).toBe(200)
    const after = await second.json()
    expect(after.options).toEqual(before.options)
    expect(after.entry.meaning).toEqual(before.entry.meaning)
    expect(after.options.find((option: { id: string }) => option.id === after.correctOptionId)!.text.hr).toBe(after.entry.meaning.hr)
  })

  it('sets Cache-Control capped by 30 seconds and the end of the Zagreb day', async () => {
    seedWords(8)
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
