import { listAccountAudit } from '~~/server/utils/accountAdmin'
import { requireSocialAdmin } from '~~/server/utils/accountAdminAuth'

export default defineEventHandler(async (event) => {
  await requireSocialAdmin(event)
  return { rows: await listAccountAudit() }
})
