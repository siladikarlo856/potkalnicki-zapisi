import type { AtlasIntangibleResponse } from '~~/shared/types/publicIntangible'

// GET /api/atlas/intangible/:kind/:slug: a Story, Custom or Folk text as `{ record }` (kind is prica, obicaj or
// usmeni-tekst); `{ redirect }` for an old slug, 410 when archived.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolveIntangible(content, getRouterParam(event, 'kind') ?? '', getRouterParam(event, 'slug') ?? '')
  return resolvedResponse<AtlasIntangibleResponse>(event, result.status === 'ok'
    ? { status: 'ok', value: { record: intangibleDetail(content, result.value) } }
    : result, 'Record not found')
})
