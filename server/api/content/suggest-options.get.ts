// GET /api/content/suggest-options: the published categories and places the suggestion dialogs pick from.
export default defineEventHandler(async (event) => {
  cachePublicContent(event)
  return suggestOptions(await getPublicContent())
})
