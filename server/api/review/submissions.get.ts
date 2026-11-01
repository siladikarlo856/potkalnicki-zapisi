export default defineEventHandler(async (event) => {
  await requireReviewer(event)

  const { status = 'pending' } = getQuery(event)
  if (status !== 'all' && !SUBMISSION_STATUSES.includes(status as SubmissionStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  return listSubmissions(status as SubmissionStatus | 'all')
})
