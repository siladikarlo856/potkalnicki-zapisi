export default defineEventHandler(async (event) => {
  requireReviewer(event)
  const offset = Number(getQuery(event).offset ?? 0)
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid offset' })
  }
  return listAdminWords(offset)
})
