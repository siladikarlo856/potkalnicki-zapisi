import type { AtlasHeritageItemResponse } from '~~/shared/types/publicAtlas'

// GET /api/atlas/heritage/:settlement/:slug: one item page as `{ item }`; `{ redirect }` for an old
// settlement or item slug, 410 when archived.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolveHeritageItem(content, getRouterParam(event, 'settlement') ?? '', getRouterParam(event, 'slug') ?? '')
  return resolvedResponse<AtlasHeritageItemResponse>(event, result.status === 'ok'
    ? { status: 'ok', value: { item: heritageItemDetail(content, result.value) } }
    : result, 'Heritage item not found')
})
