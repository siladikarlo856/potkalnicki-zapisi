import type { AtlasPersonResponse } from '~~/shared/types/publicAtlas'

// GET /api/atlas/persons/:slug: one person as `{ person }`; `{ redirect }` for an old slug, 410 when archived.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolvePerson(content, getRouterParam(event, 'slug') ?? '')
  return resolvedResponse<AtlasPersonResponse>(event, result.status === 'ok'
    ? { status: 'ok', value: { person: personDetail(content, result.value) } }
    : result, 'Person not found')
})
