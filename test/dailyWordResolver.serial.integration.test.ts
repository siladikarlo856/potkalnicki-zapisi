import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { DailyWordError, resolveDailyWord } from '../server/utils/dailyWord'
import type { DailyRow } from '../server/utils/dailyWord'
import type { WordEntry } from '../app/types/heritage'
import { integrationDb } from './support/integrationDb'
import { ownDailyWordTables } from './helpers/dailyTables'
import { contentUuid } from './helpers/contentUuid'

// The resolver, in process, against Postgres: every test starts with no active word and no scheduled day
// (helpers/dailyTables.ts), so the pool is exactly the words it adds. The HTTP route is a thin wrapper
// (dailyApi.serial.integration.test.ts); the table's constraints and guard trigger are in dailyWord.integration.test.ts.
const db = await integrationDb()
const { sql } = db
const tables = ownDailyWordTables(db)
const client = db.service

const EPOCH = '2026-11-01'
const at = (day: string) => new Date(`${day}T10:00:00Z`)
const options = { epoch: EPOCH }

/** Word ids are UUIDs. `w`/`z` + a number keep their order, which is the order the catalogue is paged in. */
function wordId(name: string) {
  const ordered = /^([wz])(\d+)$/.exec(name)
  if (ordered) return `${ordered[1] === 'w' ? '1' : 'f'}0000000-0000-4000-8000-${ordered[2]!.padStart(12, '0')}`
  return contentUuid(`daily-resolver-test-word:${name}`)
}

// The file's own areas, under the seeded country: a county with a municipality and a town, and a settlement in the town.
const AREA = {
  county: contentUuid('daily-resolver-test-area:county'),
  town: contentUuid('daily-resolver-test-area:town'),
  vilA: contentUuid('daily-resolver-test-area:vil-a'),
  vilB: contentUuid('daily-resolver-test-area:vil-b'),
  elsewhere: contentUuid('daily-resolver-test-area:elsewhere')
}
let country = ''
beforeAll(() => {
  if (!db.enabled) return
  country = sql('select id from public.areas where kind = \'country\' order by id limit 1;')
  sql(`insert into public.areas (id, kind, parent_id, name) values
    ('${AREA.county}', 'county', '${country}', 'Županija'),
    ('${AREA.town}', 'town', '${AREA.county}', 'Grad'),
    ('${AREA.vilA}', 'settlement', '${AREA.town}', 'Selo A'),
    ('${AREA.vilB}', 'municipality', '${AREA.county}', 'Selo B')
    on conflict (id) do nothing;`)
})
afterAll(() => {
  if (!db.enabled) return
  const ids = `'${AREA.vilA}', '${AREA.vilB}', '${AREA.town}', '${AREA.county}'`
  // The words that use them first (ownDailyWordTables would delete them too, but its afterAll runs later).
  sql(`delete from public.heritage_words where id in (select word_id from public.heritage_word_areas where area_id in (${ids}));
    delete from public.areas where id in ('${AREA.vilA}', '${AREA.vilB}'); delete from public.areas where id = '${AREA.town}';
    delete from public.areas where id = '${AREA.county}';`)
})

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
function entry(name: string, o: WordOptions = {}): WordEntry {
  return {
    id: wordId(name), headword: `riječ-${name}`, meaning: { hr: o.meaning ?? `značenje ${name}`, en: `meaning ${name}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    examples: o.example === false ? [] : [{ text: `Primjer za ${name}.`, translation: `Prijevod ${name}.` }],
    ...(o.category === false ? {} : { category: 'house' as const }),
    ...(o.distractors ? { distractors: o.distractors } : {}),
    variants: [
      { id: 'v1', form: `riječ-${name}`, status: 'community', usages: (o.area ?? []).map(areaId => ({ areaId, confidence: 'reported' as const })) },
      ...(o.extraForm ? [{ id: 'v2', form: `drugi-${name}`, status: 'community' as const, usages: [] }] : [])
    ]
  }
}
const row = (name: string, o: WordOptions = {}) => ({ id: wordId(name), entry: entry(name, o), active: o.active ?? true, submission_place: o.submissionPlace ?? null })
async function insert(rows: Array<ReturnType<typeof row>>) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client.from('heritage_words').insert(rows.slice(i, i + 500))
    expect(error).toBeNull()
  }
}
const addWord = (name: string, o: WordOptions = {}) => insert([row(name, o)])
const names = (count: number, prefix = 'w') => Array.from({ length: count }, (_, i) => `${prefix}${String(i).padStart(4, '0')}`)
const words = (count: number, prefix = 'w') => insert(names(count, prefix).map(name => row(name)))
const lit = (value: unknown) => `'${JSON.stringify(value).replaceAll('\'', '\'\'')}'::jsonb`
/** Every active word except these loses its example and category, so only these stay daily-ready. */
function onlyReady(...keep: string[]) {
  sql(`update public.heritage_words set entry = (entry - 'category') || '{"examples":[]}'::jsonb
    where active and id not in (${keep.map(name => `'${wordId(name)}'`).join(',') || '\'\''});`)
}
function pin(day: string, name: string, village = 'auto') {
  sql(`insert into public.heritage_daily_words (day, word_id, source, village) values ('${day}', '${wordId(name)}', 'pinned', '${village}');`)
}
async function rowFor(day: string) {
  const { data, error } = await client.from('heritage_daily_words').select('*').eq('day', day)
  expect(error).toBeNull()
  return data![0] as DailyRow | undefined
}
const dailyCount = () => Number(sql('select count(*) from public.heritage_daily_words;'))
const resolve = (day: string, extra: Parameters<typeof resolveDailyWord>[2] = {}) => resolveDailyWord(client, at(day), { ...options, ...extra })
const days = (from: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))

