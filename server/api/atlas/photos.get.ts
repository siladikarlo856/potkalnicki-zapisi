// GET /api/atlas/photos: every photo on the atlas with its author, licence and source.
export default defineEventHandler(async (event) => {
  const credits = photoCredits(await getPublicContent())
  cachePublicContent(event)
  return credits
})
