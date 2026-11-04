import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fakeContentRows } from './fakeContentSeed'

// A small stand-in for Supabase's REST API (PostgREST) for submissions, words, the daily word
// schedule and the atlas content tables, so the API tests run in CI without Docker. The real
// supabase-js client talks to it, and it enforces the same role boundary as supabase/migrations:
// public keys have no access. It also models word activation's approval side effect.
// supabase.local.test.ts and the real-stack API run check actual RLS, constraints, seed data and
// transactional approval against Postgres.

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

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function matches(row: Row, params: URLSearchParams) {
  for (const [column, filter] of params) {
    if (RESERVED_PARAMS.has(column)) continue
    const eq = filter.match(/^eq\.(.*)$/)
    if (eq && String(row[column]) !== eq[1]) return false
    const neq = filter.match(/^neq\.(.*)$/)
    if (neq && String(row[column]) === neq[1]) return false
    if (filter === 'is.null' && row[column] != null) return false
    if (filter === 'not.is.null' && row[column] == null) return false
    const list = filter.match(/^in\.\((.*)\)$/)
    if (list && !list[1]!.split(',').includes(String(row[column]))) return false
    const range = filter.match(/^(lt|lte|gt|gte)\.(.*)$/)
    if (range) {
      const [a, b] = [String(row[column]), range[2]!]
      if (range[1] === 'lt' && !(a < b)) return false
      if (range[1] === 'lte' && !(a <= b)) return false
      if (range[1] === 'gt' && !(a > b)) return false
      if (range[1] === 'gte' && !(a >= b)) return false
    }
  }
  return true
}

function ordered(rows: Row[], order: string | null) {
  if (!order) return null
  const keys = order.split(',').map(part => part.split('.') as [string, string?])
  return [...rows].sort((a, b) => {
    for (const [column, direction] of keys) {
      const [x, y] = [String(a[column]), String(b[column])]
      if (x !== y) return (x < y ? -1 : 1) * (direction === 'desc' ? -1 : 1)
    }
    return 0
  })
}

