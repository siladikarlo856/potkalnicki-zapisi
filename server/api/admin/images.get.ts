// Where the admin screen loads photo previews from: the public Storage URL of the Supabase project.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return { base: useStorageBase() }
})
