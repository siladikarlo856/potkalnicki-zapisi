import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, getServerLogs, setup, startServer, useTestContext } from '@nuxt/test-utils/e2e'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'

const SECRET = 'test-review-secret-0123456789'
const RATE_LIMIT_MAX = 3

// By default the app talks to a small fake of Supabase's REST API (test/helpers/fakeSupabase.ts),
// so this suite needs no Docker. To run it against the real local stack instead (after
// `pnpm db:up`), set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY,
// which is what `pnpm test:local-db` does.
const real = process.env.TEST_SUPABASE_URL
  ? {
      url: process.env.TEST_SUPABASE_URL,
      serviceRoleKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? ''
    }
  : null
const fake = real ? null : await startFakeSupabase()
const supabase = real ?? { url: fake!.url, serviceRoleKey: SERVICE_ROLE_KEY }

afterAll(() => fake?.stop())

await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
  server: true,
  setupTimeout: 300_000,
  env: {
    NUXT_SUPABASE_URL: supabase.url,
    NUXT_SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    NUXT_REVIEW_SECRET: SECRET,
    NUXT_SUBMISSION_RATE_LIMIT_MAX: String(RATE_LIMIT_MAX)
  }
})

let ipCounter = 0
// Each test gets its own client address so the per-IP limits don't leak between tests.
function newClient() {
  ipCounter++
  return `203.0.113.${ipCounter}`
}

function request(path: string, init: { method?: string, body?: unknown, secret?: string, ip?: string, headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip ?? newClient(), ...init.headers }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (init.secret !== undefined) headers.authorization = `Bearer ${init.secret}`
  return fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
}

function submit(body: Record<string, unknown>, ip?: string) {
  return request('/api/submissions', { method: 'POST', body, ip })
}

async function listAll() {
  const response = await request('/api/review/submissions?status=all', { secret: SECRET })
  expect(response.status).toBe(200)
  return await response.json() as Array<Record<string, unknown>>
}

const valid = { text: 'Kaj to znači?', type: 'expression', place: 'Sveti Petar Orehovec', name: 'Ana', contact: 'ana@example.com', consentPublish: true, locale: 'hr' }

describe('POST /api/submissions', () => {
  it('stores a valid submission as pending, with the consent recorded', async () => {
    const response = await submit({ ...valid, text: 'stored submission' })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })

    const stored = (await listAll()).find(row => row.text === 'stored submission')
    expect(stored).toMatchObject({
      type: 'expression',
      place: 'Sveti Petar Orehovec',
      name: 'Ana',
      contact: 'ana@example.com',
      consentPublish: true,
      consentVersion: expect.any(String),
      locale: 'hr',
      status: 'pending',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
      reviewedAt: null
    })
  })

  it('ignores client-supplied status, review metadata, id and consent version', async () => {
    const response = await submit({ ...valid, text: 'server controlled fields', status: 'approved', reviewed_at: '2026-01-01', id: 999999, consent_version: 'forged' })
    expect(response.status).toBe(201)
    const stored = (await listAll()).find(row => row.text === 'server controlled fields')!
    expect(stored).toMatchObject({ status: 'pending', reviewedAt: null })
    expect(stored.id).not.toBe(999999)
    expect(stored.consentVersion).not.toBe('forged')
  })

  it('rejects a submission without consent to publish and stores nothing', async () => {
    for (const consentPublish of [undefined, false, 'true']) {
      const response = await submit({ ...valid, text: 'no consent', consentPublish })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.data.issues).toContainEqual({ field: 'consentPublish', code: 'required' })
    }
    expect((await listAll()).some(row => row.text === 'no consent')).toBe(false)
  })

  it('validates the fields on the server', async () => {
    const response = await submit({ text: 'x'.repeat(2001), type: 'poem', name: 'n'.repeat(101), consentPublish: true, locale: 'de' })
    expect(response.status).toBe(400)
    expect((await response.json()).data.issues).toEqual([
      { field: 'text', code: 'tooLong' },
      { field: 'type', code: 'invalid' },
      { field: 'name', code: 'tooLong' },
      { field: 'locale', code: 'invalid' }
    ])
  })

  it('rejects an oversized request body', async () => {
    const response = await submit({ ...valid, text: 'x'.repeat(20_000) })
    expect(response.status).toBe(413)
  })

  it('refuses a body without a Content-Length, such as a chunked one, and stores nothing', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...valid, text: 'chunked submission' })))
        controller.close()
      }
    })
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': newClient() },
      body,
      duplex: 'half'
    } as RequestInit)
    expect(response.status).toBe(411)
    expect((await listAll()).some(row => row.text === 'chunked submission')).toBe(false)
  })

  it('silently drops submissions that fill in the honeypot', async () => {
    const response = await submit({ ...valid, text: 'honeypot submission', website: 'https://spam.example' })
    expect(response.status).toBe(201)
    expect((await listAll()).some(row => row.text === 'honeypot submission')).toBe(false)
  })

  it('limits submissions per client address', async () => {
    const ip = newClient()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await submit({ ...valid, text: `rate limit ${i}` }, ip)).status).toBe(201)
    }
    expect((await submit({ ...valid, text: 'rate limit over' }, ip)).status).toBe(429)
    expect((await submit({ ...valid, text: 'rate limit other client' })).status).toBe(201)
  })

  it('counts by the proxy-added address, so a faked X-Forwarded-For prefix does not reset the limit', async () => {
    const ip = newClient()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect((await submit({ ...valid, text: `spoofed ${i}` }, `198.51.100.${i}, ${ip}`)).status).toBe(201)
    }
    expect((await submit({ ...valid, text: 'spoofed over' }, `198.51.100.99, ${ip}`)).status).toBe(429)
  })
})

