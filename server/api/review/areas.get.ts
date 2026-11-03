export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return listAdminAreas()
})
