import type { InboxFilters } from '../../../../shared/types/inbox'
import { CONTENT_PAGE_SIZES } from '../../../../shared/utils/content/common'
import { isContributionKind } from '../../../../shared/utils/contribution'
import type { SubmissionStatus, SubmissionType } from '../../../../shared/utils/submission'
import { SUBMISSION_STATUSES, SUBMISSION_TYPES } from '../../../../shared/utils/submission'
import { fail, queryInteger, queryText } from '../../../utils/content/store'
import { listInbox } from '../../../utils/inbox'

// The unified inbox: every submission with its target and what was made from it. `GET /api/review/submissions`
// stays for scripts that use the Bearer secret.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const query = getQuery(event)
  const status = queryText(query.status, 'status') || 'pending'
  if (status !== 'all' && !(SUBMISSION_STATUSES as readonly string[]).includes(status)) fail(400, 'Invalid status', { message: 'Parametar status nije ispravan.' })
  const type = queryText(query.type, 'type')
  if (type && !(SUBMISSION_TYPES as readonly string[]).includes(type)) fail(400, 'Invalid type', { message: 'Parametar type nije ispravan.' })
  const targetKind = queryText(query.targetKind, 'targetKind')
  if (targetKind && !isContributionKind(targetKind)) fail(400, 'Invalid targetKind', { message: 'Parametar targetKind nije ispravan.' })
  const q = queryText(query.q, 'q').trim()
  if (q.length > 100) fail(400, 'Invalid q', { message: 'Pretraga može imati najviše 100 znakova.' })
  const size = queryInteger(query.size, 'size', CONTENT_PAGE_SIZES[0], Math.max(...CONTENT_PAGE_SIZES))
  if (!(CONTENT_PAGE_SIZES as readonly number[]).includes(size)) fail(400, 'Invalid size', { message: 'Parametar size nije ispravan.' })
  const filters: InboxFilters = {
    status: status as SubmissionStatus | 'all',
    type: (type || undefined) as SubmissionType | undefined,
    targetKind: targetKind ? targetKind as InboxFilters['targetKind'] : undefined,
    q: q || undefined,
    page: queryInteger(query.page, 'page', 1, 10_000),
    size
  }
  return listInbox(filters)
})
