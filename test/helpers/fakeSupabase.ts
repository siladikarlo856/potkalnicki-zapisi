import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

// A small stand-in for Supabase's REST API (PostgREST) for submissions and words, so the
// API tests run in CI without Docker. The real supabase-js client talks to it, and it enforces the
// same role boundary as supabase/migrations: public keys have no access. It also models word
// activation's approval side effect. supabase.local.test.ts and the real-stack API run check
// actual RLS, constraints, seed data and transactional approval against Postgres.

export const SERVICE_ROLE_KEY = 'sb_secret_test-server-only-0123456789'

type Row = Record<string, unknown>

function reply(response: ServerResponse, status: number, body?: unknown) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(body === undefined ? undefined : JSON.stringify(body))
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
}

function matches(row: Row, params: URLSearchParams) {
  for (const [column, filter] of params) {
    const eq = filter.match(/^eq\.(.*)$/)
    if (eq && String(row[column]) !== eq[1]) return false
  }
  return true
}

export async function startFakeSupabase() {
  const rows: Row[] = []
  const words: Row[] = []
  let nextId = 1
  const requests: Array<{ method: string, role: string, path: string }> = []

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const key = String(request.headers.apikey ?? '')
    const role = key === SERVICE_ROLE_KEY ? 'service_role' : 'none'
    requests.push({ method: request.method ?? '', role, path: url.pathname })

    const isWords = url.pathname === '/rest/v1/heritage_words'
    if ((!isWords && url.pathname !== '/rest/v1/heritage_submissions') || role === 'none') {
      return reply(response, 401, { message: 'Invalid API key' })
    }

    const table = isWords ? words : rows
    function project(row: Row) {
      const select = url.searchParams.get('select') ?? '*'
      return select === '*' ? row : Object.fromEntries(select.split(',').map(key => [key, row[key]]))
    }
    function activate(row: Row) {
      const submission = rows.find(s => s.id === row.submission_id)
      if (row.active && submission) Object.assign(submission, { status: 'approved', reviewed_at: new Date().toISOString() })
    }
    if (request.method === 'POST') {
      const body = await readJson(request) as Row
      if (isWords && body.submission_id && words.some(w => w.submission_id === body.submission_id)) return reply(response, 409, { code: '23505', message: 'duplicate submission' })
      const now = new Date().toISOString()
      const row = isWords
        ? { submission_id: null, submission_place: null, ...body, created_at: now, updated_at: now }
        : { place_id: null, place_catalog_version: null, target_ref: null, ...body, id: nextId++, status: 'pending', created_at: now, reviewed_at: null }
      table.push(row)
      if (isWords) activate(row)
      return reply(response, 201, request.headers.prefer?.includes('return=representation') ? [project(row)] : undefined)
    }

    const visible = table.filter(row => matches(row, url.searchParams))

    if (request.method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), 1000)
      const range = String(request.headers.range ?? '').match(/^(\d+)-(\d+)$/)
      const [from, to] = range ? [Number(range[1]), Math.min(Number(range[2]), Number(range[1]) + 999)] : [offset, offset + limit - 1]
      const sorted = [...visible].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)) || Number(b.id) - Number(a.id))
      return reply(response, 200, sorted.slice(from, to + 1).map(project))
    }

    if (request.method === 'PATCH') {
      const body = await readJson(request) as Row
      for (const row of visible) {
        const wasActive = row.active
        Object.assign(row, body)
        if (isWords) {
          row.updated_at = new Date().toISOString()
          if (!wasActive) activate(row)
        }
      }
      return reply(response, 200, visible.map(project))
    }

    if (request.method === 'DELETE') {
      for (const row of visible) {
        table.splice(table.indexOf(row), 1)
        if (!isWords) for (const word of words) if (word.submission_id === row.id) word.submission_id = null
      }
      return reply(response, 200, visible.map(row => ({ id: row.id })))
    }

    reply(response, 405, { message: 'Method not allowed' })
  })

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    seed: (row: Row) => rows.push({ ...row, id: nextId++, status: 'pending', created_at: new Date().toISOString(), reviewed_at: null }),
    stop: () => new Promise<void>(resolve => server.close(() => resolve()))
  }
}
