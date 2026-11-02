import { contentKindParam } from '../../../../utils/content/registry'
import { contentIdParam, getContent } from '../../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return getContent(contentKindParam(event), contentIdParam(event))
})
