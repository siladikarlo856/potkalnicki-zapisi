export default defineEventHandler((event) => {
  const key = clientKey(event)
  if (isRateLimited('places', key, 120, 60)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many place searches' })
  }
  countRateLimit('places', key, 60)

  const { q = '' } = getQuery(event)
  if (typeof q !== 'string' || q.length > PLACE_QUERY_MAX) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid place search' })
  }
  return { version: PLACE_CATALOG_VERSION, places: searchPlaces(q) }
})
