import type { H3Event } from 'h3'
import { assertUserManagementAccess } from './editorialCapabilities'
import { requireReviewer } from './reviewAuth'
import { getReviewerContext, resolveReviewerContext, setReviewerContext } from './reviewerContext'

/** User management requires a Google session whose account_profiles role is admin. Password and automation get 403. */
export async function requireSocialAdmin(event: H3Event) {
  await requireReviewer(event)
  const context = getReviewerContext(event) ?? await resolveReviewerContext(event)
  if (!context) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  assertUserManagementAccess(context)
  setReviewerContext(event, context)
  return context
}
