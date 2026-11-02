export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return dailyOverview(useDatabaseClient())
})