describe.skipIf(!db.enabled)('resolution and persistence on Postgres', () => {
  it('answers 404 not-started before the epoch and writes nothing', async () => {
    await words(6)
    await expect(resolveDailyWord(client, at('2026-10-31'), options)).rejects.toMatchObject({ statusCode: 404, message: 'not-started' })
    await expect(resolveDailyWord(client, at('2026-10-31'), options)).rejects.toBeInstanceOf(DailyWordError)
    expect(dailyCount()).toBe(0)
  })

  it('answers 404 no-words without active words, or when nothing can be played', async () => {
    await expect(resolve('2026-11-05')).rejects.toMatchObject({ statusCode: 404, message: 'no-words' })
    await addWord('lone')
    await expect(resolve('2026-11-05')).rejects.toMatchObject({ message: 'no-words' })
    await addWord('off', { active: false })
    await expect(resolve('2026-11-05')).rejects.toMatchObject({ message: 'no-words' })
    expect(dailyCount()).toBe(0)
  })

  it('returns the same word for repeated and concurrent calls and stores one row', async () => {
    await words(12)
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => resolveDailyWord(db.client(), at('2026-11-05'), options)))
    expect(new Set(concurrent.map(item => JSON.stringify(item))).size).toBe(1)
    expect(await resolve('2026-11-05')).toEqual(concurrent[0])
    expect(dailyCount()).toBe(1)
    expect(await rowFor('2026-11-05')).toMatchObject({ day: '2026-11-05', source: 'auto', village: 'auto', replaced_word_ids: [] })
  })

  it('computes the same pick from the same pool, independent of insertion order', async () => {
    await words(15)
    const first = await resolve('2026-11-05')
    tables.reset()
    await insert(names(15).reverse().map(name => row(name)))
    expect(await resolve('2026-11-05')).toEqual(first)
    const other = await resolve('2026-11-06')
    expect(other.day).toBe('2026-11-06')
  })

  it('never repeats a word before the pool is exhausted, then repeats the least recently used', async () => {
    await words(6)
    const picked: string[] = []
    for (const day of days('2026-11-02', 6)) picked.push((await resolve(day)).entry.id)
    expect(new Set(picked).size).toBe(6)
    // Everything is used: the oldest day comes around first, then the next oldest.
    expect((await resolve('2026-11-08')).entry.id).toBe(picked[0])
    expect((await resolve('2026-11-09')).entry.id).toBe(picked[1])
    expect((await resolve('2026-11-10')).entry.id).toBe(picked[2])
  })

  it('does not auto-pick a word pinned to a future day, and serves it on that day', async () => {
    await words(5)
    pin('2026-11-04', 'w0002')
    const first = [await resolve('2026-11-02'), await resolve('2026-11-03')]
    expect(first.map(item => item.entry.id)).not.toContain(wordId('w0002'))
    const third = await resolve('2026-11-04')
    expect(third.entry.id).toBe(wordId('w0002'))
    expect(await rowFor('2026-11-04')).toMatchObject({ source: 'pinned', word_id: wordId('w0002') })
    expect((await rowFor('2026-11-04'))!.resolved_at).toBeTruthy()
    // The pinned word also stays out of the other days' draws.
    const rest = [await resolve('2026-11-05'), await resolve('2026-11-06')].map(item => item.entry.id)
    expect(rest).not.toContain(wordId('w0002'))
  })

  it('may repeat a word that an admin pins again', async () => {
    await words(4)
    const first = await resolve('2026-11-02')
    sql(`insert into public.heritage_daily_words (day, word_id, source) values ('2026-11-03', '${first.entry.id}', 'pinned');`)
    expect((await resolve('2026-11-03')).entry.id).toBe(first.entry.id)
  })

  it('skips an inactive pin, picks another word and keeps an audit trail', async () => {
    await words(5)
    await addWord('gone', { active: false })
    pin('2026-11-02', 'gone')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const result = await resolve('2026-11-02')
      expect(result.entry.id).not.toBe(wordId('gone'))
      expect(await rowFor('2026-11-02')).toMatchObject({ source: 'auto', word_id: result.entry.id, replaced_word_ids: [wordId('gone')] })
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('replaces a word withdrawn during its day, once, and records it', async () => {
    await words(8)
    const before = await resolve('2026-11-02')
    sql(`update public.heritage_words set active = false where id = '${before.entry.id}';`)
    const after = await resolve('2026-11-02')
    expect(after.entry.id).not.toBe(before.entry.id)
    expect(after.options.map(option => option.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(await rowFor('2026-11-02')).toMatchObject({ word_id: after.entry.id, source: 'auto', replaced_word_ids: [before.entry.id] })
    expect(await resolve('2026-11-02')).toEqual(after)
    // The withdrawn word is used for no-repeat purposes even if it comes back.
    sql(`update public.heritage_words set active = true where id = '${before.entry.id}';`)
    const later = []
    for (const day of days('2026-11-03', 5)) later.push((await resolve(day)).entry.id)
    expect(later).not.toContain(before.entry.id)
  })

  it('fails closed on invalid active rows', async () => {
    await words(5)
    // The database accepts it (its checks are structural), but the word model refuses the variant status.
    const broken = { ...entry('broken'), variants: [{ id: 'v1', form: 'riječ-broken', status: 'nope', usages: [] }] }
    expect((await client.from('heritage_words').insert({ id: wordId('broken'), entry: broken, active: true })).error).toBeNull()
    const picked = new Set<string>()
    for (const day of days('2026-11-02', 5)) picked.add((await resolve(day)).entry.id)
    expect(picked.has(wordId('broken'))).toBe(false)
    expect(picked.size).toBe(5)
  })

  it('reads every active word, not only the first hundred', async () => {
    await words(130)
    // Only these are daily-ready; their ids sort after all 130 others.
    const ready = names(12, 'z')
    await insert(ready.map(name => row(name)))
    onlyReady(...ready)
    const picked = (await resolve('2026-11-02')).entry.id
    expect(ready.map(wordId)).toContain(picked)
  })

  it('pages through the catalog past the 1000-row page size', async () => {
    await words(1005)
    // Only the very last word is ready (it keeps its example and category).
    onlyReady('w1004')
    expect((await resolve('2026-11-02')).entry.id).toBe(wordId('w1004'))
  })

  it('settles a race by reading the winner back', async () => {
    await words(6)
    const winner = { options: [{ id: 'a', text: { hr: 'winner' } }, { id: 'b', text: { hr: 'other' } }], correctOptionId: 'a', villageAreaId: null, clues: [] }
    // Another server writes the day just before this one's insert reaches the database.
    let raced = false
    const racing = createClient(db.url, db.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          if (!raced && init?.method === 'POST' && String(input).includes('heritage_daily_words')) {
            raced = true
            sql(`insert into public.heritage_daily_words (day, word_id, source, snapshot, resolved_at)
              values ('2026-11-02', '${wordId('w0005')}', 'auto', ${lit(winner)}, now());`)
          }
          return await fetch(input, init)
        }
      }
    })
    const result = await resolveDailyWord(racing, at('2026-11-02'), options)
    expect(raced).toBe(true)
    expect(result.entry.id).toBe(wordId('w0005'))
    expect(result.options.map(option => option.text.hr)).toEqual(['winner', 'other'])
    expect(dailyCount()).toBe(1)
  })
})

