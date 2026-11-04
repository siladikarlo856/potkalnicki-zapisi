// GET /api/atlas/persons?opcina=<town or municipality slug>: the persons list with its unit filter options.
export default defineEventHandler(async (event) => {
  const list = personList(await getPublicContent(), { municipality: queryParam(event, 'opcina') })
  if (!list) throw createError({ statusCode: 400, statusMessage: 'Unknown municipality' })
  cachePublicContent(event)
  return list
})
