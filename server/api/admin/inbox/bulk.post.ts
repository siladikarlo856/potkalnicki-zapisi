import { BULK_LIMIT, bulkInbox } from '../../../utils/inbox'
import { fail } from '../../../utils/content/store'

// Spam clean-up: reject or delete up to 100 submissions in one request.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const body = await readJsonObject(event, 4096)
  const ids = body.ids
  if (!Array.isArray(ids) || !ids.length || ids.length > BULK_LIMIT || !ids.every(id => Number.isSafeInteger(id) && (id as number) > 0)) {
    fail(400, 'Invalid ids', { message: `Odaberi od 1 do ${BULK_LIMIT} prijedloga.` })
  }
  if (body.action !== 'reject' && body.action !== 'delete') fail(400, 'Invalid action', { message: 'Radnja nije ispravna.' })
  return bulkInbox(ids as number[], body.action)
})
