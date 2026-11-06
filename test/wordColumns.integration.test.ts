import { randomBytes, randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { atlasSlug } from '../shared/utils/atlasSlug'
import { integrationDb } from './support/integrationDb'

// Word admin columns (20261103030000_word_admin_columns.sql) on a real Postgres. Run with
// `node scripts/test-challenges.mjs`, which provisions a disposable Postgres and PostgREST, applies every
// migration and removes both afterwards. Skipped everywhere else. Every test adds its own words with
// fresh UUID ids and uniquely tagged headwords, so it never touches the seeded words or other suites.
const db = await integrationDb()
const { sql, failure } = db
const service = db.service
const quote = (value: string) => `'${value.replace(/'/g, '\'\'')}'`
// Letters only, so a tag never changes how a headword is slugged.
const tag = () => [...randomBytes(6)].map(b => String.fromCharCode(97 + (b % 26))).join('')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function entry(id: string, headword: string, extra: Record<string, unknown> = {}) {
  return {
    id, headword, meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }],
    variants: [{ id: 'v1', form: headword, status: 'community', usages: [] }, { id: 'v2', form: `${headword}a`, status: 'community', usages: [] }],
    ...extra
  }
}
// The previous app's insert: id, entry, areas and active only.
async function addWord(headword: string, fields: Record<string, unknown> = {}) {
  const id = randomUUID()
  const { data, error } = await service.from('heritage_words')
    .insert({ id, entry: entry(id, headword), active: false, ...fields }).select('*').single()
  expect(error).toBeNull()
  return data!
}

