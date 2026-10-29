export default defineEventHandler(async (event) => {
  requireReviewer(event)
  const result = await promoteSubmission(submissionIdParam(event))
  setResponseStatus(event, 201)
  return result
})
