import { lookupAreas } from '../../../utils/content/areaLookup'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  return lookupAreas(event)
})