describe('review API', () => {
  const routes = [
    { method: 'GET', path: '/api/review/submissions' },
    { method: 'PATCH', path: '/api/review/submissions/1', body: { status: 'approved' } },
    { method: 'DELETE', path: '/api/review/submissions/1' }
  ]

  it.each(routes)('$method $path requires the review secret', async ({ method, path, body }) => {
    expect((await request(path, { method, body })).status).toBe(401)
    expect((await request(path, { method, body, secret: 'wrong-secret-0123456789' })).status).toBe(401)
    expect((await request(path, { method, body, headers: { authorization: SECRET } })).status).toBe(401)
  })

  it('does not change anything without the secret', async () => {
    await submit({ ...valid, text: 'protected submission' })
    const { id } = (await listAll()).find(row => row.text === 'protected submission')!

    expect((await request(`/api/review/submissions/${id}`, { method: 'PATCH', body: { status: 'approved' } })).status).toBe(401)
    expect((await request(`/api/review/submissions/${id}`, { method: 'DELETE' })).status).toBe(401)
    expect((await listAll()).find(row => row.id === id)).toMatchObject({ status: 'pending' })
  })

  it('locks out a client after too many wrong secrets', async () => {
    const ip = newClient()
    for (let i = 0; i < 10; i++) {
      expect((await request('/api/review/submissions', { secret: 'guess', ip })).status).toBe(401)
    }
    expect((await request('/api/review/submissions', { secret: 'guess', ip })).status).toBe(429)
    expect((await request('/api/review/submissions', { secret: SECRET, ip })).status).toBe(429)
  })

  it('keeps the lockout when the client changes the left part of X-Forwarded-For', async () => {
    const ip = newClient()
    for (let i = 0; i < 10; i++) {
      expect((await request('/api/review/submissions', { secret: 'guess', ip: `198.51.100.${i}, ${ip}` })).status).toBe(401)
    }
    expect((await request('/api/review/submissions', { secret: SECRET, ip: `198.51.100.99, ${ip}` })).status).toBe(429)
  })

  it('lists every pending submission, with no cap', async () => {
    const texts = Array.from({ length: 1001 }, (_, i) => `uncapped ${i}`)
    for (const [i, text] of texts.entries()) {
      expect((await submit({ ...valid, text }, `10.0.${i >> 8}.${i & 255}`)).status).toBe(201)
    }
    const response = await request('/api/review/submissions', { secret: SECRET })
    const rows = await response.json() as Array<Record<string, unknown>>
    const listed = new Set(rows.map(row => row.text))
    expect(texts.every(text => listed.has(text))).toBe(true)
  })

  it('lists pending submissions by default', async () => {
    await submit({ ...valid, text: 'listed submission' })
    const response = await request('/api/review/submissions', { secret: SECRET })
    expect(response.status).toBe(200)
    const rows = await response.json() as Array<Record<string, unknown>>
    expect(rows.every(row => row.status === 'pending')).toBe(true)
    expect(rows.some(row => row.text === 'listed submission')).toBe(true)

    expect((await request('/api/review/submissions?status=nope', { secret: SECRET })).status).toBe(400)
  })

  it('approves, rejects and deletes a submission', async () => {
    await submit({ ...valid, text: 'reviewed submission' })
    const { id } = (await listAll()).find(row => row.text === 'reviewed submission')!
    const path = `/api/review/submissions/${id}`

    expect((await request(path, { method: 'PATCH', body: { status: 'approved' }, secret: SECRET })).status).toBe(200)
    const approved = await (await request('/api/review/submissions?status=approved', { secret: SECRET })).json() as Array<Record<string, unknown>>
    expect(approved.find(row => row.id === id)).toMatchObject({ status: 'approved', reviewedAt: expect.any(String) })

    expect((await request(path, { method: 'PATCH', body: { status: 'rejected' }, secret: SECRET })).status).toBe(200)
    expect((await listAll()).find(row => row.id === id)).toMatchObject({ status: 'rejected' })

    expect((await request(path, { method: 'PATCH', body: { status: 'published' }, secret: SECRET })).status).toBe(400)

    expect((await request(path, { method: 'DELETE', secret: SECRET })).status).toBe(200)
    expect((await listAll()).some(row => row.id === id)).toBe(false)
    expect((await request(path, { method: 'DELETE', secret: SECRET })).status).toBe(404)
    expect((await request(path, { method: 'PATCH', body: { status: 'approved' }, secret: SECRET })).status).toBe(404)
    expect((await request('/api/review/submissions/abc', { method: 'DELETE', secret: SECRET })).status).toBe(400)
  })
})

