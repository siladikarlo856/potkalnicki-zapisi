import type { AtlasThemeResponse } from '~~/shared/types/publicIntangible'

// GET /api/atlas/themes/:slug: a theme and its records across kinds; `{ redirect }` for an old slug, 410 when archived.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolveTheme(content, getRouterParam(event, 'slug') ?? '')
  return resolvedResponse<AtlasThemeResponse>(event, result.status === 'ok'
    ? { status: 'ok', value: themePage(content, result.value) }
    : result, 'Theme not found')
})
