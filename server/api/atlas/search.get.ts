import type { ArchiveSearchGroup } from '~~/shared/types/publicAtlas'
import { archiveSearch } from '../../utils/publicAtlas'

const GROUPS: ArchiveSearchGroup['key'][] = ['places', 'heritage', 'intangible', 'persons', 'speech']

export default defineEventHandler(async (event) => {
  const { q: rawQuery, skupina } = getQuery(event)
  const q = String(rawQuery ?? '').trim()
  if (q.length < 2) return { query: q, total: 0, groups: [] }
  const only = GROUPS.find(key => key === skupina)
  const result = archiveSearch(await getPublicContent(), q, only ? Number.MAX_SAFE_INTEGER : 3, only)
  cachePublicContent(event)
  return result
})
