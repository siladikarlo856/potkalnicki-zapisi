import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ContentList } from '../shared/utils/content/common'
import type { ChallengeTemplate } from '../shared/utils/content/challengeTemplate'
import { contentUuid } from './helpers/contentUuid'
import sample from './fixtures/heritage/challenge.json'

// Challenge templates over real Postgres: the seed, the "current" rules of
// 20261103100000_challenge_templates.sql and the admin API for the challenge_template kind. Run with
// `node scripts/test-challenges.mjs`; skipped everywhere else. Test files run in parallel against
// one database, and challenge.integration.test.ts plays the current template. So rule checks run in
// rolled-back transactions, and the one committed switch (last test, in order within this file)
// makes current a copy with exactly the sample content, then switches back: a challenge created
// meanwhile by another file plays the same questions.
const url = process.env.TEST_CHALLENGE_API_URL
const key = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''
const SECRET = 'challenge-template-review-secret-0123456789'
const SAMPLE_ID = contentUuid('challenge_template:sample')
const { version: _version, ...sampleContent } = sample

if (url) await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)), server: true, setupTimeout: 300_000,
  env: { NUXT_SUPABASE_URL: url, NUXT_SUPABASE_SERVICE_ROLE_KEY: key, NUXT_REVIEW_SECRET: SECRET }
})

function psql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}
/** Runs the statements in a transaction that is always rolled back; returns their result rows. */
const rolledBack = (statements: string) => psql(`begin;\n${statements}\nrollback;`)
/** The error a statement fails with, inside a rolled-back transaction. */
function failure(statement: string) {
  try {
    rolledBack(statement)
  } catch (error) {
    return String((error as { stderr?: string }).stderr)
  }
  return ''
}
const sampleJson = `(select content from heritage_challenge_templates where id = '${SAMPLE_ID}')`

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': `192.0.2.${++ip % 250}`, 'authorization': `Bearer ${SECRET}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T & { data?: Record<string, unknown> } }
}
const BASE = '/api/admin/content/challenge_template'

