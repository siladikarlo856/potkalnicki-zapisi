import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { resolveDailyWord } from '../server/utils/dailyWord'

// Run with `node scripts/test-challenges.mjs`, which provisions a disposable Postgres and
// PostgREST, applies every migration and removes both afterwards. Skipped everywhere else.
// Words are added with the `daily-test-` prefix, and only those are ever deactivated, so the
// seed words used by the challenge tests are left alone.
const url = process.env.TEST_CHALLENGE_API_URL
const serviceKey = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const publicKey = process.env.TEST_CHALLENGE_PUBLIC_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
function failure(input: string) {
  try {
    sql(input)
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error)
  }
  throw new Error(`Expected the statement to fail: ${input}`)
}
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(url ?? 'http://localhost', serviceKey || 'service', options)
const snapshot = (tag: string) => `'${JSON.stringify({ options: [{ id: 'a', text: { hr: tag } }, { id: 'b', text: { hr: 'drugo' } }], correctOptionId: 'a', villageAreaId: null, clues: [] })}'::jsonb`

function entry(id: string) {
  return {
    id, headword: `riječ-${id}`, meaning: { hr: `značenje ${id}` }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }], examples: [{ text: `Primjer ${id}.` }], category: 'house',
    variants: [{ id: 'v1', form: `riječ-${id}`, status: 'community', usages: [] }]
  }
}
async function addWords(prefix: string, count: number) {
  const ids = Array.from({ length: count }, (_, i) => `daily-test-${prefix}-${i}`)
  const { error } = await service.from('heritage_words').insert(ids.map(id => ({ id, entry: entry(id), areas: [], active: true })))
  expect(error).toBeNull()
  return ids
}
const clientFor = () => createClient(url ?? 'http://localhost', serviceKey || 'service', options)

