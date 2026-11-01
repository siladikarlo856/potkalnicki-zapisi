export default defineEventHandler(async (event) => {
  await requireReviewer(event)

  const { status = 'pending', type } = getQuery(event)
  if (status !== 'all' && !SUBMISSION_STATUSES.includes(status as SubmissionStatus)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }
  if (type !== undefined && type !== '' && !SUBMISSION_TYPES.includes(type as SubmissionType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid type' })
  }

  return listSubmissions(
    status as SubmissionStatus | 'all',
    type ? type as SubmissionType : undefined
  )
})