describe.skipIf(!db.enabled)('heritage_words admin columns on Postgres', () => {
  it('gave every word that existed before the migration a slug and a baseline revision', () => {
    // Baseline rows exist only for words present when the migration ran: the 61 reloaded seed words.
    const rows = sql(`select w.id, w.slug, w.entry->>'headword', w.revision, w.updated_at = w.created_at, r.data ? 'search_text', r.data->>'slug' = w.slug
      from public.heritage_words w join public.content_revisions r on r.entity_kind = 'word' and r.entity_id = w.id::uuid
      where r.actor = 'import' and r.action = 'insert' and r.revision = 1 order by w.created_at, w.id;`).split('\n').map(line => line.split('|'))
    expect(rows).toHaveLength(61)
    const slugs = new Set<string>()
    for (const [id, slug, headword, revision, untouched, hasSearch, sameSlug] of rows) {
      expect(id).toMatch(UUID)
      const base = atlasSlug(headword!)
      expect(slug === base || slug!.startsWith(`${base}-`)).toBe(true)
      slugs.add(slug!)
      // The backfill was not an edit: no revision bump, no updated_at change.
      expect([revision, untouched, hasSearch, sameSlug]).toEqual(['1', 't', 'f', 't'])
    }
    expect(slugs.size).toBe(61)
    expect(sql('select count(*) from public.heritage_words where active and slug is null;')).toBe('0')
  })

  it('accepts only lowercase UUID ids', async () => {
    const id = randomUUID()
    for (const bad of ['hiza', id.toUpperCase(), `${id}-x`]) {
      const { error } = await service.from('heritage_words').insert({ id: bad, entry: entry(bad, 'loše'), active: false })
      expect(error?.message).toMatch(/heritage_words_id_uuid/)
    }
    expect((await addWord(`dobro${tag()}`)).id).toMatch(UUID)
  })

  it('slugs exactly like atlasSlug', () => {
    const inputs = ['Hiža', 'Đurđevac', 'ĐURĐA i đurđica', 'ŠKRLAK i škrljak', '  kaj?! ', 'Čučerje – Ćiro', 'naïve café',
      'Ångström 42', 'Łódź', 'ǅamija', 'ﬁno', 'sv. Ana (kapela)', 'a--b__c', 'Ӂ', '---', '']
    const values = sql(`select coalesce(public.content_slug(v), '<null>') from unnest(array[${inputs.map(quote).join(', ')}]) with ordinality as t(v, n) order by n;`).split('\n')
    expect(values).toEqual(inputs.map(input => atlasSlug(input) || '<null>'))
  })

  it('gives homographs distinct slugs and keeps a slug once set', async () => {
    const headword = `kaj${tag()}`
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    const { error } = await service.from('heritage_words').insert(ids.map(id => ({ id, entry: entry(id, headword), active: false })))
    expect(error).toBeNull()
    expect(sql(`select string_agg(slug, ',' order by slug) from public.heritage_words where id in (${ids.map(quote).join(', ')});`))
      .toBe(`${headword},${headword}-2,${headword}-3`)

    // A draft without a headword has no slug until it gets one; later headword edits keep it.
    const draft = await addWord('')
    expect(draft.slug).toBeNull()
    const named = `Šuma ${tag()}`
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{headword}', ${quote(`"${named}"`)}) where id = '${draft.id}';`)
    expect(sql(`select slug from public.heritage_words where id = '${draft.id}';`)).toBe(atlasSlug(named))
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{headword}', '"nešto drugo"') where id = '${draft.id}';`)
    expect(sql(`select slug from public.heritage_words where id = '${draft.id}';`)).toBe(atlasSlug(named))

    // Clearing the slug asks for a new one from the current headword.
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{headword}', ${quote(`"${named} novo"`)}) where id = '${draft.id}';`)
    sql(`update public.heritage_words set slug = null where id = '${draft.id}';`)
    expect(sql(`select slug from public.heritage_words where id = '${draft.id}';`)).toBe(atlasSlug(`${named} novo`))

    // Explicit slugs are kept, must be well formed and unique; a headword with no letters still gets one.
    const custom = `vlastiti-${tag()}`
    expect((await addWord(`x${tag()}`, { slug: custom })).slug).toBe(custom)
    expect((await service.from('heritage_words').insert({ id: randomUUID(), entry: entry(randomUUID(), 'y'), active: false, slug: custom })).error).not.toBeNull()
    const badId = randomUUID()
    expect((await service.from('heritage_words').insert({ id: badId, entry: entry(badId, 'y'), active: false, slug: 'Loš Slug' })).error?.message).toMatch(/heritage_words_slug_format/)
    expect((await addWord('?!')).slug).toMatch(/^rijec(-\d+)?$/)
  })

  it('manages revision, timestamps and search text, and refuses stale updates', async () => {
    const t = tag()
    const word = await addWord(`Črni Ćuk${t}`)
    expect(word).toMatchObject({ revision: 1, archived_at: null, slug: `crni-cuk${t}` })
    // Headword, every variant form, then the Croatian and English meanings, accent-folded.
    expect(word.search_text).toBe(`crni cuk${t} crni cuk${t} crni cuk${t}a kuca house`)

    const saved = await service.from('heritage_words').update({ entry: { ...word.entry, meaning: { hr: 'Žaba' } } }).eq('id', word.id).eq('revision', 1).select('revision,created_at,updated_at,search_text')
    expect(saved.error).toBeNull()
    expect(saved.data![0]).toMatchObject({ revision: 2, created_at: word.created_at })
    expect(saved.data![0]!.search_text).toMatch(/ zaba$/)
    const stale = await service.from('heritage_words').update({ active: true }).eq('id', word.id).eq('revision', 1).select('revision')
    expect(stale).toMatchObject({ error: null, data: [] })

    expect((await service.from('heritage_words').update({ revision: 9 }).eq('id', word.id)).error?.message).toMatch(/revision is managed/)
    expect(failure(`update public.heritage_words set id = '${randomUUID()}' where id = '${word.id}';`)).toMatch(/id is immutable/)
    sql(`update public.heritage_words set created_at = '2000-01-01', search_text = 'x' where id = '${word.id}';`)
    expect(sql(`select revision, created_at = ${quote(word.created_at)}::timestamptz, search_text <> 'x' from public.heritage_words where id = '${word.id}';`)).toBe('3|t|t')
  })

  it('records every write in content_revisions, deletes included', async () => {
    const word = await addWord(`povijest${tag()}`)
    expect((await service.from('heritage_words').update({ entry: { ...word.entry, partOfSpeech: 'glagol' } }).eq('id', word.id)).error).toBeNull()
    expect((await service.from('heritage_words').delete().eq('id', word.id)).error).toBeNull()
    const history = sql(`select revision || ' ' || action || ' ' || actor || ' ' || (data->'entry'->>'partOfSpeech') || ' ' || (data ? 'search_text') || ' ' || (data->>'slug')
      from public.content_revisions where entity_kind = 'word' and entity_id = '${word.id}' order by id;`)
    expect(history.split('\n')).toEqual([`1 insert admin imenica false ${word.slug}`, `2 update admin glagol false ${word.slug}`, `3 delete admin glagol false ${word.slug}`])
    expect(sql(`select data->>'id' = entity_id::text from public.content_revisions where entity_id = '${word.id}' and action = 'delete';`)).toBe('t')
  })

  it('clears archived_at when a word is activated', async () => {
    const word = await addWord(`arhiva${tag()}`)
    sql(`update public.heritage_words set archived_at = now() where id = '${word.id}';`)
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{meaning,hr}', '"još arhivirano"') where id = '${word.id}';`)
    expect(sql(`select archived_at is not null from public.heritage_words where id = '${word.id}';`)).toBe('t')
    expect((await service.from('heritage_words').update({ active: true }).eq('id', word.id)).error).toBeNull()
    expect(sql(`select active, archived_at is null from public.heritage_words where id = '${word.id}';`)).toBe('t|t')
  })

  it('keeps old slugs in slug history and never leaves an active word without a slug', async () => {
    const word = await addWord(`staro${tag()}`, { active: true })
    const renamed = `novo-${tag()}`
    sql(`update public.heritage_words set slug = '${renamed}' where id = '${word.id}';`)
    expect(sql(`select namespace || '|' || coalesce(scope_id::text, '') || '|' || entity_id from public.content_slug_history where kind = 'word' and slug = '${word.slug}';`))
      .toBe(`||${word.id}`)
    // Unrelated edits leave no history.
    sql(`update public.heritage_words set entry = jsonb_set(entry, '{meaning,hr}', '"drugo"') where id = '${word.id}';`)
    expect(sql(`select count(*) from public.content_slug_history where entity_id = '${word.id}';`)).toBe('1')
    // Clearing an active word's slug makes the trigger pick one again rather than break the invariant.
    sql(`update public.heritage_words set slug = null where id = '${word.id}';`)
    expect(sql(`select slug is not null from public.heritage_words where id = '${word.id}';`)).toBe('t')
  })

  it('keeps the previous app working and the new helpers private', async () => {
    // Old admin save: update entry, areas and active without revision or slug.
    const word = await addWord(`stari${tag()}`)
    const saved = await service.from('heritage_words').update({ entry: word.entry, active: true }).eq('id', word.id).select('active,revision,slug')
    expect(saved.data).toEqual([{ active: true, revision: 2, slug: word.slug }])
    for (const role of ['anon', 'authenticated']) {
      expect(failure(`set role ${role}; select public.content_slug('a');`)).toMatch(/permission denied/)
      expect(failure(`set role ${role}; select slug from public.heritage_words;`)).toMatch(/permission denied/)
    }
    const anon = db.client('anon')
    expect((await anon.rpc('content_slug', { value: 'a' })).error).not.toBeNull()
    expect(sql('select public.content_slug(\'Kapela sv. Ane\');')).toBe('kapela-sv-ane')
  })
})
