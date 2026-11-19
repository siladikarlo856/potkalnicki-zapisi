import { archiveSearch } from '../../utils/publicAtlas'

export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2) return { query: q, total: 0, groups: [] }
  const result = archiveSearch(await getPublicContent(), q)
  cachePublicContent(event)
  return result
})