describe.skipIf(!url)('heritage_daily_words on Postgres', () => {
  it('denies every public role, in SQL and through PostgREST', async () => {
    await addWords('rls', 1)
    for (const role of ['anon', 'authenticated']) {
      for (const statement of [
        'select count(*) from public.heritage_daily_words',
        'insert into public.heritage_daily_words(day, word_id, source) values (\'2031-02-01\', \'daily-test-rls-0\', \'auto\')',
        'update public.heritage_daily_words set village = \'none\'',
        'delete from public.heritage_daily_words'
      ]) expect(failure(`set role ${role}; ${statement};`)).toMatch(/permission denied/)
    }
    const anon = createClient(url!, publicKey, options)
    expect((await anon.from('heritage_daily_words').select('*')).error).not.toBeNull()
    expect((await anon.from('heritage_daily_words').insert({ day: '2031-02-01', word_id: 'daily-test-rls-0', source: 'auto' })).error).not.toBeNull()
    expect((await service.from('heritage_daily_words').select('*')).error).toBeNull()
    expect(sql('select relrowsecurity from pg_class where oid = \'public.heritage_daily_words\'::regclass;')).toBe('t')
  })

  it('enforces the table constraints', async () => {
    const [a] = await addWords('constraints', 1)
    const insert = (columns: string, values: string) => `insert into public.heritage_daily_words(day, word_id, source${columns}) values ('2031-03-01', '${a}', 'pinned'${values});`
    expect(failure('insert into public.heritage_daily_words(day, word_id, source) values (\'2031-03-01\', \'daily-test-missing\', \'auto\');')).toMatch(/foreign key/)
    expect(failure(insert('', '').replace('\'pinned\'', '\'manual\''))).toMatch(/source/)
    expect(failure(insert(', village', ', \'\''))).toMatch(/village/)
    expect(failure(insert(', resolved_at', ', now()'))).toMatch(/check/)
    expect(failure(insert(', snapshot', `, ${snapshot('x')}`))).toMatch(/check/)
    expect(failure(insert(', snapshot, resolved_at', ', \'[]\'::jsonb, now()'))).toMatch(/snapshot/)
    expect(failure(insert(', snapshot, resolved_at', `, jsonb_build_object('pad', repeat('x', 17000)), now()`))).toMatch(/snapshot/)
    sql(insert('', ''))
    expect(failure(insert('', ''))).toMatch(/duplicate key/)
  })

  it('freezes a resolved day except for an audited replacement', async () => {
    const [a, b] = await addWords('guard', 2)
    const day = '2031-04-01'
    sql(`insert into public.heritage_daily_words(day, word_id, source) values ('${day}', '${a}', 'pinned');`)
    // Unresolved pins are free to change and delete.
    sql(`update public.heritage_daily_words set word_id = '${b}', village = 'none' where day = '${day}'; update public.heritage_daily_words set word_id = '${a}', village = 'auto' where day = '${day}';`)
    sql(`update public.heritage_daily_words set snapshot = ${snapshot('first')}, resolved_at = now() where day = '${day}';`)
    expect(sql(`select updated_at > created_at from public.heritage_daily_words where day = '${day}';`)).toBe('t')

    const update = (set: string) => `update public.heritage_daily_words set ${set} where day = '${day}';`
    expect(failure(`delete from public.heritage_daily_words where day = '${day}';`)).toMatch(/cannot be deleted/)
    expect(failure(update('day = \'2031-04-02\''))).toMatch(/another day/)
    expect(failure(update('created_at = now() + interval \'1 day\''))).toMatch(/created_at/)
    expect(failure(update(`snapshot = ${snapshot('changed')}`))).toMatch(/immutable/)
    expect(failure(update('resolved_at = null, snapshot = null'))).toMatch(/unresolved/)
    expect(failure(update('resolved_at = now() + interval \'1 hour\''))).toMatch(/immutable/)
    expect(failure(update(`replaced_word_ids = array['${b}']`))).toMatch(/immutable/)
    expect(failure(update(`word_id = '${b}'`))).toMatch(/audited/)
    expect(failure(update(`word_id = '${b}', replaced_word_ids = array['${a}']`))).toMatch(/audited/)
    expect(failure(update(`word_id = '${b}', replaced_word_ids = array['${b}'], snapshot = ${snapshot('wrong')}`))).toMatch(/audited/)
    expect(sql(`select word_id from public.heritage_daily_words where day = '${day}';`)).toBe(a)

    sql(update(`word_id = '${b}', replaced_word_ids = array['${a}'], snapshot = ${snapshot('second')}, resolved_at = now()`))
    expect(sql(`select word_id || ' ' || array_to_string(replaced_word_ids, ',') from public.heritage_daily_words where day = '${day}';`)).toBe(`${b} ${a}`)
    // The audit trail only grows by exactly the word that was replaced.
    expect(failure(update(`word_id = '${a}', replaced_word_ids = array['${a}'], snapshot = ${snapshot('third')}`))).toMatch(/audited/)
    sql(update(`word_id = '${a}', replaced_word_ids = array['${a}','${b}'], snapshot = ${snapshot('third')}`))
    expect(sql(`select array_to_string(replaced_word_ids, ',') from public.heritage_daily_words where day = '${day}';`)).toBe(`${a},${b}`)
  })

  it('lets only one of many concurrent first inserts win', async () => {
    const ids = await addWords('race', 12)
    const day = '2031-05-01'
    const results = await Promise.all(ids.map(id => clientFor().from('heritage_daily_words').upsert({
      day, word_id: id, source: 'auto', village: 'auto', snapshot: { options: [{ id: 'a', text: { hr: id } }, { id: 'b', text: { hr: 'x' } }], correctOptionId: 'a', villageAreaId: null, clues: [] },
      resolved_at: new Date().toISOString(), replaced_word_ids: []
    }, { onConflict: 'day', ignoreDuplicates: true })))
    expect(results.map(result => result.error)).toEqual(ids.map(() => null))
    const { data } = await service.from('heritage_daily_words').select('word_id,snapshot').eq('day', day)
    expect(data).toHaveLength(1)
    expect(ids).toContain(data![0]!.word_id)
    expect(data![0]!.snapshot.options[0].text.hr).toBe(data![0]!.word_id)
  })

  it('resolves, pins, skips and replaces against the real constraints and trigger', async () => {
    const epoch = '2031-06-01'
    const at = (day: string) => new Date(`${day}T10:00:00Z`)
    const [pinned, skipped] = await addWords('resolver', 2)
    const resolve = (day: string) => resolveDailyWord(clientFor(), at(day), { epoch })

    // Concurrent first requests share one row and one answer.
    const results = await Promise.all(Array.from({ length: 6 }, () => resolve('2031-06-02')))
    expect(new Set(results.map(result => JSON.stringify(result))).size).toBe(1)
    expect((await service.from('heritage_daily_words').select('day').eq('day', '2031-06-02')).data).toHaveLength(1)
    expect(results[0]).toMatchObject({ day: '2031-06-02', number: 2, nextAt: '2031-06-02T22:00:00.000Z' })
    expect(results[0]!.options).toHaveLength(4)

    // A pin resolves to its word, and a later withdrawal replaces it through the guard trigger.
    expect((await service.from('heritage_daily_words').insert({ day: '2031-06-03', word_id: pinned, source: 'pinned', village: 'none' })).error).toBeNull()
    const pin = await resolve('2031-06-03')
    expect(pin.entry.id).toBe(pinned)
    expect((await service.from('heritage_words').update({ active: false }).eq('id', pinned)).error).toBeNull()
    const replacement = await resolve('2031-06-03')
    expect(replacement.entry.id).not.toBe(pinned)
    const stored = (await service.from('heritage_daily_words').select('*').eq('day', '2031-06-03')).data![0]!
    expect(stored).toMatchObject({ word_id: replacement.entry.id, source: 'auto', replaced_word_ids: [pinned] })
    expect(await resolve('2031-06-03')).toEqual(replacement)

    // An inactive pin is skipped before it was ever served, and the audit keeps it.
    expect((await service.from('heritage_words').update({ active: false }).eq('id', skipped)).error).toBeNull()
    expect((await service.from('heritage_daily_words').insert({ day: '2031-06-04', word_id: skipped, source: 'pinned' })).error).toBeNull()
    const warn = console.warn
    console.warn = () => undefined
    const fallback = await resolve('2031-06-04').finally(() => {
      console.warn = warn
    })
    expect(fallback.entry.id).not.toBe(skipped)
    expect((await service.from('heritage_daily_words').select('*').eq('day', '2031-06-04')).data![0]).toMatchObject({ source: 'auto', replaced_word_ids: [skipped] })
  })
})
