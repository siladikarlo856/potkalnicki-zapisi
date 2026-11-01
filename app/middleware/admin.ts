export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/prijava') return
  try {
    const requestFetch = import.meta.server ? useRequestFetch() : $fetch
    const session = await requestFetch<{ authenticated: boolean }>('/api/admin/session')
    if (session.authenticated) return
  } catch {
    // Missing, expired, or unconfigured sessions all return to the login page.
  }
  return navigateTo({ path: '/admin/prijava', query: { next: to.fullPath } })
})
