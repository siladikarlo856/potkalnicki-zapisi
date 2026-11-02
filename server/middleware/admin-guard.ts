// One gate in front of every admin and review API route, so a new handler cannot ship unguarded:
// - every /api/admin/** and /api/review/** request needs the admin session or the Bearer secret,
//   except the session route itself (login, status and logout);
// - unsafe methods there must come from this site when the browser says where they come from,
//   and any body must be JSON.
// Handlers still call `requireReviewer` themselves as defense in depth.

export default defineEventHandler(async (event) => {
  const scope = adminRouteScope(getRequestURL(event).pathname)
  if (!scope) return
  if (isUnsafeMethod(event)) {
    assertSameOrigin(event)
    assertJsonBody(event)
  }
  if (scope === 'protected') await requireReviewer(event)
})
