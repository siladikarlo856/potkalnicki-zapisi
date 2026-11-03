// GET /api/atlas/heritage?municipality=<slug>&category=<key>: the heritage list with its filter options.
export default defineEventHandler(async (event) => {
  const filter = { municipality: queryParam(event, 'municipality'), category: queryParam(event, 'category') }
  const list = heritageList(await getPublicContent(), filter)
  if (!list) throw createError({ statusCode: 400, statusMessage: 'Unknown municipality or category' })
  cachePublicContent(event)
  return list
})
