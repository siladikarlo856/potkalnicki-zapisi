export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const id = submissionIdParam(event)

  if (!await deleteSubmission(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  }
  return { ok: true }
})
