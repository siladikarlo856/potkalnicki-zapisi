import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'
import { DAILY_VILLAGE_SHARE, DailyWordError, dailyCacheControl, resolveDailyWord, villageAreaId } from '../server/utils/dailyWord'
import type { Area, WordEntry } from '../app/types/heritage'

// In-process tests of the resolver against the PostgREST fake. The HTTP route is a thin
// wrapper (see api.test.ts); the real constraints, trigger and key race run on Postgres in
// dailyWord.integration.test.ts.
const fake = await startFakeSupabase()
afterAll(() => fake.stop())
const client = createClient(fake.url, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const EPOCH = '2026-11-01'
const at = (day: string) => new Date(`${day}T10:00:00Z`)
const options = { epoch: EPOCH }
const areas: Area[] = [
  { id: 'county', name: 'Županija', kind: 'county', parentId: null },
  { id: 'vil-a', name: 'Selo A', kind: 'settlement', parentId: 'county' },
  { id: 'vil-b', name: 'Selo B', kind: 'municipality', parentId: 'county' }
]
// A word's areas are read from the areas table, not stored with the word.
fake.seedAreas(areas)

interface WordOptions {
  example?: boolean
  category?: boolean
  area?: string[]
  extraForm?: boolean
  distractors?: WordEntry['distractors']
  active?: boolean
  submissionPlace?: string
  meaning?: string
}
function entry(id: string, o: WordOptions = {}): WordEntry {
  return {
    id, headword: `riječ-${id}`, meaning: { hr: o.meaning ?? `značenje ${id}`, en: `meaning ${id}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    examples: o.example === false ? [] : [{ text: `Primjer za ${id}.`, translation: `Prijevod ${id}.` }],
    ...(o.category === false ? {} : { category: 'house' as const }),
    ...(o.distractors ? { distractors: o.distractors } : {}),
    variants: [
      { id: 'v1', form: `riječ-${id}`, status: 'community', usages: (o.area ?? []).map(areaId => ({ areaId, confidence: 'reported' as const })) },
      ...(o.extraForm ? [{ id: 'v2', form: `drugi-${id}`, status: 'community' as const, usages: [] }] : [])
    ]
  }
}
function addWord(id: string, o: WordOptions = {}) {
  const now = new Date().toISOString()
  fake.words.push({
    id, entry: entry(id, o), active: o.active ?? true,
    submission_id: 7, submission_place: o.submissionPlace ?? null, created_at: now, updated_at: now
  })
}
function words(count: number, prefix = 'w') {
  for (let i = 0; i < count; i++) addWord(`${prefix}${String(i).padStart(4, '0')}`)
}
function pin(day: string, wordId: string, village = 'auto') {
  const now = new Date().toISOString()
  fake.daily.push({ day, word_id: wordId, source: 'pinned', village, snapshot: null, resolved_at: null, replaced_word_ids: [], created_at: now, updated_at: now })
}
function rowFor(day: string) {
  return fake.daily.find(row => row.day === day)
}
const resolve = (day: string, extra: Parameters<typeof resolveDailyWord>[2] = {}) => resolveDailyWord(client, at(day), { ...options, ...extra })
const days = (from: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))

beforeEach(() => {
  fake.words.length = 0
  fake.daily.length = 0
})

describe('resolution and persistence', () => {
  it('answers 404 not-started before the epoch and writes nothing', async () => {
    words(6)
    await expect(resolveDailyWord(client, at('2026-10-31'), options)).rejects.toMatchObject({ statusCode: 404, message: 'not-started' })
    await expect(resolveDailyWord(client, at('2026-10-31'), options)).rejects.toBeInstanceOf(DailyWordError)
    expect(fake.daily).toHaveLength(0)
  })

  it('answers 404 no-words without active words, or when nothing can be played', async () => {
    await expect(resolve('2026-11-05')).rejects.toMatchObject({ statusCode: 404, message: 'no-words' })
    addWord('lone')
    await expect(resolve('2026-11-05')).rejects.toMatchObject({ message: 'no-words' })
    addWord('off', { active: false })
    await expect(resolve('2026-11-05')).rejects.toMatchObject({ message: 'no-words' })
    expect(fake.daily).toHaveLength(0)
  })

  it('returns the same word for repeated and concurrent calls and stores one row', async () => {
    words(12)
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => resolve('2026-11-05')))
    expect(new Set(concurrent.map(item => JSON.stringify(item))).size).toBe(1)
    expect(await resolve('2026-11-05')).toEqual(concurrent[0])
    expect(fake.daily).toHaveLength(1)
    expect(fake.daily[0]).toMatchObject({ day: '2026-11-05', source: 'auto', village: 'auto', replaced_word_ids: [] })
  })

  it('computes the same pick from the same pool, independent of insertion order', async () => {
    words(15)
    const first = await resolve('2026-11-05')
    fake.daily.length = 0
    fake.words.reverse()
    expect(await resolve('2026-11-05')).toEqual(first)
    fake.daily.length = 0
    const other = await resolve('2026-11-06')
    expect(other.day).toBe('2026-11-06')
  })

  it('never repeats a word before the pool is exhausted, then repeats the least recently used', async () => {
    words(6)
    const picked: string[] = []
    for (const day of days('2026-11-02', 6)) picked.push((await resolve(day)).entry.id)
    expect(new Set(picked).size).toBe(6)
    // Everything is used: the oldest day comes around first, then the next oldest.
    expect((await resolve('2026-11-08')).entry.id).toBe(picked[0])
    expect((await resolve('2026-11-09')).entry.id).toBe(picked[1])
    expect((await resolve('2026-11-10')).entry.id).toBe(picked[2])
  })

  it('does not auto-pick a word pinned to a future day, and serves it on that day', async () => {
    words(5)
    pin('2026-11-04', 'w0002')
    const first = [await resolve('2026-11-02'), await resolve('2026-11-03')]
    expect(first.map(item => item.entry.id)).not.toContain('w0002')
    const third = await resolve('2026-11-04')
    expect(third.entry.id).toBe('w0002')
    expect(rowFor('2026-11-04')).toMatchObject({ source: 'pinned', word_id: 'w0002' })
    expect(rowFor('2026-11-04')!.resolved_at).toBeTruthy()
    // The pinned word also stays out of the other days' draws.
    const rest = [await resolve('2026-11-05'), await resolve('2026-11-06')].map(item => item.entry.id)
    expect(rest).not.toContain('w0002')
  })

  it('may repeat a word that an admin pins again', async () => {
    words(4)
    const first = await resolve('2026-11-02')
    pin('2026-11-03', first.entry.id)
    expect((await resolve('2026-11-03')).entry.id).toBe(first.entry.id)
  })

  it('skips an inactive pin, picks another word and keeps an audit trail', async () => {
    words(5)
    addWord('gone', { active: false })
    pin('2026-11-02', 'gone')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const result = await resolve('2026-11-02')
    expect(result.entry.id).not.toBe('gone')
    expect(rowFor('2026-11-02')).toMatchObject({ source: 'auto', word_id: result.entry.id, replaced_word_ids: ['gone'] })
    expect(console.warn).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('replaces a word withdrawn during its day, once, and records it', async () => {
    words(8)
    const before = await resolve('2026-11-02')
    fake.words.find(word => word.id === before.entry.id)!.active = false
    const after = await resolve('2026-11-02')
    expect(after.entry.id).not.toBe(before.entry.id)
    expect(after.options.map(option => option.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(rowFor('2026-11-02')).toMatchObject({ word_id: after.entry.id, source: 'auto', replaced_word_ids: [before.entry.id] })
    expect(await resolve('2026-11-02')).toEqual(after)
    // The withdrawn word is used for no-repeat purposes even if it comes back.
    fake.words.find(word => word.id === before.entry.id)!.active = true
    const later = []
    for (const day of days('2026-11-03', 5)) later.push((await resolve(day)).entry.id)
    expect(later).not.toContain(before.entry.id)
  })

  it('fails closed on invalid active rows', async () => {
    words(5)
    fake.words.push({ id: 'broken', entry: { id: 'broken', headword: 'x', meaning: { hr: '' }, status: 'nope', variants: [], sources: [] }, active: true, submission_id: null, submission_place: null, created_at: '', updated_at: '' })
    const picked = new Set<string>()
    for (const day of days('2026-11-02', 5)) picked.add((await resolve(day)).entry.id)
    expect(picked.has('broken')).toBe(false)
  })

  it('reads every active word, not only the first hundred', async () => {
    words(130)
    // Only these are daily-ready; none is among the first 100 ids.
    for (let i = 0; i < 12; i++) addWord(`z${String(i).padStart(3, '0')}`)
    for (const word of fake.words.filter(item => String(item.id).startsWith('w'))) {
      (word.entry as WordEntry).examples = []
      delete (word.entry as WordEntry).category
    }
    const picked = (await resolve('2026-11-02')).entry.id
    expect(picked).toMatch(/^z/)
  })

  it('pages through the catalog past the 1000-row page size', async () => {
    words(1005)
    for (const word of fake.words.filter(item => item.id !== 'w1004')) {
      (word.entry as WordEntry).examples = []
    }
    // Only the very last word is ready (it keeps its example and category).
    expect((await resolve('2026-11-02')).entry.id).toBe('w1004')
  })

  it('settles a race by reading the winner back', async () => {
    words(6)
    fake.interceptNextDailyUpsert(() => {
      const now = new Date().toISOString()
      fake.daily.push({
        day: '2026-11-02', word_id: 'w0005', source: 'auto', village: 'auto', replaced_word_ids: [], created_at: now, updated_at: now,
        resolved_at: now,
        snapshot: { options: [{ id: 'a', text: { hr: 'winner' } }, { id: 'b', text: { hr: 'other' } }], correctOptionId: 'a', villageAreaId: null, clues: [] }
      })
    })
    const result = await resolve('2026-11-02')
    expect(result.entry.id).toBe('w0005')
    expect(result.options.map(option => option.text.hr)).toEqual(['winner', 'other'])
    expect(fake.daily).toHaveLength(1)
  })
})

describe('tiers, clues and options', () => {
  it('prefers daily-ready words and falls back to labelled substitute clues', async () => {
    words(6)
    for (const word of fake.words.filter(item => item.id !== 'w0003')) {
      (word.entry as WordEntry).examples = []
      delete (word.entry as WordEntry).category
    }
    const ready = await resolve('2026-11-02')
    expect(ready.entry.id).toBe('w0003')
    expect(ready.clues).toEqual([{ kind: 'example', text: 'Primjer za w0003.' }, { kind: 'category', category: 'house' }])
    // No ready words left: the fallback has no example and no category.
    const fallback = await resolve('2026-11-03')
    expect(fallback.entry.id).not.toBe('w0003')
    expect(fallback.clues).toEqual([{ kind: 'partOfSpeech', text: 'imenica' }, { kind: 'areas', areaIds: [] }])
    expect(JSON.stringify(fallback.clues)).not.toContain('Prijevod')
  })

  it('uses other forms for a missing example and word type for a missing category', async () => {
    addWord('solo', { example: false, category: false, extraForm: true })
    words(4)
    for (const word of fake.words.filter(item => item.id !== 'solo')) {
      (word.entry as WordEntry).examples = []
      delete (word.entry as WordEntry).category
    }
    const payload = await resolve('2026-11-02')
    expect(payload.entry.id).toBe('solo')
    expect(payload.clues).toEqual([{ kind: 'variants', forms: ['drugi-solo'] }, { kind: 'partOfSpeech', text: 'imenica' }])
  })

  it('never exposes the example translation as a clue', async () => {
    words(6)
    const payload = await resolve('2026-11-02')
    expect(JSON.stringify(payload.clues)).not.toContain('Prijevod')
  })

  it('builds four stable options with the answer among them', async () => {
    words(8)
    const payload = await resolve('2026-11-02')
    expect(payload.options.map(option => option.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(new Set(payload.options.map(option => option.text.hr)).size).toBe(4)
    const correct = payload.options.find(option => option.id === payload.correctOptionId)!
    expect(correct.text).toEqual({ hr: payload.entry.meaning.hr, en: payload.entry.meaning.en })
    expect(payload.clues).toHaveLength(2)
  })

  it('shrinks to fewer options and clues when the pool is tiny', async () => {
    addWord('one')
    addWord('two')
    const payload = await resolve('2026-11-02')
    expect(payload.options).toHaveLength(2)
    expect(payload.clues).toHaveLength(0)
  })

  it('uses hand-written wrong answers, filling the rest automatically', async () => {
    words(6)
    addWord('hand', { distractors: [{ hr: 'ručni jedan', en: 'hand one' }, { hr: 'ručni dva' }] })
    for (const word of fake.words.filter(item => item.id !== 'hand')) delete (word.entry as WordEntry).category
    const payload = await resolve('2026-11-02')
    expect(payload.entry.id).toBe('hand')
    const texts = payload.options.map(option => option.text)
    expect(texts).toContainEqual({ hr: 'ručni jedan', en: 'hand one' })
    expect(texts).toContainEqual({ hr: 'ručni dva' })
    expect(payload.options).toHaveLength(4)
  })

  it('freezes the options for the day even when words change', async () => {
    words(8)
    const before = await resolve('2026-11-02')
    const edited = fake.words.find(word => word.id === before.entry.id)!
    ;(edited.entry as WordEntry).meaning = { hr: 'promijenjeno' }
    fake.words.push({ ...fake.words[0]!, id: 'late', entry: entry('late'), active: true })
    const after = await resolve('2026-11-02')
    expect(after.options).toEqual(before.options)
    expect(after.correctOptionId).toBe(before.correctOptionId)
    expect(after.clues).toEqual(before.clues)
    // The reveal agrees with the frozen correct option rather than the edited entry.
    expect(after.entry.meaning).toEqual(before.entry.meaning)
    expect(after.options.find(option => option.id === after.correctOptionId)!.text.hr).toBe(after.entry.meaning.hr)
  })

  it('never repeats a word pinned for the future, even when nothing else is left', async () => {
    words(2)
    pin('2026-11-03', 'w0000')
    pin('2026-11-04', 'w0001')
    await expect(resolve('2026-11-02')).rejects.toMatchObject({ message: 'no-words' })
    expect(rowFor('2026-11-02')).toBeUndefined()
  })
})

describe('village words', () => {
  function villageSetup() {
    words(6)
    addWord('village-a', { area: ['vil-a'] })
    addWord('village-b', { area: ['vil-a'] })
    addWord('both', { area: ['vil-a', 'vil-b'] })
  }

  it('classifies a word as village-specific only when all usages map to one place', () => {
    expect(villageAreaId(entry('x', { area: ['vil-a'] }), areas)).toBe('vil-a')
    expect(villageAreaId(entry('x', { area: ['vil-a', 'vil-b'] }), areas)).toBeNull()
    expect(villageAreaId(entry('x', { area: ['county'] }), areas)).toBeNull()
    expect(villageAreaId(entry('x', { area: ['vil-a', 'county'] }), areas)).toBeNull()
    expect(villageAreaId(entry('x'), areas)).toBeNull()
    expect(DAILY_VILLAGE_SHARE).toBeCloseTo(1 / 7)
  })

  it('draws a village word when the share says so and a region word otherwise', async () => {
    villageSetup()
    const village = await resolve('2026-11-02', { villageShare: 1 })
    expect(village.entry.id).toMatch(/^village-/)
    expect(village.villageAreaId).toBe('vil-a')
    expect(village.areas.map(area => area.id)).toEqual(['county', 'vil-a'])
    const region = await resolve('2026-11-03', { villageShare: 0 })
    expect(region.entry.id).not.toMatch(/^village-/)
    expect(region.villageAreaId).toBeNull()
  })

  it('serves roughly one village word in seven by default', async () => {
    villageSetup()
    for (let i = 0; i < 60; i++) addWord(`region${i}`)
    for (let i = 0; i < 60; i++) addWord(`more-village${i}`, { area: ['vil-b'] })
    const villageDays = []
    for (const day of days('2026-11-02', 56)) villageDays.push((await resolve(day)).villageAreaId ? 1 : 0)
    const count = villageDays.reduce<number>((sum, value) => sum + value, 0)
    expect(count).toBeGreaterThan(2)
    expect(count).toBeLessThan(16)
  })

  it('honours a pin village override', async () => {
    villageSetup()
    pin('2026-11-02', 'village-a', 'none')
    pin('2026-11-03', 'both', 'vil-b')
    pin('2026-11-04', 'both', 'elsewhere')
    expect((await resolve('2026-11-02')).villageAreaId).toBeNull()
    const picked = await resolve('2026-11-03')
    expect(picked.villageAreaId).toBe('vil-b')
    // An area the word does not use is ignored rather than shown.
    expect((await resolve('2026-11-04')).villageAreaId).toBeNull()
  })
})

describe('public projection', () => {
  it('exposes exactly the documented fields and no private data', async () => {
    words(6)
    addWord('private', { submissionPlace: 'Tajno mjesto' })
    ;(fake.words.find(word => word.id === 'private')!.entry as Record<string, unknown>).secretNote = 'interno'
    for (const word of fake.words) {
      if (word.id !== 'private') delete (word.entry as WordEntry).category
    }
    const payload = await resolve('2026-11-02')
    expect(payload.entry.id).toBe('private')
    expect(Object.keys(payload).sort()).toEqual(['areas', 'clues', 'correctOptionId', 'day', 'entry', 'nextAt', 'number', 'options', 'sample', 'villageAreaId'])
    const json = JSON.stringify(payload)
    for (const forbidden of ['Tajno mjesto', 'submission', 'secretNote', 'created_at', 'updated_at', 'active', 'replaced']) {
      expect(json).not.toContain(forbidden)
    }
    expect(payload.sample).toBe(false)
  })

  it('numbers days from the epoch, flags samples and reports the next Zagreb midnight', async () => {
    words(6)
    for (const word of fake.words) (word.entry as WordEntry).status = 'placeholder'
    const first = await resolve('2026-11-01')
    expect(first.number).toBe(1)
    expect(first.sample).toBe(true)
    expect(first.nextAt).toBe('2026-11-01T23:00:00.000Z')
    expect((await resolve('2026-11-12')).number).toBe(12)
    // 2026-10-25 is a 25-hour day; start the epoch earlier to cover it.
    const dst = await resolveDailyWord(client, new Date('2026-10-25T12:00:00Z'), { epoch: '2026-10-01' })
    expect(dst.day).toBe('2026-10-25')
    expect(dst.nextAt).toBe('2026-10-25T23:00:00.000Z')
  })

  it('switches day at Zagreb midnight rather than UTC midnight', async () => {
    words(6)
    const lateUtc = await resolveDailyWord(client, new Date('2026-11-04T23:30:00Z'), options)
    expect(lateUtc.day).toBe('2026-11-05')
  })
})

describe('cache headers', () => {
  it('caches for at most 30 seconds and never past the end of the day', () => {
    const nextAt = '2026-11-05T23:00:00.000Z'
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T12:00:00Z'))).toBe('public, max-age=30, s-maxage=30, must-revalidate')
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T22:59:48Z'))).toBe('public, max-age=12, s-maxage=12, must-revalidate')
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T22:59:59.500Z'))).toBe('public, max-age=1, s-maxage=1, must-revalidate')
    expect(dailyCacheControl(nextAt, new Date('2026-11-05T23:00:00Z'))).toBe('public, max-age=0, s-maxage=0, must-revalidate')
  })
})
