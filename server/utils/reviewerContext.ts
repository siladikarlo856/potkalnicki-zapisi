import type { H3Event } from 'h3'
import type { AccountRole } from '~~/shared/types/accounts'
import { BROWSER_EDITORIAL_AUTH_HEADER } from '#shared/utils/editorialAuth'
import {
  loadAccountRole,
  resolveSignedInUser,
  verifiedProviderEmail
} from './accountSync'
import { hasAdminSession } from './adminSession'
import { verifyReviewerPassword } from './reviewerPassword'

export type ReviewerAuthMode = 'password' | 'social' | 'automation'

export interface ReviewerContext {
  mode: ReviewerAuthMode
  role: AccountRole | 'admin'
  accountId: string | null
  email: string | null
}

export const EDITORIAL_ACCESS_COOKIE = 'pz-editorial-access-token'
const EDITORIAL_ACCESS_MAX_AGE = 60 * 60

export function looksLikeJwt(value: string) {
  return value.split('.').length === 3
}

function readAuthorizationBearer(event: H3Event) {
  const header = getRequestHeader(event, 'authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
}

export async function resolveSocialReviewerFromToken(accessToken: string): Promise<ReviewerContext | null> {
  if (!accessToken) return null
  let user
  try {
    user = await resolveSignedInUser(accessToken)
  } catch {
    return null
  }
  const email = verifiedProviderEmail(user)
  if (!email) return null
  const role = await loadAccountRole(user.id)
  return { mode: 'social', role, accountId: user.id, email }
}

async function resolveRequestReviewer(event: H3Event): Promise<ReviewerContext | null> {
  if (await hasAdminSession(event)) {
    return { mode: 'password', role: 'admin', accountId: null, email: null }
  }
  const bearer = readAuthorizationBearer(event)
  if (bearer) {
    if (looksLikeJwt(bearer)) {
      const social = await resolveSocialReviewerFromToken(bearer)
      if (social) return social
    }
    verifyReviewerPassword(event, bearer)
    return { mode: 'automation', role: 'admin', accountId: null, email: null }
  }
  if (getRequestHeader(event, BROWSER_EDITORIAL_AUTH_HEADER) === '1') return null
  const socialToken = getCookie(event, EDITORIAL_ACCESS_COOKIE) ?? ''
  if (!socialToken) return null
  return resolveSocialReviewerFromToken(socialToken)
}

export function resolveReviewerContext(event: H3Event): Promise<ReviewerContext | null> {
  event.context.reviewerResolution ??= resolveRequestReviewer(event)
  return event.context.reviewerResolution
}

export function setReviewerContext(event: H3Event, context: ReviewerContext) {
  event.context.reviewer = context
}

export function getReviewerContext(event: H3Event): ReviewerContext | undefined {
  return event.context.reviewer as ReviewerContext | undefined
}

export function setEditorialAccessCookie(event: H3Event, accessToken: string) {
  const secure = getRequestURL(event).protocol === 'https:'
  setCookie(event, EDITORIAL_ACCESS_COOKIE, accessToken, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: EDITORIAL_ACCESS_MAX_AGE
  })
}

export function clearEditorialAccessCookie(event: H3Event) {
  const secure = getRequestURL(event).protocol === 'https:'
  deleteCookie(event, EDITORIAL_ACCESS_COOKIE, { path: '/', httpOnly: true, secure, sameSite: 'lax' })
}
