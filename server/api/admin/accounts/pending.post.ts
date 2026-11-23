import { readJsonObject } from '~~/server/utils/requestGuard'
import { preauthorizeMaintainer } from '~~/server/utils/accountAdmin'
import { requireSocialAdmin } from '~~/server/utils/accountAdminAuth'

export default defineEventHandler(async (event) => {
  const actor = await requireSocialAdmin(event)
  const body = await readJsonObject(event, 4096)
  const email = typeof body.email === 'string' ? body.email : ''
  const id = await preauthorizeMaintainer(actor.accountId!, email)
  return { id }
})
