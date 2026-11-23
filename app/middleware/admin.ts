export default defineNuxtRouteMiddleware(async (to) => {
  const path = to.path.replace(/\/+$/, '')
  const signingIn = path === '/admin/prijava'
  const requestFetch = useEditorialFetch()
  if (import.meta.client) {
    const auth = useAuthSession()
    await auth.initialize()
  }
  if (path === '/admin/nema-pristupa') return
  try {
    const session = await requestFetch<{ authenticated: boolean, accountSignedIn?: boolean, role?: string }>('/api/admin/session')
    if (session.authenticated) {
      if (signingIn) {
        const requested = typeof to.query.next === 'string' ? to.query.next : '/admin'
        const next = requested.startsWith('/admin') && !requested.startsWith('/admin/prijava') ? requested : '/admin'
        return navigateTo(next)
      }
      return
    }
    if (session.accountSignedIn && session.role === 'none') {
      return navigateTo('/admin/nema-pristupa')
    }
  } catch {
    // Missing, expired, or unconfigured sessions all return to the login page.
  }
  if (signingIn) return
  return navigateTo({ path: '/admin/prijava', query: { next: to.fullPath } })
})
