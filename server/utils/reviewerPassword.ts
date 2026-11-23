import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export const REVIEW_SECRET_MIN_LENGTH = 16

const FAILED_ATTEMPTS_MAX = 10
const FAILED_ATTEMPTS_WINDOW_SECONDS = 15 * 60

function digest(value: string) {
  return createHash('sha256').update(value).digest()
}

export function verifyReviewerPassword(event: H3Event, given: string) {
  const { reviewSecret } = useRuntimeConfig(event)
  if (!reviewSecret || reviewSecret.length < REVIEW_SECRET_MIN_LENGTH) {
    throw createError({ statusCode: 503, statusMessage: 'Review is not configured' })
  }

  const key = clientKey(event)
  if (isRateLimited('review-auth', key, FAILED_ATTEMPTS_MAX, FAILED_ATTEMPTS_WINDOW_SECONDS)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  if (!given || !timingSafeEqual(digest(given), digest(reviewSecret))) {
    countRateLimit('review-auth', key, FAILED_ATTEMPTS_WINDOW_SECONDS)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
