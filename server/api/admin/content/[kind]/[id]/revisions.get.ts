import { contentKindParam } from '../../../../../utils/content/registry'
import { contentIdParam } from '../../../../../utils/content/store'
import { listRevisions } from '../../../../../utils/content/history'

// The row's change history, newest first, each revision with the fields it changed.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return listRevisions(event, contentKindParam(event), contentIdParam(event))
})
