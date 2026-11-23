// One gate in front of every admin and review API route, so a new handler cannot ship unguarded:
// - requireReviewer owns authorization; only the session endpoints bypass it so credentials can
//   be established, inspected or cleared without existing editorial access;
// - editorialCapabilities enforces the maintainer matrix (Korisnici is Google-admin-only);
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
  if (scope === 'protected') {
    await requireReviewer(event)
    assertEditorialRouteCapability(event)
  }
})
