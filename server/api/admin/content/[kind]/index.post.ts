import { contentKindParam } from '../../../../utils/content/registry'
import { createContent } from '../../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return createContent(event, contentKindParam(event))
})
