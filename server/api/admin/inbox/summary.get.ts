import { pendingCount } from '../../../utils/inbox'

// The number behind the sidebar badge on "Prijedlozi".
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return { pending: await pendingCount() }
})