describe.skipIf(!fake)('Supabase keys', () => {
  it('submits and reviews with the same secret key', () => {
    const inserts = fake!.requests.filter(r => r.method === 'POST')
    const others = fake!.requests.filter(r => r.method !== 'POST')
    expect(inserts.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)
    expect(inserts.every(r => r.role === 'service_role')).toBe(true)
    expect(others.every(r => r.role === 'service_role')).toBe(true)
  })
})

describe('server-only credentials', () => {
  it('does not publish the database key or review password in HTML or built public files', async () => {
    const secrets = [supabase.serviceRoleKey, SECRET, process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_API_KEY].filter((value): value is string => Boolean(value))
    for (const path of ['/heritage', '/en/heritage', '/review']) {
      const html = await (await fetch(path)).text()
      for (const secret of secrets) expect(html).not.toContain(secret)
    }
    const publicDir = resolve(useTestContext().nuxt!.options.nitro.output.dir!, 'public')
    const files = await readdir(publicDir, { recursive: true, withFileTypes: true })
    expect(files.filter(file => file.isFile()).length).toBeGreaterThan(0)
    for (const file of files.filter(file => file.isFile())) {
      const output = await readFile(`${file.parentPath}/${file.name}`)
      for (const secret of secrets) expect(output.includes(Buffer.from(secret)), file.name).toBe(false)
    }
  })
})

// These restart the server with other settings, so they come last.
const blank = { NUXT_SUPABASE_URL: '', NUXT_SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_URL: '', SUPABASE_API_KEY: '' }
const reviewRoutes = [
  { method: 'GET', path: '/api/review/submissions' },
  { method: 'PATCH', path: '/api/review/submissions/1', body: { status: 'approved' } },
  { method: 'DELETE', path: '/api/review/submissions/1' }
]

describe('Supabase settings', () => {
  it('submits and reviews using only the names Hostinger injects', async () => {
    await startServer({ env: { ...blank, SUPABASE_URL: supabase.url, SUPABASE_API_KEY: supabase.serviceRoleKey } })
    expect((await submit({ ...valid, text: 'plain names' })).status).toBe(201)
    expect((await listAll()).some(row => row.text === 'plain names')).toBe(true)
  })

  it('prefers the NUXT overrides when both naming styles are set', async () => {
    await startServer({ env: {
      ...blank,
      NUXT_SUPABASE_URL: supabase.url,
      NUXT_SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
      SUPABASE_URL: 'http://127.0.0.1:1',
      SUPABASE_API_KEY: 'invalid-fallback'
    } })
    expect((await submit({ ...valid, text: 'override names' })).status).toBe(201)
    expect((await listAll()).some(row => row.text === 'override names')).toBe(true)
  })

  it.each([
    { name: 'secret key', settings: { NUXT_SUPABASE_URL: supabase.url }, missing: 'NUXT_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_API_KEY)' },
    { name: 'URL', settings: { SUPABASE_API_KEY: supabase.serviceRoleKey }, missing: 'NUXT_SUPABASE_URL (or SUPABASE_URL)' }
  ])('refuses submissions and all review routes without the $name and logs the missing variable', async ({ settings, missing }) => {
    await startServer({ env: { ...blank, ...settings } })
    expect((await submit({ ...valid, text: 'no database' })).status).toBe(503)
    for (const route of reviewRoutes) {
      expect((await request(route.path, { ...route, secret: SECRET })).status).toBe(503)
    }
    expect((await request('/api/review/submissions', { secret: 'wrong-secret-0123456789' })).status).toBe(401)
    expect(getServerLogs().join('\n')).toContain(`${missing} is not set`)
  })

  it.each(['', 'too-short'])('keeps review disabled with an invalid review password (%s)', async (reviewSecret) => {
    await startServer({ env: { ...blank, SUPABASE_URL: supabase.url, SUPABASE_API_KEY: supabase.serviceRoleKey, NUXT_REVIEW_SECRET: reviewSecret } })
    expect((await submit({ ...valid, text: 'password disabled' })).status).toBe(201)
    for (const route of reviewRoutes) {
      expect((await request(route.path, { ...route, secret: SECRET })).status).toBe(503)
    }
  })
})
