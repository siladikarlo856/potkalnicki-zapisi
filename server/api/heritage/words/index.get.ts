export default defineEventHandler(async (event) => {
  const limit = Number(getQuery(event).limit ?? 100)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid limit (1–100)' })
  }
  const result = await publicWords(limit)
  // Browser/shared caches may retain a deactivated word for at most 30 seconds.
  setResponseHeader(event, 'cache-control', 'public, max-age=30, s-maxage=30, must-revalidate')
  return result
})
