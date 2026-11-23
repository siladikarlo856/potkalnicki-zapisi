import type { AdminSessionStatus } from '~~/server/api/admin/session.get'

/** Whether this browser session may use the Korisnici screen (Google admin only). */
export function useAdminUserManagement() {
  const requestFetch = useEditorialFetch()
  return useAsyncData('admin-user-management', async () => {
    try {
      const session = await requestFetch<AdminSessionStatus>('/api/admin/session')
      return Boolean(session.userManagement)
    } catch {
      return false
    }
  }, { server: false, default: () => false })
}
