import { contentKindParam } from '../../../../../utils/content/registry'
import { contentIdParam } from '../../../../../utils/content/store'
import { restoreRevision } from '../../../../../utils/content/history'

// Writes a stored version back as a new revision: `{ revisionId, revision }`.
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return restoreRevision(event, contentKindParam(event), contentIdParam(event))
})
