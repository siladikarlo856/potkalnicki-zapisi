import { inboxDetail } from '../../../utils/inbox'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return inboxDetail(submissionIdParam(event))
})
