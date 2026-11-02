import { contentKindParam } from '../../../utils/content/registry'
import { lookupContent } from '../../../utils/content/store'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return lookupContent(event, contentKindParam(event))
})
