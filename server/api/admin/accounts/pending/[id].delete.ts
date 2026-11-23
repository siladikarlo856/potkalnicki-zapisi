import { cancelPendingEmail } from '~~/server/utils/accountAdmin'
import { requireSocialAdmin } from '~~/server/utils/accountAdminAuth'

export default defineEventHandler(async (event) => {
  const actor = await requireSocialAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
  await cancelPendingEmail(actor.accountId!, id)
  return { ok: true }
})
