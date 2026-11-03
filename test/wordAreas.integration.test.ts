import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Word areas from the areas table (20261103120000_word_areas.sql) on a real Postgres. Run with
// `node scripts/test-challenges.mjs`, which provisions a disposable Postgres and PostgREST, applies
// every migration and removes both afterwards. Skipped everywhere else.
// Every test adds its own words and areas with fresh UUIDs; it never touches the seeded data.
const url = process.env.TEST_CHALLENGE_API_URL
const serviceKey = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
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
const quote = (value: string) => `'${value.replace(/'/g, '\'\'')}'`
const tag = () => [...randomBytes(6)].map(b => String.fromCharCode(97 + (b % 26))).join('')

// Resolve a known legacy key to its UUID via content_legacy_ids
function legacyUuid(legacyId: string): string {
  return sql(`select entity_id::text from public.content_legacy_ids where kind = 'area' and legacy_id = ${quote(legacyId)};`)
}

// Insert a minimal country → county → municipality → settlement chain for FK tests.
function seedPlaceChain(suffix: string) {
  const country = sql(`insert into public.areas(kind, parent_id, name, status) values ('country', null, 'Test Country ${suffix}', 'published') returning id;`)
  const county = sql(`insert into public.areas(kind, parent_id, name, status) values ('county', ${quote(country)}, 'Test County ${suffix}', 'published') returning id;`)
  const municipality = sql(`insert into public.areas(kind, parent_id, name, slug, status) values ('municipality', ${quote(county)}, 'Test Municipality ${suffix}', 'opcina-${suffix}', 'published') returning id;`)
  const settlement = sql(`insert into public.areas(kind, parent_id, name, slug, status) values ('settlement', ${quote(municipality)}, 'Test Settlement ${suffix}', 'naselje-${suffix}', 'published') returning id;`)
  return { country, county, municipality, settlement }
}

function entry(id: string, headword: string, areaIds: string[] = []) {
  return {
    id, headword,
    meaning: { hr: 'test' },
    partOfSpeech: 'imenica',
    status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    variants: [{ id: `${id}-v1`, form: headword, status: 'community', usages: areaIds.map(areaId => ({ areaId, confidence: 'reported' })) }]
  }
}

