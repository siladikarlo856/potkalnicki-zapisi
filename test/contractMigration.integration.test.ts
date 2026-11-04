import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { contentUuid } from './helpers/contentUuid'

// 20261104060000_drop_retired_columns.sql, the contract step of the CMS content migration, on a real Postgres:
// heritage_words.areas (with its projection trigger and helper functions) and heritage_submissions.target_ref (with
// its two checks) are gone, and what the app still relies on survives. Run with `node scripts/test-challenges.mjs`,
// which provisions a disposable Postgres, applies every migration (this one last) and removes it afterwards.
// Skipped everywhere else. It adds its own rows.
const url = process.env.TEST_CHALLENGE_API_URL
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
const TOWN = contentUuid('area:krizevci')
const ITEM = contentUuid('heritage_item:kalnik-crkva-sv-brcka')

function entry(id: string, usages: unknown[] = [], meaning = 'kuća') {
  return {
    id, headword: 'retire', meaning: { hr: meaning }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }], variants: [{ id: 'v1', form: 'retire', status: 'community', usages }]
  }
}
const insertWord = (id: string, value: unknown) => `insert into public.heritage_words(id, entry, active) values ('${id}', '${JSON.stringify(value).replace(/'/g, '\'\'')}', false);`
const insertCorrection = (extra = '') => `insert into public.heritage_submissions(text, type, target_kind, target_id, payload, ${extra ? `${extra.split('=')[0]}, ` : ''}consent_publish, consent_version, locale) values ('Ispravak', 'correction', 'heritage_item', '${ITEM}', '{"name":"x"}', ${extra ? `${extra.split('=')[1]}, ` : ''}true, '2026-11-02', 'hr') returning id;`

describe.skipIf(!url)('the retired columns are gone on Postgres', () => {
  it('has neither heritage_words.areas nor heritage_submissions.target_ref', () => {
    expect(sql(`select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'heritage_words' and column_name = 'areas') or (table_name = 'heritage_submissions' and column_name = 'target_ref'));`)).toBe('0')
  })

  it('has dropped the projection trigger and its function, and the two submission checks', () => {
    expect(sql(`select count(*) from pg_trigger where tgrelid = 'public.heritage_words'::regclass and tgname = 'heritage_word_areas_project';`)).toBe('0')
    expect(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('heritage_word_areas_project', 'areas_hierarchy_jsonb');`)).toBe('0')
    expect(sql(`select count(*) from pg_constraint where conrelid = 'public.heritage_submissions'::regclass and conname in ('heritage_submissions_correction_target_check', 'heritage_submissions_target_ref_format_check');`)).toBe('0')
  })

  it('keeps the helpers and the sidecar that heritage_word_areas_sync still uses', () => {
    expect(sql(`select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('resolve_area_id', 'word_entry_area_ids', 'heritage_word_areas_sync');`)).toBe('heritage_word_areas_sync,resolve_area_id,word_entry_area_ids')
    expect(sql(`select count(*) from pg_trigger where tgrelid = 'public.heritage_words'::regclass and tgname = 'heritage_word_areas_sync';`)).toBe('1')
    expect(sql(`select to_regclass('public.heritage_word_areas') is not null;`)).toBe('t')
  })

  it('re-created heritage_word_payload_size on the entry only', () => {
    expect(sql(`select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.heritage_words'::regclass and conname = 'heritage_word_payload_size';`)).toMatch(/octet_length\(\(?entry\)?::text\) <= 131072/)
    expect(sql(`select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.heritage_words'::regclass and conname = 'heritage_word_payload_size';`)).not.toMatch(/areas/)
    const id = randomUUID()
    expect(failure(insertWord(id, entry(id, [], 'x'.repeat(131100))))).toMatch(/heritage_word_payload_size/)
  })

  it('still keeps the usage link of a word and takes a correction without target_ref', () => {
    const id = randomUUID()
    sql(insertWord(id, entry(id, [{ areaId: TOWN, confidence: 'reported' }])))
    expect(sql(`select count(*) from public.heritage_word_areas where word_id = '${id}';`)).toBe('1')
    sql(`delete from public.heritage_words where id = '${id}';`)
    expect(sql(insertCorrection())).toMatch(/^\d+$/)
  })

  it('rejects target_ref as an unknown column', () => {
    expect(failure(insertCorrection('target_ref=\'kalnik-crkva-sv-brcka\''))).toMatch(/column "target_ref" of relation "heritage_submissions" does not exist/)
  })
})
