import { contentKindParam } from '../../../../utils/content/registry'
import { contentIdParam, updateContent } from '../../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return updateContent(event, contentKindParam(event), contentIdParam(event))
})
