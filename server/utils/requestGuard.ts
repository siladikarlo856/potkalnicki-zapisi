import type { H3Event } from 'h3'

// Request checks shared by the routes that change data: the challenge actions and every admin
// and review route (through server/middleware/admin-guard.ts).

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isUnsafeMethod(event: H3Event) {
  return UNSAFE_METHODS.has(event.method.toUpperCase())
}

/**
 * Refuses a browser request sent from another site. Browsers send `Origin` on cross-site and on
 * same-origin unsafe requests; scripts using a Bearer secret may omit it, which is allowed.
 */
export function assertSameOrigin(event: H3Event) {
  const origin = getRequestHeader(event, 'origin')
  if (!origin) return
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
  }
  if (host !== getRequestHeader(event, 'host')) throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
}

/** True when the request carries a body (a non-zero Content-Length, or a chunked transfer). */
export function hasRequestBody(event: H3Event) {
  const length = getRequestHeader(event, 'content-length')
  if (length !== undefined) return length.trim() !== '0'
  return getRequestHeader(event, 'transfer-encoding') !== undefined
}

/** A body is only accepted as JSON, so a cross-site HTML form can never post one. */
export function assertJsonBody(event: H3Event) {
  if (hasRequestBody(event) && !getRequestHeader(event, 'content-type')?.startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'JSON required' })
  }
}

/** Reads a JSON object body of at most `limit` bytes; a Content-Length is required. */
export async function readJsonObject(event: H3Event, limit: number) {
  const length = getRequestHeader(event, 'content-length') ?? ''
  if (!/^\d+$/.test(length)) throw createError({ statusCode: 411, statusMessage: 'Content-Length required' })
  if (Number(length) > limit) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  if (!getRequestHeader(event, 'content-type')?.startsWith('application/json')) throw createError({ statusCode: 415, statusMessage: 'JSON required' })
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > limit) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
  }
  return body as Record<string, unknown>
}

const ADMIN_OPEN_PATHS = new Set(['/api/admin/session', '/api/admin/social-session'])

/**
 * Which admin gate applies to a path: 'session' for the session endpoints, 'protected' for every other
 * /api/admin and /api/review path, null elsewhere. The path is decoded and normalized first, so an
 * encoded or doubled spelling of a protected path cannot slip past the gate.
 */
export function adminRouteScope(pathname: string): 'session' | 'protected' | null {
  let path: string
  try {
    path = decodeURIComponent(pathname)
  } catch {
    path = pathname
  }
  path = path.replace(/\/{2,}/g, '/').replace(/\/+$/, '').toLowerCase()
  if (ADMIN_OPEN_PATHS.has(path)) return 'session'
  if (/^\/api\/(admin|review)(\/|$)/.test(path)) return 'protected'
  return null
}
