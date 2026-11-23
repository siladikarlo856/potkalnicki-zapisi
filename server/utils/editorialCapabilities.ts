import type { H3Event } from 'h3'
import type { ReviewerContext } from './reviewerContext'
import { getReviewerContext } from './reviewerContext'

export type EditorialRouteKind = 'session' | 'editorial' | 'user-management'

/** Same spelling normalisation as `adminRouteScope`, for capability lookup. */
export function normalizeProtectedApiPath(pathname: string) {
  let path: string
  try {
    path = decodeURIComponent(pathname)
  } catch {
    path = pathname
  }
  return path.replace(/\/{2,}/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * Maintainer record work and automation/password sessions use `editorial`. Korisnici account admin APIs
 * are `user-management` (Google admin only). Open session endpoints are `session`.
 */
export function editorialRouteKind(pathname: string): EditorialRouteKind | null {
  const path = normalizeProtectedApiPath(pathname)
  if (path === '/api/admin/session' || path === '/api/admin/social-session') return 'session'
  if (/^\/api\/admin\/accounts(\/|$)/.test(path)) return 'user-management'
  if (/^\/api\/(admin|review)(\/|$)/.test(path)) return 'editorial'
  return null
}

export function assertUserManagementAccess(context: ReviewerContext) {
  if (context.mode !== 'social' || context.role !== 'admin' || !context.accountId) {
    throw createError({ statusCode: 403, statusMessage: 'Upravljanje korisnicima zahtijeva Google administratorsku sesiju' })
  }
}

/** Rejects maintainers, password sessions and automation on `/api/admin/accounts/**` after `requireReviewer` succeeds. */
export function assertEditorialRouteCapability(event: H3Event) {
  const kind = editorialRouteKind(getRequestURL(event).pathname)
  if (kind !== 'user-management') return
  const context = getReviewerContext(event)
  if (!context) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  assertUserManagementAccess(context)
}
