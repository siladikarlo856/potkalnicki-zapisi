import { listHistoryLog } from '../../utils/content/history'

// The change log across every kind (/admin/povijest).
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return listHistoryLog(event)
})
