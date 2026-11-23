import { listAccountsAdmin } from '~~/server/utils/accountAdmin'
import { requireSocialAdmin } from '~~/server/utils/accountAdminAuth'

export default defineEventHandler(async (event) => {
  await requireSocialAdmin(event)
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''
  const page = Number(typeof query.page === 'string' ? query.page : '1')
  const pendingPage = Number(typeof query.pendingPage === 'string' ? query.pendingPage : '1')
  return listAccountsAdmin(q, page, pendingPage)
})
