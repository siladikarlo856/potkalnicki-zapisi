import type { H3Event } from 'h3'
import type { AtlasRedirectResponse } from '../../shared/types/publicAtlas'
import type { Resolved } from './publicAtlas'

/** Public content may be cached briefly; overrides the `/api/**` no-store rule like the word list does. */
export const PUBLIC_CONTENT_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300'

export function cachePublicContent(event: H3Event) {
  setResponseHeader(event, 'cache-control', PUBLIC_CONTENT_CACHE_CONTROL)
}

/**
 * Turns a resolved route into the API answer: the value, `{ redirect }` for an old URL (the page answers
 * 301), 410 for archived content and 404 otherwise. Only successful answers are cacheable.
 */
export function resolvedResponse<T>(event: H3Event, result: Resolved<T>, notFound: string): T | AtlasRedirectResponse {
  if (result.status === 'gone') throw createError({ statusCode: 410, statusMessage: 'Content has been removed' })
  if (result.status === 'not_found') throw createError({ statusCode: 404, statusMessage: notFound })
  cachePublicContent(event)
  return result.status === 'redirect' ? { redirect: result.path } : result.value
}

/** A single string query parameter, or undefined; repeated or empty parameters are refused. */
export function queryParam(event: H3Event, name: string) {
  const value = getQuery(event)[name]
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` })
  return value
}
