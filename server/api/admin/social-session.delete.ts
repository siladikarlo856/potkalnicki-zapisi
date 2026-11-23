import { hasAdminSession } from '~~/server/utils/adminSession'
import {
  clearEditorialAccessCookie,
  EDITORIAL_ACCESS_COOKIE
} from '~~/server/utils/reviewerContext'

export default defineEventHandler(async (event) => {
  const header = getRequestHeader(event, 'authorization') ?? ''
  const hasBearer = header.startsWith('Bearer ')
    && header.slice('Bearer '.length).trim().length > 0
  const hasCookie = Boolean(getCookie(event, EDITORIAL_ACCESS_COOKIE))
  const hasPassword = await hasAdminSession(event)
  if (!hasBearer && !hasCookie && !hasPassword) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  clearEditorialAccessCookie(event)
  return { ok: true }
})
