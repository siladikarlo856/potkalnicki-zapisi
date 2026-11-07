import { createHmac, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { InboxDetail, InboxList } from '../shared/types/inbox'
import { integrationDb } from './support/integrationDb'

// The corrections and proposals inbox end to end on a real Postgres: the public submission rules, the inbox API,
// applying a correction and publishing a proposal's draft through the content API, withdrawal, and the spam
// hardening. Run with `node scripts/test-challenges.mjs test/adminInbox.last.integration.test.ts`; skipped elsewhere.
const SECRET = 'inbox-review-secret-0123456789abcdef'
const SESSION_PASSWORD = 'inbox-admin-session-password-0123456789'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET, NUXT_ADMIN_SESSION_PASSWORD: SESSION_PASSWORD } })
const { sql, fetch } = db

const unique = () => randomBytes(4).toString('hex')

interface Reply<T> { status: number, body: T & { data?: { issues?: Array<Record<string, string>>, message?: string } } }

async function admin<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}): Promise<Reply<T>> {
  const headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

let ipCounter = 0
const newIp = () => `198.51.100.${++ipCounter}`

/** A render-time token as the server issues it, aged by `ageSeconds` (it is signed with a key derived from the session secret). */
function formToken(ageSeconds = 30) {
  const signingKey = createHmac('sha256', SESSION_PASSWORD).update('submission-form-token').digest()
  const issuedAt = String(Math.floor(Date.now() / 1000) - ageSeconds)
  return `${issuedAt}.${createHmac('sha256', signingKey).update(issuedAt).digest('base64url')}`
}

async function submit(body: Record<string, unknown>, init: { ip?: string, token?: string | null } = {}): Promise<Reply<Record<string, unknown>>> {
  const token = init.token === undefined ? formToken() : init.token
  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': init.ip ?? newIp() },
    body: JSON.stringify({ text: 'Bilješka uz prijedlog.', consentPublish: true, locale: 'hr', name: 'Ana Horvat', ...(token ? { formToken: token } : {}), ...body })
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

const submissionCount = () => Number(sql('select count(*) from public.heritage_submissions;'))

function world() {
  const id = unique()
  const municipality = sql('select id from public.areas where kind = \'town\' and slug = \'grad-krizevci\' limit 1;')
  const settlement = sql('select id from public.areas where kind = \'settlement\' and slug = \'apatovec\' limit 1;')
  return { id, municipality, settlement }
}

async function makeCategory(suffix: string) {
  const category = await admin<{ entity: { id: string } }>('/api/admin/content/heritage_category', {
    method: 'POST', body: { key: `inbox-${suffix}`, labelHr: `Inbox kategorija ${suffix}`, labelEn: null, sort: 900, status: 'published' }
  })
  expect(category.status).toBe(201)
  return category.body.entity.id
}

async function makeItem(w: ReturnType<typeof world>, categoryId: string, name: string) {
  const item = await admin<{ entity: { id: string, revision: number, slug: string } }>('/api/admin/content/heritage_item', {
    method: 'POST',
    body: { name, slug: `inbox-${unique()}`, categoryId, municipalityId: w.municipality, settlementId: w.settlement, verification: 'unverified', researchNotes: '', sourceIds: [], status: 'published' }
  })
  expect(item.status).toBe(201)
  return item.body.entity
}

const inbox = (query = '') => admin<InboxList>(`/api/admin/inbox?status=all&size=100${query}`)
const detail = (id: number | string) => admin<InboxDetail>(`/api/admin/inbox/${id}`)
async function latestSubmissionId(type: string) {
  return sql(`select max(id) from public.heritage_submissions where type = '${type}';`)
}

describe.skipIf(!db.enabled)('corrections and proposals inbox over real Postgres', () => {
  it('guards the inbox like every other admin route', async () => {
    expect((await fetch('/api/admin/inbox')).status).toBe(401)
    expect((await fetch('/api/admin/inbox/summary')).status).toBe(401)
    expect((await fetch('/api/admin/inbox/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401)
    expect((await admin('/api/admin/inbox/summary')).body).toHaveProperty('pending')
    expect((await fetch('/api/submission-token')).status).toBe(200)
  })

  it('redirects the retired queue pages to the inbox', async () => {
    for (const old of ['/admin/prilozi', '/admin/bastina-ispravci']) {
      const response = await fetch(old, { redirect: 'manual' })
      expect(response.status).toBe(301)
      expect(new URL(response.headers.get('location') ?? '', 'http://localhost').pathname).toBe('/admin/prijedlozi')
    }
  })

  it('takes a correction, shows the diff, applies it in one write, credits the contributor and refreshes the public page', async () => {
    const w = world()
    const categoryId = await makeCategory(w.id)
    const item = await makeItem(w, categoryId, `Kapela ${w.id}`)

    const sent = await submit({ type: 'correction', targetKind: 'heritage_item', targetId: item.id, payload: { name: `Kapela sv. Ane ${w.id}`, period: '18. stoljeće', sourceNote: 'Župna kronika' } })
    expect(sent.status).toBe(201)
    const id = await latestSubmissionId('correction')
    const row = (await inbox()).body.rows.find(entry => entry.id === Number(id))!
    expect(row).toMatchObject({ type: 'correction', status: 'pending', targetKind: 'heritage_item', targetId: item.id, baseRevision: item.revision, target: { label: `Kapela ${w.id}`, state: 'ok', revision: item.revision } })

    const shown = (await detail(id)).body
    expect(shown.stale).toBe(false)
    expect(shown.changes).toEqual([
      { field: 'name', label: 'Naziv', current: `Kapela ${w.id}`, proposed: `Kapela sv. Ane ${w.id}`, applicable: true },
      { field: 'period', label: 'Razdoblje', current: null, proposed: '18. stoljeće', applicable: true },
      { field: 'sourceNote', label: 'Izvor ili literatura', current: null, proposed: 'Župna kronika', applicable: false }
    ])
    expect(shown.patch).toEqual({ name: `Kapela sv. Ane ${w.id}`, period: '18. stoljeće' })

    // The status route cannot approve around the apply, and a wrong submission id is refused with nothing changed.
    const refused = await admin(`/api/admin/content/heritage_item/${item.id}`, { method: 'PATCH', body: { name: 'Pogrešno', revision: item.revision, applySubmissionId: 999_999 } })
    expect(refused.status).toBe(400)
    expect(sql(`select name from public.heritage_items where id = '${item.id}';`)).toBe(`Kapela ${w.id}`)

    const applied = await admin<{ entity: { name: string, revision: number } }>(`/api/admin/content/heritage_item/${item.id}`, {
      method: 'PATCH', body: { ...shown.patch, revision: item.revision, applySubmissionId: Number(id), applyCredit: true }
    })
    expect(applied.status).toBe(200)
    expect(applied.body.entity.name).toBe(`Kapela sv. Ane ${w.id}`)
    expect(sql(`select submission_id from public.content_revisions where entity_id = '${item.id}' and revision = ${item.revision + 1};`)).toBe(id)

    const after = (await inbox()).body.rows.find(entry => entry.id === Number(id))!
    expect(after).toMatchObject({ status: 'approved', appliedEntityId: item.id })
    expect(after.appliedAt).not.toBeNull()
    expect(JSON.parse(sql(`select credits from public.heritage_items where id = '${item.id}';`))).toEqual([expect.objectContaining({ name: 'Ana Horvat', kind: 'correction' })])
    // Every applied change invalidates the public snapshot, so the page shows the new name on the next request.
    const target = await (await fetch(`/api/content/target?kind=heritage_item&id=${item.id}`)).json()
    expect(target.item.name).toBe(`Kapela sv. Ane ${w.id}`)

    // Applied once; only deletion removes it, and that strips the credit but keeps the change.
    expect((await admin(`/api/admin/content/heritage_item/${item.id}`, { method: 'PATCH', body: { revision: applied.body.entity.revision, applySubmissionId: Number(id) } })).status).toBe(400)
    expect((await admin(`/api/admin/inbox/${id}`, { method: 'PATCH', body: { status: 'rejected' } })).status).toBe(409)
    expect((await admin(`/api/admin/inbox/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect(sql(`select name || ' ' || credits::text from public.heritage_items where id = '${item.id}';`)).toBe(`Kapela sv. Ane ${w.id} []`)
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${item.id}' and data::text like '%Ana Horvat%';`)).toBe('0')
  })

  it('warns when the target changed since the correction was sent and keeps the contributor out on request', async () => {
    const w = world()
    const item = await makeItem(w, await makeCategory(w.id), `Križ ${w.id}`)
    expect((await submit({ type: 'correction', targetKind: 'heritage_item', targetId: item.id, payload: { locality: 'Brdo' } })).status).toBe(201)
    const id = await latestSubmissionId('correction')

    const edited = await admin<{ entity: { revision: number } }>(`/api/admin/content/heritage_item/${item.id}`, { method: 'PATCH', body: { researchNotes: 'Nova bilješka', revision: item.revision } })
    expect(edited.status).toBe(200)
    expect((await detail(id)).body.stale).toBe(true)

    const applied = await admin(`/api/admin/content/heritage_item/${item.id}`, { method: 'PATCH', body: { locality: 'Brdo', revision: edited.body.entity.revision, applySubmissionId: Number(id), applyCredit: false } })
    expect(applied.status).toBe(200)
    expect(sql(`select credits::text from public.heritage_items where id = '${item.id}';`)).toBe('[]')
    expect(sql(`select status from public.heritage_submissions where id = ${id};`)).toBe('approved')
  })

  it('applies a word correction through the word editor path', async () => {
    const wordId = crypto.randomUUID()
    const entry = { id: wordId, headword: `kaj${unique()}`, meaning: { hr: 'što' }, partOfSpeech: 'zamjenica', status: 'community', sources: [{ id: 'izvor-1', kind: 'editor', credit: 'urednik' }], variants: [] as unknown[] }
    entry.variants = [{ id: 'v1', form: entry.headword, status: 'community', usages: [] }]
    sql(`insert into public.heritage_words(id, entry, active) values ('${wordId}', '${JSON.stringify(entry).replace(/'/g, '\'\'')}'::jsonb, true);`)

    expect((await submit({ type: 'correction', targetKind: 'word', targetId: wordId, payload: { meaningHr: 'što (upitno)', example: 'Kaj je to?' } })).status).toBe(201)
    const id = await latestSubmissionId('correction')
    const shown = (await detail(id)).body
    expect(shown.changes.map(change => [change.field, change.current, change.proposed])).toEqual([['meaningHr', 'što', 'što (upitno)'], ['example', null, 'Kaj je to?']])

    const current = await admin<{ entity: { revision: number, areas: unknown[] } }>(`/api/admin/content/word/${wordId}`)
    const applied = await admin(`/api/admin/content/word/${wordId}`, {
      method: 'PATCH', body: { entry: shown.patch!.entry, areas: current.body.entity.areas, status: 'published', revision: current.body.entity.revision, applySubmissionId: Number(id), applyCredit: true }
    })
    expect(applied.status).toBe(200)
    const stored = JSON.parse(sql(`select entry from public.heritage_words where id = '${wordId}';`))
    expect(stored.meaning.hr).toBe('što (upitno)')
    expect(stored.examples).toEqual([{ text: 'Kaj je to?' }])
    expect(stored.sources.at(-1)).toMatchObject({ kind: 'contribution', credit: 'Ana Horvat' })
    expect(sql(`select status from public.heritage_submissions where id = ${id};`)).toBe('approved')

    // Deleting the submission strips the credit from the word and from its stored revisions.
    expect((await admin(`/api/admin/inbox/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect(sql(`select count(*) from public.heritage_words where id = '${wordId}' and entry::text like '%Ana Horvat%';`)).toBe('0')
    expect(sql(`select count(*) from public.content_revisions where entity_id = '${wordId}' and data::text like '%Ana Horvat%';`)).toBe('0')
  })

  it('turns an item proposal into one draft, and publishing the draft approves it with a credit; deleting withdraws both', async () => {
    const w = world()
    const categoryId = await makeCategory(w.id)
    expect((await submit({ type: 'proposal', targetKind: 'heritage_item', payload: { name: `Nova kapela ${w.id}`, categoryId, settlementId: w.settlement, description: 'Stoji uz cestu.' } })).status).toBe(201)
    const id = await latestSubmissionId('proposal')

    const draft = await admin<{ kind: string, id: string, created: boolean }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(201)
    expect(draft.body).toMatchObject({ kind: 'heritage_item', created: true })
    const again = await admin<{ id: string, created: boolean }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(again.status).toBe(200)
    expect(again.body).toMatchObject({ id: draft.body.id, created: false })
    expect(sql(`select count(*) from public.heritage_items where source_submission_id = ${id};`)).toBe('1')
    expect(JSON.parse(sql(`select to_jsonb(i) - 'search_text' from public.heritage_items i where id = '${draft.body.id}';`))).toMatchObject({
      name: `Nova kapela ${w.id}`, status: 'draft', category_id: categoryId, municipality_id: w.municipality, settlement_id: w.settlement, description: 'Stoji uz cestu.'
    })
    expect((await inbox()).body.rows.find(entry => entry.id === Number(id))!.created).toMatchObject({ kind: 'heritage_item', id: draft.body.id, status: 'draft' })

    const created = await admin<{ entity: { revision: number } }>(`/api/admin/content/heritage_item/${draft.body.id}`)
    // Publishing as an ordinary edit applies the proposal: approved, credited, attributed.
    const published = await admin(`/api/admin/content/heritage_item/${draft.body.id}`, { method: 'PATCH', body: { status: 'published', revision: created.body.entity.revision } })
    expect(published.status).toBe(200)
    expect(sql(`select status from public.heritage_submissions where id = ${id};`)).toBe('approved')
    expect(JSON.parse(sql(`select credits from public.heritage_items where id = '${draft.body.id}';`))).toEqual([expect.objectContaining({ name: 'Ana Horvat', kind: 'proposal' })])
    expect((await (await fetch(`/api/content/target?kind=heritage_item&id=${draft.body.id}`)).json()).item.name).toBe(`Nova kapela ${w.id}`)

    // Deleting the proposal unpublishes what it created and strips the credit.
    expect((await admin(`/api/admin/inbox/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect(sql(`select status || ' ' || credits::text from public.heritage_items where id = '${draft.body.id}';`)).toBe('draft []')
    expect((await fetch(`/api/content/target?kind=heritage_item&id=${draft.body.id}`)).status).toBe(404)
  })

  it('makes settlement, source and word drafts from proposals, and lets an admin publish a draft without a credit', async () => {
    const suffix = unique()
    const parent = sql('select id from public.areas where kind = \'town\' and slug = \'grad-krizevci\' limit 1;')
    expect((await submit({ type: 'proposal', targetKind: 'area', payload: { name: `Novo selo ${suffix}`, parentId: parent, localNames: 'Selce' } })).status).toBe(201)
    const areaSubmission = await latestSubmissionId('proposal')
    const area = await admin<{ kind: string, id: string }>(`/api/admin/inbox/${areaSubmission}/draft`, { method: 'POST', body: {} })
    expect(area.status).toBe(201)
    expect(JSON.parse(sql(`select to_jsonb(a) - 'search_text' from public.areas a where id = '${area.body.id}';`))).toMatchObject({
      kind: 'settlement', parent_id: parent, name: `Novo selo ${suffix}`, status: 'draft', source_submission_id: Number(areaSubmission)
    })
    const draftArea = await admin<{ entity: { revision: number } }>(`/api/admin/content/area/${area.body.id}`)
    const publishedArea = await admin(`/api/admin/content/area/${area.body.id}`, {
      method: 'PATCH', body: { status: 'published', revision: draftArea.body.entity.revision, applySubmissionId: Number(areaSubmission), applyCredit: false }
    })
    expect(publishedArea.status).toBe(200)
    expect(sql(`select status || ' ' || credits::text from public.areas where id = '${area.body.id}';`)).toBe('published []')
    expect(sql(`select status from public.heritage_submissions where id = ${areaSubmission};`)).toBe('approved')

    expect((await submit({ type: 'proposal', targetKind: 'source', payload: { title: `Knjiga ${suffix}`, type: 'publication', author: 'A. Autor', year: '1990', url: 'https://example.org/knjiga' } })).status).toBe(201)
    const sourceSubmission = await latestSubmissionId('proposal')
    const source = await admin<{ id: string }>(`/api/admin/inbox/${sourceSubmission}/draft`, { method: 'POST', body: {} })
    expect(JSON.parse(sql(`select to_jsonb(s) - 'search_text' from public.sources s where id = '${source.body.id}';`))).toMatchObject({
      title: `Knjiga ${suffix}`, type: 'publication', url: 'https://example.org/knjiga', status: 'draft', note: 'Autor: A. Autor\nGodina: 1990'
    })

    expect((await submit({ type: 'proposal', targetKind: 'word', payload: { headword: `zdravo${suffix}`, meaningHr: 'pozdrav', example: 'Zdravo, susjede!' } })).status).toBe(201)
    const wordSubmission = await latestSubmissionId('proposal')
    const word = await admin<{ kind: string, id: string }>(`/api/admin/inbox/${wordSubmission}/draft`, { method: 'POST', body: {} })
    expect(word.body.kind).toBe('word')
    expect(JSON.parse(sql(`select jsonb_build_object('active', active, 'headword', entry->>'headword', 'meaning', entry->'meaning'->>'hr', 'submission', submission_id) from public.heritage_words where id = '${word.body.id}';`)))
      .toEqual({ active: false, headword: `zdravo${suffix}`, meaning: 'pozdrav', submission: Number(wordSubmission) })
  })

  it('refuses drafts from corrections and from rejected proposals, and rejecting a proposal withdraws its row', async () => {
    const w = world()
    const categoryId = await makeCategory(w.id)
    const item = await makeItem(w, categoryId, `Kapela ${w.id}`)
    expect((await submit({ type: 'correction', targetKind: 'heritage_item', targetId: item.id, payload: { name: 'Drugo ime' } })).status).toBe(201)
    expect((await admin(`/api/admin/inbox/${await latestSubmissionId('correction')}/draft`, { method: 'POST', body: {} })).status).toBe(400)

    expect((await submit({ type: 'proposal', targetKind: 'heritage_item', payload: { name: `Druga kapela ${w.id}`, categoryId, municipalityId: w.municipality } })).status).toBe(201)
    const id = await latestSubmissionId('proposal')
    const draft = await admin<{ id: string }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    const current = await admin<{ entity: { revision: number } }>(`/api/admin/content/heritage_item/${draft.body.id}`)
    expect((await admin(`/api/admin/content/heritage_item/${draft.body.id}`, { method: 'PATCH', body: { status: 'published', revision: current.body.entity.revision } })).status).toBe(200)
    expect((await admin(`/api/admin/inbox/${id}`, { method: 'PATCH', body: { status: 'pending' } })).status).toBe(409)
    expect(sql(`select status from public.heritage_submissions where id = ${id};`)).toBe('approved')
    expect((await admin(`/api/admin/inbox/${id}`, { method: 'DELETE' })).status).toBe(200)

    expect((await submit({ type: 'proposal', targetKind: 'heritage_item', payload: { name: `Treća kapela ${w.id}`, categoryId, municipalityId: w.municipality } })).status).toBe(201)
    const rejected = await latestSubmissionId('proposal')
    expect((await admin(`/api/admin/inbox/${rejected}`, { method: 'PATCH', body: { status: 'rejected' } })).status).toBe(200)
    expect((await admin(`/api/admin/inbox/${rejected}/draft`, { method: 'POST', body: {} })).status).toBe(409)
    expect((await admin(`/api/admin/inbox/${rejected}`, { method: 'PATCH', body: { status: 'nonsense' } })).status).toBe(400)
  })

  it('validates a draft made from a proposal like an admin save: an invalid one is refused and writes nothing', async () => {
    const w = world()
    const categoryId = await makeCategory(w.id)
    expect((await submit({ type: 'proposal', targetKind: 'heritage_item', payload: { name: `Kapela ${w.id}`, categoryId, municipalityId: w.municipality } })).status).toBe(201)
    const id = await latestSubmissionId('proposal')
    // A proposal stored before a rule existed (the intake is looser than the heritage item's own rules).
    sql(`update public.heritage_submissions set payload = jsonb_set(payload, '{name}', to_jsonb(repeat('k', 250))) where id = ${id};`)
    const revisions = sql('select count(*) from public.content_revisions;')

    const draft = await admin(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(400)
    expect(draft.body.data?.issues).toContainEqual(expect.objectContaining({ path: 'name' }))
    expect(sql(`select count(*) from public.heritage_items where source_submission_id = ${id};`)).toBe('0')
    expect(sql('select count(*) from public.content_revisions;')).toBe(revisions)
  })

  it('makes a word draft from a proposal once, through the word\'s own save, and publishing it approves the proposal', async () => {
    const headword = `bok${unique()}`
    expect((await submit({ type: 'proposal', targetKind: 'word', payload: { headword, meaningHr: 'pozdrav', example: 'Bok, susjede!' } })).status).toBe(201)
    const id = await latestSubmissionId('proposal')
    const draft = await admin<{ kind: string, id: string, created: boolean }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(201)
    expect(draft.body).toMatchObject({ kind: 'word', created: true })
    const again = await admin<{ id: string, created: boolean }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(again.status).toBe(200)
    expect(again.body).toMatchObject({ id: draft.body.id, created: false })
    expect((await inbox()).body.rows.find(entry => entry.id === Number(id))!.created).toMatchObject({ kind: 'word', id: draft.body.id, status: 'draft' })

    const current = await admin<{ entity: { revision: number, status: string, submissionId: number, entry: Record<string, unknown> } }>(`/api/admin/content/word/${draft.body.id}`)
    expect(current.body.entity).toMatchObject({ status: 'draft', submissionId: Number(id), entry: { headword, meaning: { hr: 'pozdrav' }, examples: [{ text: 'Bok, susjede!' }], sources: [{ kind: 'contribution' }] } })
    const published = await admin(`/api/admin/content/word/${draft.body.id}`, {
      method: 'PATCH', body: { status: 'published', revision: current.body.entity.revision, entry: { ...current.body.entity.entry, partOfSpeech: 'uzvik' } }
    })
    expect(published.status).toBe(200)
    expect(sql(`select status from public.heritage_submissions where id = ${id};`)).toBe('approved')
    expect(sql(`select active from public.heritage_words where id = '${draft.body.id}';`)).toBe('t')
  })

  it('validates a word draft made from a proposal like an admin save: an invalid one is refused and writes nothing', async () => {
    expect((await submit({ type: 'proposal', targetKind: 'word', payload: { headword: `dugo${unique()}`, meaningHr: 'značenje' } })).status).toBe(201)
    const id = await latestSubmissionId('proposal')
    // A proposal stored before a rule existed (the intake is looser than the word's own rules).
    sql(`update public.heritage_submissions set payload = jsonb_set(payload, '{meaningHr}', to_jsonb(repeat('z', 2500))) where id = ${id};`)

    const draft = await admin(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(400)
    expect(draft.body.data?.issues).toContainEqual(expect.objectContaining({ path: 'meaning.hr' }))
    expect(sql(`select count(*) from public.heritage_words where submission_id = ${id};`)).toBe('0')
  })

  it('makes a person draft from a proposal with its place, through the person\'s own save', async () => {
    const w = world()
    expect((await submit({ type: 'proposal', targetKind: 'person', payload: { name: `Ivana Horvat ${w.id}`, born: '1880.', died: '1950.', settlementId: w.settlement, significance: 'Učiteljica.', sourceUrl: 'https://example.org/ivana' } })).status).toBe(201)
    const id = await latestSubmissionId('proposal')
    const draft = await admin<{ kind: string, id: string, created: boolean }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(201)
    expect(draft.body).toMatchObject({ kind: 'person', created: true })
    expect(JSON.parse(sql(`select jsonb_build_object('status', status, 'born_year', born_year, 'died_year', died_year, 'from', source_submission_id) from public.persons where id = '${draft.body.id}';`)))
      .toEqual({ status: 'draft', born_year: 1880, died_year: 1950, from: Number(id) })
    const person = await admin<{ entity: { areaLinks: unknown[] } }>(`/api/admin/content/person/${draft.body.id}`)
    expect(person.body.entity.areaLinks).toEqual([{ areaId: w.settlement, role: 'djelovao' }])
    // The draft's revision records its place, as every person save does.
    expect(sql(`select data->'sidecars'->'areaLinks'->0->>'areaId' from public.content_revisions where entity_id = '${draft.body.id}' order by revision limit 1;`)).toBe(w.settlement)
    expect((await admin<{ created: boolean }>(`/api/admin/inbox/${id}/draft`, { method: 'POST', body: {} })).body.created).toBe(false)
  })

  it('enforces who may submit what and whitelists the payload', async () => {
    const w = world()
    const categoryId = await makeCategory(w.id)
    const item = await makeItem(w, categoryId, `Kapela ${w.id}`)
    const before = submissionCount()

    const refused = async (body: Record<string, unknown>, issue: Record<string, string>) => {
      const reply = await submit(body)
      expect(reply.status).toBe(400)
      expect(reply.body.data?.issues).toContainEqual(expect.objectContaining(issue))
    }
    // Admin-only kinds and a correction for a source are not accepted.
    await refused({ type: 'correction', targetKind: 'heritage_category', targetId: categoryId, payload: { label: 'x' } }, { field: 'targetKind', code: 'invalid' })
    await refused({ type: 'correction', targetKind: 'source', targetId: item.id, payload: { title: 'x' } }, { field: 'targetKind', code: 'outOfScope' })
    // Mass assignment: ids, status, slug and credits are never copied from a payload.
    await refused({ type: 'correction', targetKind: 'heritage_item', targetId: item.id, payload: { name: 'x', status: 'published', credits: [] } }, { field: 'payload', code: 'unknown', path: 'status' })
    // Targets must be published and of the right kind.
    await refused({ type: 'correction', targetKind: 'heritage_item', targetId: crypto.randomUUID(), payload: { name: 'x' } }, { field: 'targetId', code: 'invalid' })
    await refused({ type: 'correction', targetKind: 'area', targetId: w.municipality, payload: { name: 'x' } }, { field: 'targetId', code: 'invalid' })
    await refused({ type: 'correction', targetKind: 'word', targetId: item.id, payload: { meaningHr: 'x' } }, { field: 'targetId', code: 'invalid' })
    // A proposal must name published rows a draft can be made from.
    await refused({ type: 'proposal', targetKind: 'heritage_item', payload: { name: 'x', categoryId: crypto.randomUUID(), settlementId: w.settlement } }, { field: 'payload', code: 'invalid', path: 'categoryId' })
    await refused({ type: 'proposal', targetKind: 'area', payload: { name: 'x', parentId: w.settlement } }, { field: 'payload', code: 'invalid', path: 'parentId' })
    expect(submissionCount()).toBe(before)

    // A settlement takes a correction through its UUID, and an old atlas id still resolves to the item's UUID.
    expect((await submit({ type: 'correction', targetKind: 'area', targetId: w.settlement, payload: { name: 'Apatovec (Gornji)' } })).status).toBe(201)
    // The target is target_kind + target_id (the legacy target_ref column is gone).
    expect(sql(`select target_kind || ' ' || target_id from public.heritage_submissions where id = (select max(id) from public.heritage_submissions where type = 'correction');`)).toBe(`area ${w.settlement}`)
    const legacy = sql('select legacy_id from public.content_legacy_ids where kind = \'heritage_item\' limit 1;')
    const legacyId = sql(`select entity_id from public.content_legacy_ids where kind = 'heritage_item' and legacy_id = '${legacy}';`)
    expect((await submit({ type: 'correction', targetKind: 'heritage_item', targetId: legacy, payload: { period: '19. stoljeće' } })).status).toBe(201)
    expect(sql('select target_id from public.heritage_submissions where id = (select max(id) from public.heritage_submissions where type = \'correction\');')).toBe(legacyId)
  })

  it('hardens against spam: link cap, form token, duplicates, per-target throttle and the pending cap', async () => {
    const w = world()
    const item = await makeItem(w, await makeCategory(w.id), `Kapela ${w.id}`)
    const correction = (payload: Record<string, unknown>, text = 'Bilješka uz prijedlog.') => ({ type: 'correction', targetKind: 'heritage_item', targetId: item.id, payload, text })

    // Links: two are fine, three are not, and word fields take none.
    expect((await submit(correction({ period: 'x' }, 'Vidi https://a.example i https://b.example'))).status).toBe(201)
    const links = await submit(correction({ period: 'y' }, 'https://a.example https://b.example https://c.example'))
    expect(links.status).toBe(400)
    expect(links.body.data?.issues).toContainEqual({ field: 'text', code: 'links' })

    // The render-time token: forged or missing is refused, too quick or too old is a silent success that stores nothing.
    const count = submissionCount()
    expect((await submit(correction({ period: 'z1' }), { token: null })).status).toBe(400)
    expect((await submit(correction({ period: 'z2' }), { token: 'forged.token' })).status).toBe(400)
    expect((await submit(correction({ period: 'z3' }), { token: formToken(0) })).status).toBe(201)
    expect((await submit(correction({ period: 'z4' }), { token: formToken(48 * 3600) })).status).toBe(201)
    expect(submissionCount()).toBe(count)
    // The honeypot, the 16 KB cap and the per-IP limit are unchanged: a filled "website" field stores nothing either.
    expect((await submit({ ...correction({ period: 'z5' }), website: 'https://spam.example' })).status).toBe(201)
    expect(submissionCount()).toBe(count)

    // The same correction twice, from different addresses, is stored once; the second answer is a silent 201.
    expect((await submit(correction({ period: '1850.' }, 'Isto   JE'))).status).toBe(201)
    expect(submissionCount()).toBe(count + 1)
    expect((await submit(correction({ period: '1850.' }, 'isto je'))).status).toBe(201)
    expect(submissionCount()).toBe(count + 1)
    expect(Number(sql('select count(*) from public.heritage_submissions where fingerprint is not null;'))).toBeGreaterThan(0)

    // At most three per address and target in a day.
    const ip = newIp()
    for (const period of ['a', 'b', 'c']) expect((await submit(correction({ period }), { ip })).status).toBe(201)
    expect((await submit(correction({ period: 'd' }), { ip })).status).toBe(429)
    expect((await submit(correction({ period: 'd' }), { ip: newIp() })).status).toBe(201)

    // Above 1000 pending submissions the form answers 503 and stores nothing.
    sql('insert into public.heritage_submissions(text, type, consent_publish, consent_version, locale) select \'cap-test\', \'other\', true, \'x\', \'hr\' from generate_series(1, 1000);')
    try {
      expect((await submit(correction({ period: 'cap' }))).status).toBe(503)
      expect((await submit({ type: 'memory', text: 'Sjećanje na bake.' })).status).toBe(503)
    } finally {
      sql('delete from public.heritage_submissions where text = \'cap-test\';')
    }
    expect((await submit(correction({ period: 'after-cap' }))).status).toBe(201)
  })

  it('lists with filters and the pending count, and rejects or deletes several at once', async () => {
    const ids: number[] = []
    for (let i = 0; i < 3; i++) {
      expect((await submit({ type: 'other', text: `Neželjeno ${i} ${unique()}`, name: null }, { token: null })).status).toBe(201)
      ids.push(Number(sql('select max(id) from public.heritage_submissions;')))
    }
    const list = await admin<InboxList>('/api/admin/inbox?status=pending&type=other&size=100')
    expect(list.status).toBe(200)
    expect(list.body.counts.pending).toBeGreaterThanOrEqual(3)
    expect(ids.every(id => list.body.rows.some(row => row.id === id && row.target === null && row.created === null && row.canDraft))).toBe(true)
    expect((await admin<InboxList>('/api/admin/inbox?status=pending&type=other&q=Neželjeno&size=25')).body.rows.length).toBeGreaterThanOrEqual(3)
    expect((await admin('/api/admin/inbox?status=bogus')).status).toBe(400)
    expect((await admin('/api/admin/inbox?targetKind=heritage_category')).status).toBe(400)
    expect((await admin('/api/admin/inbox?size=7')).status).toBe(400)

    expect((await admin('/api/admin/inbox/bulk', { method: 'POST', body: { ids: [], action: 'reject' } })).status).toBe(400)
    expect((await admin('/api/admin/inbox/bulk', { method: 'POST', body: { ids, action: 'ban' } })).status).toBe(400)
    const rejected = await admin<{ done: number, skipped: number }>('/api/admin/inbox/bulk', { method: 'POST', body: { ids, action: 'reject' } })
    expect(rejected.body).toEqual({ done: 3, skipped: 0 })
    expect(sql(`select count(*) from public.heritage_submissions where id in (${ids.join(',')}) and status = 'rejected';`)).toBe('3')
    const deleted = await admin<{ done: number, skipped: number }>('/api/admin/inbox/bulk', { method: 'POST', body: { ids: [...ids, 999_999_999], action: 'delete' } })
    expect(deleted.body).toEqual({ done: 3, skipped: 1 })
    expect(sql(`select count(*) from public.heritage_submissions where id in (${ids.join(',')});`)).toBe('0')
  })
})
