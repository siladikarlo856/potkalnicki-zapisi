import { contentKindParam } from '../../../../utils/content/registry'
import { listContent } from '../../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return listContent(event, contentKindParam(event))
})
