import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

// The atomic apply trigger of 20261103110000_contributions_inbox.sql on a real Postgres: the write that
// applies a correction or a proposal approves the submission, records where it went, adds the credit and
// attributes the revision, all in one statement, and a refused apply changes nothing. Run with
// `node scripts/test-challenges.mjs test/contentApply.integration.test.ts`; skipped everywhere else.
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
const quote = (value: string | null) => value === null ? 'null' : `'${value.replace(/'/g, '\'\'')}'`
const unique = () => randomBytes(4).toString('hex')
const json = (query: string) => JSON.parse(sql(query)) as Record<string, unknown>

function place() {
  const id = unique()
  const country = sql('insert into public.areas(kind, name) values (\'country\', \'Zemlja\') returning id;')
  const county = sql(`insert into public.areas(kind, parent_id, name) values ('county', '${country}', 'Županija') returning id;`)
  const municipality = sql(`insert into public.areas(kind, parent_id, name, slug) values ('municipality', '${county}', 'Općina', 'opcina-${id}') returning id;`)
  const settlement = sql(`insert into public.areas(kind, parent_id, name, slug) values ('settlement', '${municipality}', 'Naselje', 'naselje-${id}') returning id;`)
  const category = sql(`insert into public.heritage_categories(key, label_hr) values ('kat-${id}', 'Kategorija') returning id;`)
  return { id, municipality, settlement, category }
}
function item(p: ReturnType<typeof place>, name = 'Kapela') {
  return sql(`insert into public.heritage_items(name, slug, category_id, municipality_id, settlement_id, status) values (${quote(name)}, 'kapela-${unique()}', '${p.category}', '${p.municipality}', '${p.settlement}', 'published') returning id;`)
}
function submission(type: 'correction' | 'proposal', target: { kind: string, id?: string | null }, extra: { name?: string | null, status?: string } = {}) {
  const name = extra.name === undefined ? 'Ana Horvat' : extra.name
  const payload = type === 'correction' ? '{"name":"Nova kapela"}' : '{"name":"Predložena kapela"}'
  return sql(`insert into public.heritage_submissions(text, type, target_kind, target_id, payload, name, consent_publish, consent_version, locale, status)
    values ('Bilješka', '${type}', '${target.kind}', ${quote(target.id ?? null)}, '${payload}', ${quote(name)}, true, '2026-11-02', 'hr', ${quote(extra.status ?? 'pending')}) returning id;`)
}
const submissionRow = (id: string) => json(`select to_jsonb(s) from public.heritage_submissions s where id = ${id};`)

