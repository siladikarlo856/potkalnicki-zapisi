import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import type { ChallengeSetPublic, ChallengeState } from '../shared/utils/challenge'
import type { ChallengeTemplate } from '../shared/utils/content/challengeTemplate'
import { contentUuid } from './helpers/contentUuid'
import sample from './fixtures/heritage/challenge.json'
import { setupNuxtServer } from './support/nuxtServer'

const url = process.env.TEST_CHALLENGE_API_URL
const key = process.env.TEST_CHALLENGE_SERVICE_KEY ?? ''
const container = process.env.TEST_CHALLENGE_CONTAINER ?? ''
const SECRET = 'challenge-sets-review-secret-0123456789'
const SAMPLE_ID = contentUuid('challenge_template:sample')
const { version: _version, ...sampleContent } = sample

if (url) await setupNuxtServer({ NUXT_SUPABASE_URL: url, NUXT_SUPABASE_SERVICE_ROLE_KEY: key, NUXT_REVIEW_SECRET: SECRET })

function psql(input: string) {
  if (!/^ksh-challenge-test-[a-f0-9]+$/.test(container)) throw new Error('Refusing non-isolated database')
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

let ip = 0
async function api<T = Record<string, unknown>>(path: string, init: { method?: string, body?: unknown } = {}) {
  const headers: Record<string, string> = {
    'x-forwarded-for': `192.0.2.${++ip % 250}`,
    ...(path.startsWith('/api/admin') ? { authorization: `Bearer ${SECRET}` } : {})
  }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T }
}

const BASE = '/api/admin/content/challenge_template'

describe.skipIf(!url)('published challenge sets API', () => {
  it('lists published sets without leaking questions or answers', async () => {
    const { status, body } = await api<ChallengeSetPublic[]>('/api/challenges/sets')
    expect(status).toBe(200)
    expect(body.length).toBeGreaterThanOrEqual(1)
    expect(body[0]!.id).toBe(SAMPLE_ID)
    const text = JSON.stringify(body)
    expect(text).not.toMatch(/correct|explanation|"options"/)
    expect(text).not.toContain('hiža')
    expect(body[0]).toMatchObject({
      sample: true,
      rounds: expect.arrayContaining([expect.objectContaining({ count: expect.any(Number) })])
    })
  })

  it('creates a challenge from a published set and marks meta.source as set', async () => {
    const created = await api<{ entity: ChallengeTemplate }>(BASE, {
      method: 'POST',
      body: {
        name: 'sets-test Proljetni',
        content: {
          ...sampleContent,
          sample: false,
          meta: { source: 'set', topics: ['rijeci'], difficulty: 'lako' }
        },
        status: 'published'
      }
    })
    expect(created.status).toBe(201)
    const setId = created.body.entity.id

    const challenge = await api<ChallengeState>('/api/challenges', {
      body: { nickname: 'SetIgra', set: setId }
    })
    expect(challenge.status, JSON.stringify(challenge.body)).toBe(201)
    expect(psql(`select content->'meta'->>'source' from heritage_challenges where code = '${challenge.body.code}'`)).toBe('set')
    expect(psql(`select content->'meta'->'topics'->>0 from heritage_challenges where code = '${challenge.body.code}'`)).toBe('rijeci')
    expect(psql(`select content->>'templateId' from heritage_challenges where code = '${challenge.body.code}'`)).toBe(setId)

    await api(`${BASE}/${setId}?mode=hard`, { method: 'DELETE' })
  })

  it('rejects creating from an unpublished or unknown set id', async () => {
    const draft = await api<{ entity: ChallengeTemplate }>(BASE, {
      method: 'POST',
      body: { name: 'sets-test Draft', content: sampleContent, status: 'draft' }
    })
    expect(draft.status).toBe(201)
    const bad = await api('/api/challenges', { body: { nickname: 'Ana', set: draft.body.entity.id } })
    expect(bad.status).toBe(400)
    const missing = await api('/api/challenges', { body: { nickname: 'Ana', set: '00000000-0000-4000-8000-000000000099' } })
    expect(missing.status).toBe(400)
    await api(`${BASE}/${draft.body.entity.id}?mode=hard`, { method: 'DELETE' })
  })
})
