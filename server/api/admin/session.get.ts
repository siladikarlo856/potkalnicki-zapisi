import type { AccountRole } from '~~/shared/types/accounts'
import { hasAdminSession } from '~~/server/utils/adminSession'
import { resolveReviewerContext } from '~~/server/utils/reviewerContext'

export type AdminSessionStatus = {
  authenticated: boolean
  role?: AccountRole | 'admin'
  accountSignedIn?: boolean
  /** True only for a Google session with role admin (not password or automation). */
  userManagement?: boolean
}

export default defineEventHandler(async (event): Promise<AdminSessionStatus> => {
  if (await hasAdminSession(event)) {
    return { authenticated: true, role: 'admin' }
  }
  const context = await resolveReviewerContext(event)
  if (!context || context.mode !== 'social') {
    return { authenticated: false }
  }
  if (context.role === 'none') {
    return { authenticated: false, accountSignedIn: true, role: 'none' }
  }
  const userManagement = context.mode === 'social' && context.role === 'admin'
  return { authenticated: true, role: context.role, userManagement }
})