describe.skipIf(!url)('heritage_word_areas on Postgres', () => {
  it('table exists with correct structure, RLS on, only service_role can read', async () => {
    expect(sql(`select relrowsecurity from pg_class where oid = 'public.heritage_word_areas'::regclass;`)).toBe('t')
    expect(failure(`set role anon; select count(*) from public.heritage_word_areas;`)).toMatch(/permission denied/)
    expect(failure(`set role authenticated; select count(*) from public.heritage_word_areas;`)).toMatch(/permission denied/)
    const { error } = await service.from('heritage_word_areas').select('*', { count: 'exact', head: true })
    expect(error).toBeNull()
  })

  it('populates heritage_word_areas from entry usages via the trigger', async () => {
    const s = tag()
    const { settlement } = seedPlaceChain(s)
    const id = randomUUID()
    const { error } = await service.from('heritage_words')
      .insert({ id, entry: entry(id, `trigertest${s}`, [settlement]), areas: [], active: false })
      .select('*').single()
    expect(error).toBeNull()
    const row = sql(`select word_id, area_id::text from public.heritage_word_areas where word_id = ${quote(id)};`)
    expect(row).toBe(`${id}|${settlement}`)
    // Projection must happen in the original write; an AFTER trigger that updates the word again
    // would recurse or create an extra revision.
    expect(sql(`select revision from public.heritage_words where id = ${quote(id)};`)).toBe('1')
  })

  it('resolves legacy area keys in the trigger (hr-kkz-krizevci → UUID)', async () => {
    const krizevciUuid = legacyUuid('hr-kkz-krizevci')
    expect(krizevciUuid).toMatch(/^[0-9a-f-]{36}$/)
    const id = randomUUID()
    // Insert with legacy key in entry
    const legacyEntry = {
      id, headword: `legacyarea${tag()}`, meaning: { hr: 'test' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }],
      variants: [{ id: `${id}-v1`, form: 'legacyform', status: 'community',
        usages: [{ areaId: 'hr-kkz-krizevci', confidence: 'reported' }] }]
    }
    const { error } = await service.from('heritage_words')
      .insert({ id, entry: legacyEntry, areas: [], active: false })
    expect(error).toBeNull()
    const row = sql(`select area_id::text from public.heritage_word_areas where word_id = ${quote(id)};`)
    expect(row).toBe(krizevciUuid)
  })

  it('updates heritage_word_areas when entry is updated', async () => {
    const s = tag()
    const { settlement, municipality } = seedPlaceChain(s)
    const id = randomUUID()
    await service.from('heritage_words').insert({ id, entry: entry(id, `updatetest${s}`, [settlement]), areas: [], active: false })
    expect(sql(`select count(*) from public.heritage_word_areas where word_id = ${quote(id)};`)).toBe('1')
    // Change usage to municipality
    const updated = entry(id, `updatetest${s}`, [municipality])
    await service.from('heritage_words').update({ entry: updated }).eq('id', id)
    const row = sql(`select area_id::text from public.heritage_word_areas where word_id = ${quote(id)};`)
    expect(row).toBe(municipality)
    expect(sql(`select revision from public.heritage_words where id = ${quote(id)};`)).toBe('2')
  })

  it('ignores unknown area ids silently (old admin writes)', async () => {
    const id = randomUUID()
    const badEntry = {
      id, headword: `unknownarea${tag()}`, meaning: { hr: 'test' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }],
      variants: [{ id: `${id}-v1`, form: 'form', status: 'community',
        usages: [{ areaId: 'stari-kljuc-koji-ne-postoji', confidence: 'reported' }] }]
    }
    const { error } = await service.from('heritage_words')
      .insert({ id, entry: badEntry, areas: [], active: false })
    expect(error).toBeNull()
    expect(sql(`select count(*) from public.heritage_word_areas where word_id = ${quote(id)};`)).toBe('0')
  })

  it('cascades heritage_word_areas deletion when a word is deleted', async () => {
    const s = tag()
    const { settlement } = seedPlaceChain(s)
    const id = randomUUID()
    await service.from('heritage_words').insert({ id, entry: entry(id, `cascade${s}`, [settlement]), areas: [], active: false })
    expect(sql(`select count(*) from public.heritage_word_areas where word_id = ${quote(id)};`)).toBe('1')
    sql(`delete from public.heritage_words where id = ${quote(id)};`)
    expect(sql(`select count(*) from public.heritage_word_areas where word_id = ${quote(id)};`)).toBe('0')
  })

  it('restricts deleting an area that a word uses', async () => {
    const s = tag()
    const { settlement } = seedPlaceChain(s)
    const id = randomUUID()
    await service.from('heritage_words').insert({ id, entry: entry(id, `restrict${s}`, [settlement]), areas: [], active: false })
    expect(failure(`delete from public.areas where id = ${quote(settlement)};`)).toMatch(/violates (RESTRICT setting|foreign key constraint)/)
  })

  it('dual-writes the areas column with the full hierarchy from the areas table', async () => {
    const s = tag()
    const { settlement, municipality, county, country } = seedPlaceChain(s)
    const id = randomUUID()
    await service.from('heritage_words').insert({ id, entry: entry(id, `dualwrite${s}`, [settlement]), areas: [], active: false })
    const areasJson = sql(`select areas::text from public.heritage_words where id = ${quote(id)};`)
    const areas: Array<{ id: string, kind: string }> = JSON.parse(areasJson)
    const areaIds = new Set(areas.map(a => a.id))
    // Settlement and all ancestors should be in the projected areas column
    expect(areaIds).toContain(settlement)
    expect(areaIds).toContain(municipality)
    expect(areaIds).toContain(county)
    expect(areaIds).toContain(country)
  })

  it('backfilled existing words: legacy keys in entry rewritten to UUIDs', () => {
    const krizevciUuid = legacyUuid('hr-kkz-krizevci')
    const spOrehovecUuid = legacyUuid('hr-kkz-sveti-petar-orehovec')
    // Find a seeded word that had a usage with the legacy hr-kkz-krizevci key.
    // All seeded words used either hr-kkz-krizevci or hr-kkz-sveti-petar-orehovec.
    const rows = sql(`
      select count(*) from public.heritage_words w, jsonb_array_elements(w.entry->'variants') v,
        jsonb_array_elements(v->'usages') u
      where w.active = true
        and u->>'areaId' in ('hr-kkz-krizevci', 'hr-kkz-sveti-petar-orehovec', 'hr', 'hr-kkz');
    `)
    // After backfill, no seeded word should have legacy keys in entry
    expect(rows).toBe('0')
    // The seeded words should have UUID area ids
    const uuidRows = sql(`
      select count(*) from public.heritage_words w, jsonb_array_elements(w.entry->'variants') v,
        jsonb_array_elements(v->'usages') u
      where w.active = true
        and u->>'areaId' in (${quote(krizevciUuid)}, ${quote(spOrehovecUuid)});
    `)
    expect(Number(uuidRows)).toBeGreaterThan(0)
  })

  it('heritage_word_areas populated for backfilled seeded words', () => {
    const count = sql(`
      select count(*) from public.heritage_words w
      join public.heritage_word_areas wa on wa.word_id = w.id
      where w.active = true;
    `)
    expect(Number(count)).toBeGreaterThan(0)
  })

  it('resolve_area_id returns null for unknown values', () => {
    expect(sql(`select public.resolve_area_id('not-a-uuid-or-legacy-key') is null;`)).toBe('t')
    expect(sql(`select public.resolve_area_id('hr-kkz-krizevci') is not null;`)).toBe('t')
  })

  it('word_entry_area_ids extracts and resolves area ids from entry', () => {
    const krizevciUuid = legacyUuid('krizevci')
    const testEntry = JSON.stringify({
      id: 'test', headword: 'test', meaning: { hr: 'test' },
      variants: [{ id: 'v1', form: 'test', status: 'community', usages: [{ areaId: 'hr-kkz-krizevci', confidence: 'reported' }] }],
      sources: [], status: 'community'
    })
    const result = sql(`select public.word_entry_area_ids(${quote(testEntry)}::jsonb)::text;`)
    expect(result).toContain(krizevciUuid)
  })

  it('examples.areaId is also resolved by the trigger and backfilled', async () => {
    const s = tag()
    const { settlement } = seedPlaceChain(s)
    const id = randomUUID()
    const entryWithExample = {
      id, headword: `examplearea${s}`, meaning: { hr: 'test' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }],
      variants: [{ id: `${id}-v1`, form: `examplearea${s}`, status: 'community', usages: [] }],
      examples: [{ text: 'Primjer rečenice.', areaId: settlement }]
    }
    const { error } = await service.from('heritage_words')
      .insert({ id, entry: entryWithExample, areas: [], active: false })
    expect(error).toBeNull()
    const row = sql(`select area_id::text from public.heritage_word_areas where word_id = ${quote(id)};`)
    expect(row).toBe(settlement)
  })
})
