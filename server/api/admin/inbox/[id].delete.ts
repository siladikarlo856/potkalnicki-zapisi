import { deleteInbox } from '../../../utils/inbox'

// Deleting withdraws what the submission added: credits are stripped (and redacted from stored revisions), and
// rows created from a proposal are unpublished. An applied correction's editorial change is kept.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  await deleteInbox(submissionIdParam(event))
  return { ok: true }
})
