// GET /api/atlas/settlements: every live settlement with its unit, record count and centroid (place search).
export default defineEventHandler(async (event) => {
  const index = settlementIndex(await getPublicContent())
  cachePublicContent(event)
  return index
})
