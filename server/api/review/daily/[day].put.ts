export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return pinDailyWord(useDatabaseClient(), event, dayParam(event))
})
