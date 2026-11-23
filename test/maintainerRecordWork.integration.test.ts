import { randomBytes, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { InboxMemoryDraftResult } from '../shared/types/inbox'
import type { AdminWord } from '../shared/utils/word'
import { integrationDb } from './support/integrationDb'

// Maintainer editorial work uses the same server capability map as password and automation sessions.
// Social maintainer access to these paths is asserted in test/adminGuardCapabilities.test.ts.
const SECRET = 'maintainer-record-work-secret-0123456789ab'
const SESSION_PASSWORD = 'maintainer-record-work-session-password-012345678'

const db = await integrationDb({ server: { NUXT_REVIEW_SECRET: SECRET, NUXT_ADMIN_SESSION_PASSWORD: SESSION_PASSWORD } })
const { sql, fetch } = db

const unique = () => randomBytes(4).toString('hex')

function formToken(ageSeconds = 30) {
  const signingKey = createHmac('sha256', SESSION_PASSWORD).update('submission-form-token').digest()
  const issuedAt = String(Math.floor(Date.now() / 1000) - ageSeconds)
  return `${issuedAt}.${createHmac('sha256', signingKey).update(issuedAt).digest('base64url')}`
}

let ipCounter = 0
const newIp = () => `198.52.100.${++ipCounter}`

async function admin<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T }
}

async function submit(body: Record<string, unknown>) {
  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': newIp() },
    body: JSON.stringify({ text: 'Bilješka uz prijedlog.', consentPublish: true, locale: 'hr', name: 'Ana Horvat', formToken: formToken(), ...body })
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

async function latestSubmissionId(type: string) {
  return Number(sql(`select id from public.heritage_submissions where type = '${type}' order by id desc limit 1;`))
}

describe.skipIf(!db.enabled)('maintainer capability matrix — editorial record work', () => {
  it('promotes a word proposal from the inbox into a published record', async () => {
    const suffix = unique()
    const headword = `vrpca${suffix}`
    expect((await submit({ type: 'proposal', targetKind: 'word', payload: { headword, meaningHr: 'objašnjenje', example: 'Primjer.' } })).status).toBe(201)
    const submissionId = await latestSubmissionId('proposal')
    const draft = await admin<{ kind: string, id: string }>(`/api/admin/inbox/${submissionId}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(201)
    const loaded = await admin<{ entity: AdminWord }>(`/api/admin/content/word/${draft.body.id}`)
    const entity = loaded.body.entity
    const finished = await admin(`/api/admin/content/word/${draft.body.id}`, {
      method: 'PATCH',
      body: {
        entry: { ...entity.entry, partOfSpeech: 'imenica' },
        areas: entity.areas,
        status: 'published',
        revision: entity.revision
      }
    })
    expect(finished.status, JSON.stringify(finished.body)).toBe(200)
    expect(sql(`select status from public.heritage_submissions where id = ${submissionId};`)).toBe('approved')
    sql(`delete from public.heritage_words where id = '${draft.body.id}'`)
  })

  it('publishes a settlement draft started from a place proposal', async () => {
    const suffix = unique()
    const parent = sql(`select id from public.areas where kind = 'town' and slug = 'grad-krizevci' limit 1;`)
    expect((await submit({ type: 'proposal', targetKind: 'area', payload: { name: `Selo ${suffix}`, parentId: parent } })).status).toBe(201)
    const submissionId = await latestSubmissionId('proposal')
    const draft = await admin<{ id: string }>(`/api/admin/inbox/${submissionId}/draft`, { method: 'POST', body: {} })
    expect(draft.status).toBe(201)
    const loaded = await admin<{ entity: { revision: number } }>(`/api/admin/content/area/${draft.body.id}`)
    const published = await admin(`/api/admin/content/area/${draft.body.id}`, {
      method: 'PATCH',
      body: { status: 'published', revision: loaded.body.entity.revision, applySubmissionId: submissionId, applyCredit: true }
    })
    expect(published.status).toBe(200)
    expect(sql(`select status from public.heritage_submissions where id = ${submissionId};`)).toBe('approved')
    sql(`delete from public.areas where id = '${draft.body.id}'`)
  })

  it('starts and publishes an intangible story draft from a memory submission', async () => {
    const suffix = unique()
    const storyType = sql(`select id from story_types where key = 'zivotna-prica'`)
    const sender = sql(`with s as (insert into heritage_submissions (text, type, name, place, consent_publish, consent_version, locale, status)
      values ('Sjećanje ${suffix}', 'memory', 'Mara', 'Apatovec', true, 'test', 'hr', 'pending') returning id) select id from s`)
    const started = await admin<InboxMemoryDraftResult>(`/api/admin/inbox/${sender}/memory-draft`, {
      method: 'POST', body: { kind: 'story', typeId: storyType }
    })
    expect(started.status).toBe(201)
    const loaded = await admin<{ entity: { revision: number, textStandard: string } }>(`/api/admin/content/story/${started.body.id}`)
    const published = await admin(`/api/admin/content/story/${started.body.id}`, {
      method: 'PATCH',
      body: { ...loaded.body.entity, status: 'published', applySubmissionId: Number(sender), applyCredit: true }
    })
    expect(published.status).toBe(200)
    expect(sql(`select status from public.heritage_submissions where id = ${sender};`)).toBe('approved')
    sql(`delete from public.stories where id = '${started.body.id}'`)
    sql(`delete from public.heritage_submissions where id = ${sender}`)
  })
})
