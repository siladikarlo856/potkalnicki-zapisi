import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

// A small stand-in for Supabase's REST API (PostgREST) for the heritage_submissions table, so the
// API tests run in CI without Docker. The real supabase-js client talks to it, and it enforces the
// same access rules as supabase/migrations: the anon key can only insert, the service-role key can
// do everything. supabase.local.test.ts checks those rules against the real local stack.

export const ANON_KEY = 'test-anon-key'
export const SERVICE_ROLE_KEY = 'test-service-role-key'

type Row = Record<string, unknown>

const INSERT_COLUMNS = ['text', 'type', 'place', 'name', 'contact', 'consent_publish', 'consent_version', 'locale']

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
    if (eq && ['id', 'status'].includes(column) && String(row[column]) !== eq[1]) return false
  }
  return true
}

export async function startFakeSupabase() {
  const rows: Row[] = []
  let nextId = 1
  const requests: Array<{ method: string, role: string, path: string }> = []

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const key = String(request.headers.apikey ?? '')
    const role = key === SERVICE_ROLE_KEY ? 'service_role' : key === ANON_KEY ? 'anon' : 'none'
    requests.push({ method: request.method ?? '', role, path: url.pathname })

    if (url.pathname !== '/rest/v1/heritage_submissions' || role === 'none') {
      return reply(response, 401, { message: 'Invalid API key' })
    }

    if (request.method === 'POST') {
      const body = await readJson(request) as Row
      const invalid = !body || Object.keys(body).some(column => !INSERT_COLUMNS.includes(column)) || body.consent_publish !== true
      if (role === 'anon' && invalid) return reply(response, 401, { message: 'new row violates row-level security policy' })
      rows.push({ ...body, id: nextId++, status: 'pending', created_at: new Date().toISOString(), reviewed_at: null })
      return reply(response, 201)
    }

    // Everything below needs the service role, like the table's RLS: anon sees no rows.
    const visible = role === 'service_role' ? rows.filter(row => matches(row, url.searchParams)) : []

    if (request.method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), 1000)
      const range = String(request.headers.range ?? '').match(/^(\d+)-(\d+)$/)
      const [from, to] = range ? [Number(range[1]), Math.min(Number(range[2]), Number(range[1]) + 999)] : [offset, offset + limit - 1]
      const sorted = [...visible].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)) || Number(b.id) - Number(a.id))
      return reply(response, 200, sorted.slice(from, to + 1))
    }

    if (request.method === 'PATCH') {
      const body = await readJson(request) as Row
      for (const row of visible) Object.assign(row, body)
      return reply(response, 200, visible.map(row => ({ id: row.id })))
    }

    if (request.method === 'DELETE') {
      for (const row of visible) rows.splice(rows.indexOf(row), 1)
      return reply(response, 200, visible.map(row => ({ id: row.id })))
    }

    reply(response, 405, { message: 'Method not allowed' })
  })

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    stop: () => new Promise<void>(resolve => server.close(() => resolve()))
  }
}
