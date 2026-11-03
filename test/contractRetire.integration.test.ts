import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { contentUuid } from './helpers/contentUuid'

// Retiring heritage_words.areas and heritage_submissions.target_ref, step 1: 20261103130000_retire_target_ref_requirement.sql
// on a real Postgres. Run with `node scripts/test-challenges.mjs`, which provisions a disposable Postgres and
// PostgREST, applies every migration and removes both afterwards. Skipped everywhere else. It adds its own rows.
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
const service = createClient(url ?? 'http://localhost', serviceKey || 'service', { auth: { persistSession: false, autoRefreshToken: false } })
const TOWN = contentUuid('area:krizevci')
const ITEM = contentUuid('heritage_item:kalnik-crkva-sv-brcka')

function entry(id: string, usages: unknown[] = []) {
  return {
    id, headword: 'retire', meaning: { hr: 'kuća' }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }], variants: [{ id: 'v1', form: 'retire', status: 'community', usages }]
  }
}

describe.skipIf(!url)('retiring the legacy columns on Postgres', () => {
  it('lets a correction through without target_ref, as the new app writes it, and still takes the old form', () => {
    const insert = (columns: string, values: string) => sql(`insert into public.heritage_submissions(text, type, target_kind, target_id, payload, ${columns}consent_publish, consent_version, locale) values ('Ispravak', 'correction', 'heritage_item', '${ITEM}', '{"name":"x"}', ${values}true, '2026-11-02', 'hr') returning id;`)
    expect(insert('', '')).toMatch(/^\d+$/)
    // The previous app also sends the legacy id of the item.
    expect(insert('target_ref, ', '\'kalnik-crkva-sv-brcka\', ')).toMatch(/^\d+$/)
  })

  it('still refuses a target_ref on anything but a correction and a malformed one', () => {
    expect(failure(`insert into public.heritage_submissions(text, type, target_ref, consent_publish, consent_version, locale) values ('x', 'word', 'kalnik-crkva-sv-brcka', true, '2026-11-02', 'hr');`)).toMatch(/heritage_submissions_correction_target_check/)
    expect(failure(`insert into public.heritage_submissions(text, type, target_kind, target_id, payload, target_ref, consent_publish, consent_version, locale) values ('x', 'correction', 'heritage_item', '${ITEM}', '{"name":"x"}', 'Bad Ref!', true, '2026-11-02', 'hr');`)).toMatch(/heritage_submissions_target_ref_format_check/)
  })

  it('keeps maintaining the areas column that an app from before this release still reads', async () => {
    const id = randomUUID()
    // The new app inserts id, entry and active only: no areas column.
    const { error } = await service.from('heritage_words').insert({ id, entry: entry(id, [{ areaId: TOWN, confidence: 'reported' }]), active: false })
    expect(error).toBeNull()
    expect(sql(`select jsonb_array_length(areas), (select count(*) from public.heritage_word_areas where word_id = '${id}') from public.heritage_words where id = '${id}';`)).toBe('3|1')
    sql(`delete from public.heritage_words where id = '${id}';`)
  })
})
