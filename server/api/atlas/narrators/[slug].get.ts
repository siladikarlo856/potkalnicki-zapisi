import type { AtlasNarratorResponse } from '~~/shared/types/publicIntangible'

// GET /api/atlas/narrators/:slug: a narrator, under the public identity rule (the name only with recorded consent),
// with everything they told or wrote down; `{ redirect }` for an old slug, 410 when archived.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolveNarrator(content, getRouterParam(event, 'slug') ?? '')
  return resolvedResponse<AtlasNarratorResponse>(event, result.status === 'ok'
    ? { status: 'ok', value: narratorPage(content, result.value) }
    : result, 'Narrator not found')
})