describe.skipIf(!url)('atomic apply of submissions on Postgres', () => {
  it('applies a correction in one write: approval, applied_*, credit and an attributed revision', () => {
    const p = place()
    const target = item(p)
    const id = submission('correction', { kind: 'heritage_item', id: target })

    sql(`update public.heritage_items set name = 'Nova kapela', apply_submission_id = ${id} where id = '${target}';`)

    const row = json(`select to_jsonb(i) from public.heritage_items i where id = '${target}';`)
    expect(row).toMatchObject({ name: 'Nova kapela', revision: 2, apply_submission_id: null, apply_credit: null })
    const credits = row.credits as Array<Record<string, string>>
    expect(credits).toHaveLength(1)
    expect(credits[0]).toMatchObject({ name: 'Ana Horvat', kind: 'correction' })

    const stored = submissionRow(id)
    expect(stored).toMatchObject({ status: 'approved', applied_entity_id: target, credit_ref: credits[0]!.id })
    expect(stored.applied_at).not.toBeNull()
    expect(stored.reviewed_at).not.toBeNull()

    const revision = json(`select to_jsonb(r) from public.content_revisions r where entity_id = '${target}' and revision = 2;`)
    expect(revision.submission_id).toBe(Number(id))
    expect(Object.keys(revision.data as object)).not.toContain('apply_submission_id')
    // The setting that carried the id to the audit trigger is spent, so a later write is not attributed to it.
    sql(`update public.heritage_items set locality = 'Selo' where id = '${target}';`)
    expect(sql(`select submission_id is null from public.content_revisions where entity_id = '${target}' and revision = 3;`)).toBe('t')
  })

  it('refuses an apply that does not fit and leaves everything as it was', () => {
    const p = place()
    const target = item(p)
    const other = item(p, 'Druga kapela')
    const id = submission('correction', { kind: 'heritage_item', id: target })

    // Another entity, an unknown submission, a proposal id on an update of the wrong kind: nothing changes.
    expect(failure(`update public.heritage_items set name = 'X', apply_submission_id = ${id} where id = '${other}';`)).toMatch(/drugi zapis/)
    expect(failure(`update public.heritage_items set name = 'X', apply_submission_id = 999999999 where id = '${target}';`)).toMatch(/više ne postoji/)
    expect(failure(`update public.sources set title = 'X', apply_submission_id = ${id} where id = (select id from public.sources limit 1);`)).toBeDefined()
    expect(failure(`insert into public.heritage_items(name, slug, category_id, municipality_id, apply_submission_id) values ('Y', 'y-${unique()}', '${p.category}', '${p.municipality}', ${id});`)).toMatch(/postojeći zapis/)
    expect(json(`select to_jsonb(i) from public.heritage_items i where id = '${target}';`)).toMatchObject({ name: 'Kapela', revision: 1 })
    expect(json(`select to_jsonb(i) from public.heritage_items i where id = '${other}';`)).toMatchObject({ name: 'Druga kapela', revision: 1 })
    expect(submissionRow(id)).toMatchObject({ status: 'pending', applied_at: null, credit_ref: null })

    // A failing write in the same statement rolls the approval back with it.
    expect(failure(`update public.heritage_items set name = 'X', settlement_id = '${p.municipality}', apply_submission_id = ${id} where id = '${target}';`)).toMatch(/settlement_id must be/)
    expect(submissionRow(id)).toMatchObject({ status: 'pending', applied_at: null })

    // Once applied it cannot be applied again, and a rejected one never.
    sql(`update public.heritage_items set name = 'Y', apply_submission_id = ${id} where id = '${target}';`)
    expect(failure(`update public.heritage_items set name = 'Z', apply_submission_id = ${id} where id = '${target}';`)).toMatch(/već primijenjen/)
    const rejected = submission('correction', { kind: 'heritage_item', id: target }, { status: 'rejected' })
    expect(failure(`update public.heritage_items set name = 'Z', apply_submission_id = ${rejected} where id = '${target}';`)).toMatch(/Odbijeni/)
    expect(json(`select to_jsonb(i) from public.heritage_items i where id = '${target}';`)).toMatchObject({ name: 'Y' })
  })

  it('leaves the contributor out of the credits on request, and when no name was given', () => {
    const p = place()
    const target = item(p)
    const hidden = submission('correction', { kind: 'heritage_item', id: target })
    sql(`update public.heritage_items set name = 'A', apply_submission_id = ${hidden}, apply_credit = false where id = '${target}';`)
    expect(json(`select to_jsonb(i) from public.heritage_items i where id = '${target}';`).credits).toEqual([])
    expect(submissionRow(hidden)).toMatchObject({ status: 'approved', credit_ref: null })

    const anonymous = submission('correction', { kind: 'heritage_item', id: target }, { name: null })
    sql(`update public.heritage_items set name = 'B', apply_submission_id = ${anonymous} where id = '${target}';`)
    expect(json(`select to_jsonb(i) from public.heritage_items i where id = '${target}';`).credits).toEqual([])
  })

  it('applies a proposal when the draft created from it is published, once', () => {
    const p = place()
    const id = submission('proposal', { kind: 'heritage_item' })
    const created = sql(`insert into public.heritage_items(name, slug, category_id, municipality_id, settlement_id, status, source_submission_id)
      values ('Predložena kapela', 'predlozena-${unique()}', '${p.category}', '${p.municipality}', '${p.settlement}', 'draft', ${id}) returning id;`)
    expect(submissionRow(id)).toMatchObject({ status: 'pending', applied_at: null })

    sql(`update public.heritage_items set status = 'published' where id = '${created}';`)
    expect(submissionRow(id)).toMatchObject({ status: 'approved', applied_entity_id: created })
    expect((json(`select to_jsonb(i) from public.heritage_items i where id = '${created}';`).credits as unknown[])).toHaveLength(1)
    expect(sql(`select submission_id from public.content_revisions where entity_id = '${created}' and revision = 2;`)).toBe(id)

    // Unpublishing and publishing again does not add a second credit.
    sql(`update public.heritage_items set status = 'draft' where id = '${created}';`)
    sql(`update public.heritage_items set status = 'published' where id = '${created}';`)
    expect((json(`select to_jsonb(i) from public.heritage_items i where id = '${created}';`).credits as unknown[])).toHaveLength(1)
  })

  it('applies to areas, sources and words through the same trigger', () => {
    const p = place()
    const areaSubmission = submission('correction', { kind: 'area', id: p.settlement })
    sql(`update public.areas set name = 'Novo ime', apply_submission_id = ${areaSubmission} where id = '${p.settlement}';`)
    expect(json(`select to_jsonb(a) from public.areas a where id = '${p.settlement}';`)).toMatchObject({ name: 'Novo ime', apply_submission_id: null })
    expect((json(`select to_jsonb(a) from public.areas a where id = '${p.settlement}';`).credits as unknown[])).toHaveLength(1)
    expect(submissionRow(areaSubmission)).toMatchObject({ status: 'approved', applied_entity_id: p.settlement })

    // Sources carry no credits, and a source proposal is applied by publishing the draft.
    const sourceProposal = submission('proposal', { kind: 'source' })
    const source = sql(`insert into public.sources(title, type, status, source_submission_id) values ('Izvor', 'publication', 'draft', ${sourceProposal}) returning id;`)
    sql(`update public.sources set status = 'published' where id = '${source}';`)
    expect(submissionRow(sourceProposal)).toMatchObject({ status: 'approved', applied_entity_id: source, credit_ref: null })

    const wordId = crypto.randomUUID()
    const entry = { id: wordId, headword: 'kaj', meaning: { hr: 'što' }, partOfSpeech: 'zamjenica', status: 'community', sources: [{ id: 'izvor-1', kind: 'editor', credit: 'urednik' }], variants: [{ id: 'v1', form: 'kaj', status: 'community', usages: [] }] }
    sql(`insert into public.heritage_words(id, entry, areas, active) values ('${wordId}', ${quote(JSON.stringify(entry))}::jsonb, '[]', true);`)
    const wordSubmission = submission('correction', { kind: 'word', id: wordId })
    sql(`update public.heritage_words set apply_submission_id = ${wordSubmission} where id = '${wordId}';`)
    const sources = (json(`select entry from public.heritage_words where id = '${wordId}';`) as { sources: Array<Record<string, string>> }).sources
    expect(sources).toHaveLength(2)
    expect(sources[1]).toMatchObject({ kind: 'contribution', credit: 'Ana Horvat' })
    expect(submissionRow(wordSubmission)).toMatchObject({ status: 'approved', applied_entity_id: wordId, credit_ref: sources[1]!.id })
    expect(sql(`select submission_id from public.content_revisions where entity_id = '${wordId}' order by id desc limit 1;`)).toBe(wordSubmission)
  })

  it('withdraws: a deleted correction loses its credit everywhere but keeps the change', () => {
    const p = place()
    const target = item(p)
    const id = submission('correction', { kind: 'heritage_item', id: target })
    sql(`update public.heritage_items set name = 'Ispravljeno', apply_submission_id = ${id} where id = '${target}';`)
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${target}' and data::text like '%Ana Horvat%';`)).toBe('1')

    sql(`delete from public.heritage_submissions where id = ${id};`)
    expect(sql(`select count(*) from public.heritage_submissions where id = ${id};`)).toBe('0')
    const row = json(`select to_jsonb(i) from public.heritage_items i where id = '${target}';`)
    expect(row).toMatchObject({ name: 'Ispravljeno', credits: [] })
    // No stored revision still names the contributor, and the revisions are detached from the deleted submission.
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${target}' and data::text like '%Ana Horvat%';`)).toBe('0')
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${target}' and submission_id is not null;`)).toBe('0')
  })

  it('withdraws: rejecting or deleting a proposal unpublishes what it created and strips the credit', () => {
    const p = place()
    const rejected = submission('proposal', { kind: 'heritage_item' })
    const created = sql(`insert into public.heritage_items(name, slug, category_id, municipality_id, status, source_submission_id)
      values ('Nova', 'nova-${unique()}', '${p.category}', '${p.municipality}', 'published', ${rejected}) returning id;`)
    expect(submissionRow(rejected).status).toBe('approved')
    // Rejecting after the fact (the API refuses it, a person with SQL access may do it) withdraws it.
    sql(`update public.heritage_submissions set status = 'rejected' where id = ${rejected};`)
    expect(json(`select to_jsonb(i) from public.heritage_items i where id = '${created}';`)).toMatchObject({ status: 'draft', credits: [] })
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${created}' and data::text like '%Ana Horvat%';`)).toBe('0')

    const deleted = submission('proposal', { kind: 'area' })
    const area = sql(`insert into public.areas(kind, parent_id, name, slug, status, source_submission_id)
      values ('settlement', '${p.municipality}', 'Novo selo', 'novo-selo-${unique()}', 'published', ${deleted}) returning id;`)
    sql(`delete from public.heritage_submissions where id = ${deleted};`)
    expect(json(`select to_jsonb(a) from public.areas a where id = '${area}';`)).toMatchObject({ status: 'draft', credits: [], source_submission_id: null })
  })

  it('keeps the submission shape consistent and backfilled', () => {
    expect(failure('insert into public.heritage_submissions(text, type, consent_publish, consent_version, locale) values (\'ab\', \'proposal\', true, \'x\', \'hr\');')).toMatch(/target_shape/)
    expect(failure(`insert into public.heritage_submissions(text, type, target_kind, payload, consent_publish, consent_version, locale) values ('ab', 'word', 'word', '{}', true, 'x', 'hr');`)).toMatch(/target_shape/)
    expect(failure(`insert into public.heritage_submissions(text, type, target_kind, target_id, payload, consent_publish, consent_version, locale) values ('ab', 'proposal', 'area', '${crypto.randomUUID()}', '{}', true, 'x', 'hr');`)).toMatch(/target_shape/)
    expect(failure('insert into public.heritage_submissions(text, type, target_kind, payload, consent_publish, consent_version, locale) values (\'ab\', \'proposal\', \'church\', \'{}\', true, \'x\', \'hr\');')).toMatch(/target_kind/)
    expect(sql('select count(*) from public.heritage_submissions where type = \'correction\' and target_kind is null;')).toBe('0')
  })
})
