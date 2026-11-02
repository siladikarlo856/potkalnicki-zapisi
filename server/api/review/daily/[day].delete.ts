export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return unpinDailyWord(useDatabaseClient(), dayParam(event))
})
