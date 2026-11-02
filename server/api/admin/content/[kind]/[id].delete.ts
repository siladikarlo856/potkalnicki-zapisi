import { contentKindParam } from '../../../../utils/content/registry'
import { contentIdParam, deleteContent } from '../../../../utils/content/store'

// `?mode=archive` (the default) hides the row and keeps it; `?mode=hard` removes an unreferenced row.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return deleteContent(event, contentKindParam(event), contentIdParam(event))
})
