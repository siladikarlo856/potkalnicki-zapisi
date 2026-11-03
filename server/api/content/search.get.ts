// GET /api/content/search?q=<text>: published heritage items and settlements to correct (the /doprinesi "Ispravak" card).
export default defineEventHandler(async (event) => {
  const q = queryParam(event, 'q') ?? ''
  if (q.length > 100) throw createError({ statusCode: 400, statusMessage: 'Invalid q' })
  cachePublicContent(event)
  return searchContent(await getPublicContent(), q)
})
