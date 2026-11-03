import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { contentUuid } from './helpers/contentUuid'

// The pending contract migration (docs/database.md, "Pending contract migration") applied to the schema as it is after
// every migration on main, inside a transaction that is rolled back. It takes ACCESS EXCLUSIVE locks on
// heritage_words and heritage_submissions, so it is NOT part of the default `node scripts/test-challenges.mjs` run
// (it would deadlock with the suites that use those tables at the same time). Run it alone:
//   node scripts/test-challenges.mjs test/contractMigration.integration.test.ts
const url = process.env.TEST_CHALLENGE_API_URL
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''

function sql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
const TOWN = contentUuid('area:krizevci')
const ITEM = contentUuid('heritage_item:kalnik-crkva-sv-brcka')

function entry(id: string, usages: unknown[] = []) {
  return {
    id, headword: 'retire', meaning: { hr: 'kuća' }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }], variants: [{ id: 'v1', form: 'retire', status: 'community', usages }]
  }
}

// The pending contract migration (docs/database.md, "Pending contract migration"), kept word for word so the
// documented SQL is known to apply to the schema as it is after every migration on main.
const CONTRACT = `
drop trigger heritage_word_areas_project on public.heritage_words;
drop function public.heritage_word_areas_project();
drop function public.areas_hierarchy_jsonb(uuid[]);
alter table public.heritage_words drop constraint heritage_word_payload_size;
alter table public.heritage_words drop column areas;
alter table public.heritage_words add constraint heritage_word_payload_size check (octet_length(entry::text) <= 131072);

alter table public.heritage_submissions drop constraint heritage_submissions_correction_target_check;
alter table public.heritage_submissions drop constraint heritage_submissions_target_ref_format_check;
alter table public.heritage_submissions drop column target_ref;
`

describe.skipIf(!url)('the pending contract migration on Postgres', () => {
  it('applies the pending contract migration, after which the new app\'s writes still work', () => {
    const id = randomUUID()
    const out = sql(`begin;
${CONTRACT}
insert into public.heritage_words(id, entry, active) values ('${id}', '${JSON.stringify(entry(id, [{ areaId: TOWN, confidence: 'reported' }]))}', false);
select count(*) from public.heritage_word_areas where word_id = '${id}';
insert into public.heritage_submissions(text, type, target_kind, target_id, payload, consent_publish, consent_version, locale) values ('Ispravak', 'correction', 'heritage_item', '${ITEM}', '{"name":"x"}', true, '2026-11-02', 'hr');
select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'heritage_words' and column_name = 'areas') or (table_name = 'heritage_submissions' and column_name = 'target_ref'));
rollback;`)
    // The usage link is still kept, the correction without target_ref is accepted, and both columns are gone.
    expect(out.split('\n').filter(line => /^\d+$/.test(line))).toEqual(['1', '0'])
    // Rolled back: the columns are back.
    expect(sql(`select count(*) from information_schema.columns where table_schema = 'public' and ((table_name = 'heritage_words' and column_name = 'areas') or (table_name = 'heritage_submissions' and column_name = 'target_ref'));`)).toBe('2')
  })
})