describe.skipIf(!db.enabled)('tiers, clues and options on Postgres', () => {
  it('prefers daily-ready words and falls back to labelled substitute clues', async () => {
    await words(6)
    onlyReady('w0003')
    const ready = await resolve('2026-11-02')
    expect(ready.entry.id).toBe(wordId('w0003'))
    expect(ready.clues).toEqual([{ kind: 'example', text: 'Primjer za w0003.' }, { kind: 'category', category: 'house' }])
    // No ready words left: the fallback has no example and no category.
    const fallback = await resolve('2026-11-03')
    expect(fallback.entry.id).not.toBe(wordId('w0003'))
    expect(fallback.clues).toEqual([{ kind: 'partOfSpeech', text: 'imenica' }, { kind: 'areas', areaIds: [] }])
    expect(JSON.stringify(fallback.clues)).not.toContain('Prijevod')
  })

  it('uses other forms for a missing example and word type for a missing category', async () => {
    await addWord('solo', { example: false, category: false, extraForm: true })
    await words(4)
    // No word is daily-ready, so the draw could land on any of them; the pin makes it this one.
    onlyReady()
    pin('2026-11-02', 'solo')
    const payload = await resolve('2026-11-02')
    expect(payload.entry.id).toBe(wordId('solo'))
    expect(payload.clues).toEqual([{ kind: 'variants', forms: ['drugi-solo'] }, { kind: 'partOfSpeech', text: 'imenica' }])
  })

  it('never exposes the example translation as a clue', async () => {
    await words(6)
    const payload = await resolve('2026-11-02')
    expect(JSON.stringify(payload.clues)).not.toContain('Prijevod')
  })

  it('builds four stable options with the answer among them', async () => {
    await words(8)
    const payload = await resolve('2026-11-02')
    expect(payload.options.map(option => option.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(new Set(payload.options.map(option => option.text.hr)).size).toBe(4)
    const correct = payload.options.find(option => option.id === payload.correctOptionId)!
    expect(correct.text).toEqual({ hr: payload.entry.meaning.hr, en: payload.entry.meaning.en })
    expect(payload.clues).toHaveLength(2)
  })

  it('shrinks to fewer options and clues when the pool is tiny', async () => {
    await addWord('one')
    await addWord('two')
    const payload = await resolve('2026-11-02')
    expect(payload.options).toHaveLength(2)
    expect(payload.clues).toHaveLength(0)
  })

  it('uses hand-written wrong answers, filling the rest automatically', async () => {
    await words(6)
    await addWord('hand', { distractors: [{ hr: 'ručni jedan', en: 'hand one' }, { hr: 'ručni dva' }] })
    sql(`update public.heritage_words set entry = entry - 'category' where active and id <> '${wordId('hand')}';`)
    const payload = await resolve('2026-11-02')
    expect(payload.entry.id).toBe(wordId('hand'))
    const texts = payload.options.map(option => option.text)
    expect(texts).toContainEqual({ hr: 'ručni jedan', en: 'hand one' })
    expect(texts).toContainEqual({ hr: 'ručni dva' })
    expect(payload.options).toHaveLength(4)
  })

  it('freezes the options for the day even when words change', async () => {
    await words(8)
    const before = await resolve('2026-11-02')
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{meaning}', '{"hr":"promijenjeno"}') where id = '${before.entry.id}';`)
    await addWord('late')
    const after = await resolve('2026-11-02')
    expect(after.options).toEqual(before.options)
    expect(after.correctOptionId).toBe(before.correctOptionId)
    expect(after.clues).toEqual(before.clues)
    // The reveal agrees with the frozen correct option rather than the edited entry.
    expect(after.entry.meaning).toEqual(before.entry.meaning)
    expect(after.options.find(option => option.id === after.correctOptionId)!.text.hr).toBe(after.entry.meaning.hr)
  })

  it('never repeats a word pinned for the future, even when nothing else is left', async () => {
    await words(2)
    pin('2026-11-03', 'w0000')
    pin('2026-11-04', 'w0001')
    await expect(resolve('2026-11-02')).rejects.toMatchObject({ message: 'no-words' })
    expect(await rowFor('2026-11-02')).toBeUndefined()
  })
})

describe.skipIf(!db.enabled)('village words on Postgres', () => {
  async function villageSetup() {
    await words(6)
    await addWord('village-a', { area: [AREA.vilA] })
    await addWord('village-b', { area: [AREA.vilA] })
    await addWord('both', { area: [AREA.vilA, AREA.vilB] })
  }
  const villageIds = () => [wordId('village-a'), wordId('village-b')]

  it('draws a village word when the share says so and a region word otherwise', async () => {
    await villageSetup()
    const village = await resolve('2026-11-02', { villageShare: 1 })
    expect(villageIds()).toContain(village.entry.id)
    expect(village.villageAreaId).toBe(AREA.vilA)
    // The areas the word points at, with their ancestors, parents first.
    expect(village.areas.map(area => area.id)).toEqual([country, AREA.county, AREA.town, AREA.vilA])
    const region = await resolve('2026-11-03', { villageShare: 0 })
    expect(villageIds()).not.toContain(region.entry.id)
    expect(region.villageAreaId).toBeNull()
  })

  it('serves roughly one village word in seven by default', async () => {
    await villageSetup()
    await insert(Array.from({ length: 60 }, (_, i) => row(`region${i}`)))
    await insert(Array.from({ length: 60 }, (_, i) => row(`more-village${i}`, { area: [AREA.vilB] })))
    const villageDays = []
    for (const day of days('2026-11-02', 56)) villageDays.push((await resolve(day)).villageAreaId ? 1 : 0)
    const count = villageDays.reduce<number>((sum, value) => sum + value, 0)
    expect(count).toBeGreaterThan(2)
    expect(count).toBeLessThan(16)
  })

  it('honours a pin village override', async () => {
    await villageSetup()
    pin('2026-11-02', 'village-a', 'none')
    pin('2026-11-03', 'both', AREA.vilB)
    pin('2026-11-04', 'both', AREA.elsewhere)
    expect((await resolve('2026-11-02')).villageAreaId).toBeNull()
    const picked = await resolve('2026-11-03')
    expect(picked.villageAreaId).toBe(AREA.vilB)
    // An area the word does not use is ignored rather than shown.
    expect((await resolve('2026-11-04')).villageAreaId).toBeNull()
  })
})

describe.skipIf(!db.enabled)('public projection on Postgres', () => {
  it('exposes exactly the documented fields and no private data', async () => {
    await words(6)
    await addWord('private', { submissionPlace: 'Tajno mjesto' })
    sql(`update public.heritage_words set entry = entry || '{"secretNote":"interno"}'::jsonb where id = '${wordId('private')}';`)
    sql(`update public.heritage_words set entry = entry - 'category' where active and id <> '${wordId('private')}';`)
    const payload = await resolve('2026-11-02')
    expect(payload.entry.id).toBe(wordId('private'))
    expect(Object.keys(payload).sort()).toEqual(['areas', 'clues', 'correctOptionId', 'day', 'entry', 'nextAt', 'number', 'options', 'sample', 'villageAreaId'])
    const json = JSON.stringify(payload)
    for (const forbidden of ['Tajno mjesto', 'submission', 'secretNote', 'created_at', 'updated_at', 'active', 'replaced']) {
      expect(json).not.toContain(forbidden)
    }
    expect(payload.sample).toBe(false)
  })

  it('numbers days from the epoch, flags samples and reports the next Zagreb midnight', async () => {
    await words(6)
    sql('update public.heritage_words set entry = jsonb_set(entry, \'{status}\', \'"placeholder"\') where active;')
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
    await words(6)
    const lateUtc = await resolveDailyWord(client, new Date('2026-11-04T23:30:00Z'), options)
    expect(lateUtc.day).toBe('2026-11-05')
  })
})