describe.skipIf(!url)('challenge templates over real Postgres', () => {
  it('seeds test/fixtures/heritage/challenge.json (without version) as the current published template', () => {
    expect(JSON.parse(psql(`select content from heritage_challenge_templates where id = '${SAMPLE_ID}'`))).toEqual(sampleContent)
    expect(psql(`select name || '|' || status from heritage_challenge_templates where id = '${SAMPLE_ID}'`))
      .toBe('Izazov zavičaja — uzorak|published')
    // The import revision is stable even while another test switches the current template.
    expect(psql(`select action || ' ' || revision || ' ' || actor || ' ' || (data->>'is_current') || ' ' || (data ? 'search_text')
      from content_revisions where entity_kind = 'challenge_template' and entity_id = '${SAMPLE_ID}' order by id limit 1`)).toBe('insert 1 import true false')
  })

  it('switches the current template in one statement and records both rows in the history', () => {
    const out = rolledBack(`
      insert into heritage_challenge_templates (id, name, content, status) values ('7c000000-0000-4000-8000-000000000001', 'Drugi', ${sampleJson}, 'published');
      update heritage_challenge_templates set is_current = true where id = '7c000000-0000-4000-8000-000000000001';
      select string_agg(name || ':' || is_current || ':' || revision, ',' order by name) from heritage_challenge_templates where is_current or id = '${SAMPLE_ID}';
      select count(*) from heritage_challenge_templates where is_current;
      select string_agg(action || ':' || (data->>'is_current'), ',' order by id) from content_revisions where entity_id in ('7c000000-0000-4000-8000-000000000001', '${SAMPLE_ID}') and action = 'update';
      insert into heritage_challenge_templates (name, content, status, is_current) values ('Treći', ${sampleJson}, 'published', true);
      select string_agg(name, ',') from heritage_challenge_templates where is_current;`)
    // Quiet psql prints only query results, one line per select.
    const [, count, updates, third] = out.split('\n')
    expect(out).toContain('Drugi:true:2')
    expect(out).toMatch(/Izazov zavičaja — uzorak:false:\d+/)
    expect(count).toBe('1')
    expect(updates!.split(',').sort()).toEqual(expect.arrayContaining(['update:false', 'update:true']))
    expect(third).toBe('Treći')
  })

  it('keeps the current template published, switched on and undeletable, with messages for the admin', () => {
    expect(failure(`update heritage_challenge_templates set is_current = false where id = '${SAMPLE_ID}';`))
      .toContain('Trenutni izazov ostaje trenutni dok drugi izazov ne postaviš kao trenutni.')
    for (const status of ['draft', 'archived']) {
      expect(failure(`update heritage_challenge_templates set status = '${status}' where id = '${SAMPLE_ID}';`))
        .toContain('Trenutni izazov mora ostati objavljen.')
    }
    expect(failure(`delete from heritage_challenge_templates where id = '${SAMPLE_ID}';`)).toContain('Trenutni izazov ne može se obrisati.')
    expect(failure(`insert into heritage_challenge_templates (name, content, status, is_current) values ('Skica', ${sampleJson}, 'draft', true);`))
      .toContain('Trenutni izazov mora ostati objavljen.')
    // Without the trigger's message, the declarative checks still hold.
    expect(failure(`alter table heritage_challenge_templates disable trigger heritage_challenge_templates_current_rules;
      update heritage_challenge_templates set status = 'draft' where id = '${SAMPLE_ID}';`)).toContain('heritage_challenge_templates_current_published')
    expect(failure(`alter table heritage_challenge_templates disable trigger heritage_challenge_templates_current_rules;
      insert into heritage_challenge_templates (name, content, status, is_current) values ('Dva', ${sampleJson}, 'published', true);`)).toContain('heritage_challenge_templates_current')
  })

  it('checks the content outline and size, manages revision and search, and denies public roles', () => {
    for (const content of [`'[]'`, `'{"sample": true, "title": {}, "rounds": []}'`, `${sampleJson} || '{"version": 2}'`, `jsonb_set(${sampleJson}, '{sample}', '"da"')`]) {
      expect(failure(`insert into heritage_challenge_templates (name, content) values ('x', ${content});`), content).toContain('heritage_challenge_templates_content_shape')
    }
    expect(failure(`insert into heritage_challenge_templates (name, content) values ('x', jsonb_set(${sampleJson}, '{title,hr}', to_jsonb(repeat('x', 270000))));`))
      .toContain('heritage_challenge_templates_content_shape')
    expect(failure(`update heritage_challenge_templates set revision = 9 where id = '${SAMPLE_ID}';`)).toContain('revision is managed by the database')
    expect(rolledBack(`insert into heritage_challenge_templates (name, content) values ('Žabno ČIPKA', ${sampleJson}) returning search_text || ' ' || status || ' ' || revision || ' ' || is_current;`).split('\n')[0])
      .toBe('zabno cipka draft 1 false')
    for (const role of ['anon', 'authenticated']) {
      expect(failure(`set local role ${role}; select count(*) from heritage_challenge_templates;`)).toContain('permission denied')
    }
    expect(psql('select relrowsecurity from pg_class where relname = \'heritage_challenge_templates\'')).toBe('t')
  })

  it('creates, lists, edits, archives and deletes templates through the admin API with the shared validator', async () => {
    expect((await fetch(BASE)).status).toBe(401)
    const invalid = await api(BASE, { method: 'POST', body: { name: 'kit-test', content: { ...sampleContent, rounds: [{ ...sampleContent.rounds[0], questions: [{ ...sampleContent.rounds[0]!.questions[0], correct: 9 }] }] } } })
    expect(invalid.status).toBe(400)
    expect(invalid.body.data).toMatchObject({ code: 'invalid', issues: [{ path: 'content.rounds.0.questions.0.correct', message: 'Označi točan odgovor.' }] })

    const created = await api<{ entity: ChallengeTemplate }>(BASE, { method: 'POST', body: { name: '  kit-test Proljetni izazov ', content: { ...sampleContent, version: 7 }, status: 'draft', id: 'forged', revision: 5 } })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const entity = created.body.entity
    expect(entity).toMatchObject({ name: 'kit-test Proljetni izazov', content: sampleContent, isCurrent: false, status: 'draft', revision: 1 })

    const list = await api<ContentList<ChallengeTemplate>>(`${BASE}?q=${encodeURIComponent('proljetni')}`)
    expect(list.body.rows.map(row => row.id)).toEqual([entity.id])
    expect((await api<ContentList<ChallengeTemplate>>(`${BASE}?sort=-isCurrent&size=100`)).body.rows[0]!.isCurrent).toBe(true)

    // A draft cannot become current; the validator says so on the field.
    const draftCurrent = await api(`${BASE}/${entity.id}`, { method: 'PATCH', body: { isCurrent: true, revision: 1 } })
    expect(draftCurrent.status).toBe(400)
    expect(draftCurrent.body.data).toMatchObject({ issues: [{ path: 'isCurrent', message: 'Trenutni izazov mora biti objavljen.' }] })

    const content = structuredClone(sampleContent)
    content.title.hr = 'Proljeće'
    const saved = await api<{ entity: ChallengeTemplate }>(`${BASE}/${entity.id}`, { method: 'PATCH', body: { content, status: 'published', revision: 1 } })
    expect(saved.status).toBe(200)
    expect(saved.body.entity).toMatchObject({ name: 'kit-test Proljetni izazov', content: { title: { hr: 'Proljeće' } }, status: 'published', revision: 2 })
    expect((await api(`${BASE}/${entity.id}`, { method: 'PATCH', body: { name: 'stari', revision: 1 } })).body.data).toMatchObject({ code: 'revision-conflict', current: { revision: 2 } })

    expect((await api<{ references: unknown }>(`${BASE}/${entity.id}/references`)).body).toEqual({ blocking: false, groups: [] })
    expect((await api(`${BASE}/${entity.id}`, { method: 'DELETE' })).body).toMatchObject({ mode: 'archive', entity: { status: 'archived', revision: 3 } })
    expect((await api(`${BASE}/${entity.id}?mode=hard`, { method: 'DELETE' })).body).toEqual({ mode: 'hard', id: entity.id })
    expect(psql(`select string_agg(action || revision, ',' order by id) from content_revisions where entity_kind = 'challenge_template' and entity_id = '${entity.id}'`))
      .toBe('insert1,update2,update3,delete4')
  })

  it('refuses through the API to archive, delete or switch off the current template, with the database message', async () => {
    const current = (await api<{ entity: ChallengeTemplate }>(`${BASE}/${SAMPLE_ID}`)).body.entity
    expect(current).toMatchObject({ id: SAMPLE_ID, name: 'Izazov zavičaja — uzorak' })
    const archive = await api(`${BASE}/${SAMPLE_ID}`, { method: 'DELETE' })
    const remove = await api(`${BASE}/${SAMPLE_ID}?mode=hard`, { method: 'DELETE' })
    expect(current.isCurrent).toBe(true)
    expect(archive).toMatchObject({ status: 400, body: { data: { message: expect.stringContaining('Trenutni izazov mora ostati objavljen.') } } })
    expect(remove).toMatchObject({ status: 400, body: { data: { message: expect.stringContaining('Trenutni izazov ne može se obrisati.') } } })
    const off = await api(`${BASE}/${SAMPLE_ID}`, { method: 'PATCH', body: { isCurrent: false, revision: current.revision } })
    expect(off).toMatchObject({ status: 400, body: { data: { message: expect.stringContaining('Trenutni izazov ostaje trenutni') } } })
    expect(psql(`select status from heritage_challenge_templates where id = '${SAMPLE_ID}'`)).toBe('published')
  })

  it('creates new fixed challenges from the template made current in the admin, and a restore never changes which one is current', async () => {
    const created = await api<{ entity: ChallengeTemplate }>(BASE, { method: 'POST', body: { name: 'kit-test Kopija', content: sampleContent, status: 'published' } })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const copy = created.body.entity
    const switched = await api<{ entity: ChallengeTemplate }>(`${BASE}/${copy.id}`, { method: 'PATCH', body: { isCurrent: true, revision: 1 } })
    expect(switched.body.entity).toMatchObject({ isCurrent: true, revision: 2 })
    expect(psql('select string_agg(id::text, \',\') from heritage_challenge_templates where is_current')).toBe(copy.id)

    // The save dropped this process's cached template, so the next challenge already uses the copy.
    const overview = await fetch('/api/challenges/template')
    expect(await overview.json()).toMatchObject({ sample: true, maxScore: 1500 })
    const challenge = await fetch('/api/challenges', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.251' }, body: JSON.stringify({ nickname: 'Kopija' })
    })
    expect(challenge.status, await challenge.clone().text()).toBe(201)
    const { code } = await challenge.json() as { code: string }
    expect(psql(`select (content->>'templateId') || ' ' || (content->>'version') || ' ' || jsonb_array_length(content->'rounds') from heritage_challenges where code = '${code}'`))
      .toBe(`${copy.id} 2 3`)

    // Restoring the first version (saved when the copy was not current) brings back its name only.
    const renamed = await api<{ entity: ChallengeTemplate }>(`${BASE}/${copy.id}`, { method: 'PATCH', body: { name: 'kit-test Preimenovana', revision: 2 } })
    expect(renamed.body.entity).toMatchObject({ name: 'kit-test Preimenovana', isCurrent: true, revision: 3 })
    const first = psql(`select id from content_revisions where entity_kind = 'challenge_template' and entity_id = '${copy.id}' and revision = 1`)
    const restored = await api<{ entity: ChallengeTemplate }>(`${BASE}/${copy.id}/restore`, { method: 'POST', body: { revisionId: Number(first), revision: 3 } })
    expect(restored.status, JSON.stringify(restored.body)).toBe(200)
    expect(restored.body.entity).toMatchObject({ name: 'kit-test Kopija', isCurrent: true, revision: 4 })

    // Switch back to the sample, then clean up the copy.
    const sampleNow = (await api<{ entity: ChallengeTemplate }>(`${BASE}/${SAMPLE_ID}`)).body.entity
    expect(sampleNow.isCurrent).toBe(false)
    const back = await api<{ entity: ChallengeTemplate }>(`${BASE}/${SAMPLE_ID}`, { method: 'PATCH', body: { isCurrent: true, revision: sampleNow.revision } })
    expect(back.body.entity).toMatchObject({ isCurrent: true })
    expect((await api(`${BASE}/${copy.id}?mode=hard`, { method: 'DELETE' })).body).toEqual({ mode: 'hard', id: copy.id })
    expect(psql('select string_agg(id::text, \',\') from heritage_challenge_templates where is_current')).toBe(SAMPLE_ID)
  })
})
