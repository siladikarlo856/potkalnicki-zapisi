import { SUBMISSION_STATUSES } from '../../../../shared/utils/submission'
import type { SubmissionStatus } from '../../../../shared/utils/submission'
import { fail } from '../../../utils/content/store'
import { setInboxStatus } from '../../../utils/inbox'

// Approve ("odobri bez izmjene"), reject or return a submission to pending. Applying a correction goes through
// PATCH /api/admin/content/:kind/:id with `applySubmissionId`, so the change and the approval are one write.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const id = submissionIdParam(event)
  const body = await readJsonObject(event, 1024)
  if (!(SUBMISSION_STATUSES as readonly unknown[]).includes(body.status)) fail(400, 'Invalid status', { message: 'Status nije ispravan.' })
  await setInboxStatus(id, body.status as SubmissionStatus)
  return { ok: true }
})
