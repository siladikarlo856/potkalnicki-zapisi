// GET /api/atlas/municipalities/:slug: a town or municipality page; `{ redirect }` for an old slug.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolveMunicipality(content, getRouterParam(event, 'slug') ?? '')
  return resolvedResponse(event, result.status === 'ok' ? { status: 'ok', value: municipalityPage(content, result.value) } : result, 'Municipality not found')
})
