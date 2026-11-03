// GET /api/atlas/settlements/:slug: a settlement page with its heritage items; `{ redirect }` for an old slug.
export default defineEventHandler(async (event) => {
  const content = await getPublicContent()
  const result = resolveSettlement(content, getRouterParam(event, 'slug') ?? '')
  return resolvedResponse(event, result.status === 'ok' ? { status: 'ok', value: settlementPage(content, result.value) } : result, 'Settlement not found')
})
