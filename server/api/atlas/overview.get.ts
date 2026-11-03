// GET /api/atlas/overview: the region with its towns and municipalities and their counts.
export default defineEventHandler(async (event) => {
  const overview = atlasOverview(await getPublicContent())
  if (!overview) throw createError({ statusCode: 404, statusMessage: 'Atlas region not found' })
  cachePublicContent(event)
  return overview
})