export async function startFakeSupabase() {
  const rows: Row[] = []
  const words: Row[] = []
  const daily: Row[] = []
  const seed = fakeContentRows()
  const areas: Row[] = seed.areas.map(row => ({ ...row }))
  const contentTables: Record<string, Row[]> = {
    '/rest/v1/area_regions': seed.areaRegions.map(row => ({ ...row })),
    '/rest/v1/heritage_categories': seed.categories.map(row => ({ ...row })),
    '/rest/v1/sources': seed.sources.map(row => ({ ...row })),
    '/rest/v1/heritage_items': seed.items.map(row => ({ ...row })),
    '/rest/v1/heritage_item_sources': seed.itemSources.map(row => ({ ...row })),
    '/rest/v1/content_legacy_ids': seed.legacyIds.map(row => ({ ...row })),
    '/rest/v1/content_slug_history': seed.slugHistory.map(row => ({ ...row })),
    '/rest/v1/persons': [],
    '/rest/v1/person_areas': [],
    '/rest/v1/person_heritage_items': [],
    '/rest/v1/person_sources': [],
    '/rest/v1/clubs': (seed.clubs ?? []).map(row => ({ ...row })),
    '/rest/v1/club_seasons': (seed.clubSeasons ?? []).map(row => ({ ...row })),
    '/rest/v1/club_sources': (seed.clubSources ?? []).map(row => ({ ...row }))
  }
  let nextId = 1
  // One-shot hook run just before the next daily upsert, to simulate losing a race.
  let beforeDailyUpsert: (() => void) | null = null
  const requests: Array<{ method: string, role: string, path: string }> = []

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const key = String(request.headers.apikey ?? '')
    const role = key === SERVICE_ROLE_KEY ? 'service_role' : 'none'
    requests.push({ method: request.method ?? '', role, path: url.pathname })

    const isWords = url.pathname === '/rest/v1/heritage_words'
    const isDaily = url.pathname === '/rest/v1/heritage_daily_words'
    const isSubmissions = url.pathname === '/rest/v1/heritage_submissions'
    const contentTable = contentTables[url.pathname]
    const isAreas = url.pathname === '/rest/v1/areas'
    const table = isDaily ? daily : isWords ? words : isSubmissions ? rows : isAreas ? areas : contentTable
    if (!table || role === 'none') {
      return reply(response, 401, { message: 'Invalid API key' })
    }
    const contentReadOnly = Boolean(contentTable) || isAreas
    function project(row: Row) {
      const select = url.searchParams.get('select') ?? '*'
      return select === '*' ? row : Object.fromEntries(select.split(',').map(key => [key, row[key]]))
    }
    function activate(row: Row) {
      const submission = rows.find(s => s.id === row.submission_id)
      if (row.active && submission) Object.assign(submission, { status: 'approved', reviewed_at: new Date().toISOString() })
    }
    if (request.method === 'POST' && isDaily) {
      const body = await readJson(request) as Row
      const prefer = String(request.headers.prefer ?? '')
      if (beforeDailyUpsert) {
        const hook = beforeDailyUpsert
        beforeDailyUpsert = null
        hook()
      }
      if (daily.some(row => row.day === body.day)) {
        // PostgREST answers an ignored duplicate with a normal 201 and no body.
        if (prefer.includes('resolution=ignore-duplicates')) return reply(response, 201)
        return reply(response, 409, { code: '23505', message: 'duplicate key value violates unique constraint' })
      }
      if (!words.some(word => word.id === body.word_id)) return reply(response, 409, { code: '23503', message: 'unknown word' })
      const now = new Date().toISOString()
      const row = { village: 'auto', snapshot: null, resolved_at: null, replaced_word_ids: [], ...body, created_at: now, updated_at: now }
      daily.push(row)
      return reply(response, 201, prefer.includes('return=representation') ? [project(row)] : undefined)
    }
    if (contentReadOnly && request.method !== 'GET') {
      return reply(response, 405, { message: 'Method not allowed' })
    }

    if (request.method === 'POST') {
      const body = await readJson(request) as Row
      if (isWords && body.submission_id && words.some(w => w.submission_id === body.submission_id)) return reply(response, 409, { code: '23505', message: 'duplicate submission' })
      const now = new Date().toISOString()
      const row = isWords
        ? { submission_id: null, submission_place: null, ...body, created_at: now, updated_at: now }
        : { place_id: null, place_catalog_version: null, word_id: null, intent: null, ...body, id: nextId++, status: 'pending', created_at: now, reviewed_at: null }
      if (isWords) {
        activate(row)
      }
      table.push(row)
      return reply(response, 201, request.headers.prefer?.includes('return=representation') ? [project(row)] : undefined)
    }

    const visible = table.filter(row => matches(row, url.searchParams))

    if (request.method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), 1000)
      const range = String(request.headers.range ?? '').match(/^(\d+)-(\d+)$/)
      const [from, to] = range ? [Number(range[1]), Math.min(Number(range[2]), Number(range[1]) + 999)] : [offset, offset + limit - 1]
      const sorted = ordered(visible, url.searchParams.get('order')) ?? [...visible].sort((a, b) => {
        const byCreated = String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        if (byCreated) return byCreated
        return String(a.id ?? '').localeCompare(String(b.id ?? ''))
      })
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
        if (isDaily) row.updated_at = new Date().toISOString()
      }
      return reply(response, 200, visible.map(project))
    }

    if (request.method === 'DELETE') {
      for (const row of visible) {
        table.splice(table.indexOf(row), 1)
        if (isSubmissions) for (const word of words) if (word.submission_id === row.id) word.submission_id = null
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
    words,
    daily,
    /** The areas table; a word's areas are read from here (server/utils/wordAreas.ts), not stored with the word. */
    areas,
    /** Adds a word's areas ({ id, name, kind, parentId } as the public Area shape) to the areas table. */
    seedAreas: (list: Array<{ id: string, name: string, kind: string, parentId: string | null }>) => {
      for (const area of list) areas.push({ id: area.id, name: area.name, kind: area.kind, parent_id: area.parentId, official_code: null, geonames_id: null, status: 'published' })
    },
    interceptNextDailyUpsert: (hook: () => void) => {
      beforeDailyUpsert = hook
    },
    seed: (row: Row) => rows.push({ ...row, id: nextId++, status: 'pending', created_at: new Date().toISOString(), reviewed_at: null }),
    seedSlugHistory: (row: Row) => {
      contentTables['/rest/v1/content_slug_history']!.push({ ...row })
    },
    stop: () => new Promise<void>(resolve => server.close(() => resolve()))
  }
}
