import type { H3Event } from 'h3'
import { resolveReviewerContext, setReviewerContext } from './reviewerContext'

// Every review API route calls this first. Shared password, automation Bearer, and social sessions are supported.
export async function requireReviewer(event: H3Event) {
  const context = await resolveReviewerContext(event)
  if (!context) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (context.mode === 'social' && context.role === 'none') {
    throw createError({ statusCode: 403, statusMessage: 'Editorial access required' })
  }
  setReviewerContext(event, context)
}
