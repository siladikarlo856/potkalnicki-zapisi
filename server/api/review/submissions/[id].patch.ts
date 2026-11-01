export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const id = submissionIdParam(event)

  const body = await readBody<{ status?: unknown }>(event).catch(() => null)
  const status = body?.status
  if (!SUBMISSION_STATUSES.includes(status as SubmissionStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  if (!await setSubmissionStatus(id, status as SubmissionStatus)) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' })
  }
  return { ok: true }
})
