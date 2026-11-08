// GET /api/atlas/intangible?kind=&type=&theme=&place=: the Priče i običaji list with its filters and facets.
export default defineEventHandler(async (event) => {
  const list = intangibleList(await getPublicContent(), {
    kind: queryParam(event, 'kind'),
    type: queryParam(event, 'type'),
    theme: queryParam(event, 'theme'),
    place: queryParam(event, 'place')
  })
  if (!list) throw createError({ statusCode: 400, statusMessage: 'Unknown filter' })
  cachePublicContent(event)
  return list
})
