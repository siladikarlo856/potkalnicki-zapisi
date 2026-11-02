import { contentKindParam } from '../../../../../utils/content/registry'
import { contentIdParam, contentReferences } from '../../../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return contentReferences(contentKindParam(event), contentIdParam(event))
})
