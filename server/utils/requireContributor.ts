import type { H3Event } from 'h3'
import { resolveSignedInUser, verifiedProviderEmail, syncSignedInAccount } from './accountSync'

/** A signed-in Google contributor; role is not required for Doprinesi photo uploads. */
export async function requireSignedInContributor(event: H3Event) {
  const header = getRequestHeader(event, 'authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign-in required' })
  }
  await syncSignedInAccount(event)
  const accessToken = header.slice('Bearer '.length).trim()
  const user = await resolveSignedInUser(accessToken)
  const email = verifiedProviderEmail(user)
  if (!email) {
    throw createError({ statusCode: 403, statusMessage: 'Verified email is required' })
  }
  return { accountId: user.id, email }
}
