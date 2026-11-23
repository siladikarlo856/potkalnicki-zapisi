import { loadAccountRole, resolveSignedInUser, verifiedProviderEmail } from '~~/server/utils/accountSync'
import {
  clearEditorialAccessCookie,
  setEditorialAccessCookie
} from '~~/server/utils/reviewerContext'

export default defineEventHandler(async (event) => {
  const header = getRequestHeader(event, 'authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  clearEditorialAccessCookie(event)
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Missing access token' })

  let user
  try {
    user = await resolveSignedInUser(token)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }
  if (!verifiedProviderEmail(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Verified email is required' })
  }

  const role = await loadAccountRole(user.id)
  setEditorialAccessCookie(event, token)
  return { ok: true, role }
})
