import { draftFromProposal } from '../../../../utils/inbox'

// Idempotent: a proposal becomes one draft row (or word draft); asking again returns the same one.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const result = await draftFromProposal(submissionIdParam(event))
  setResponseStatus(event, result.created ? 201 : 200)
  return result
})
