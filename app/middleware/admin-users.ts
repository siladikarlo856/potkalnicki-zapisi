import type { AdminSessionStatus } from '~~/server/api/admin/session.get'

export default defineNuxtRouteMiddleware(async () => {
  const requestFetch = useEditorialFetch()
  try {
    const session = await requestFetch<AdminSessionStatus>('/api/admin/session')
    if (session.userManagement) return
  } catch { /* fall through */ }
  return navigateTo('/admin')
})
