// GET /api/content/target?kind=heritage_item|area|source|person&id=<uuid or old id>: what a correction form points
// at. Old ids (`krizevci-crkva-sv-ane`, `krizevci`, a DGU code) keep old `?zapis=` links working.
export default defineEventHandler(async (event) => {
  const kind = queryParam(event, 'kind') ?? 'heritage_item'
  const id = queryParam(event, 'id')
  if (!isContentTargetKind(kind)) throw createError({ statusCode: 400, statusMessage: 'Invalid kind' })
  if (!id || id.length > 200) throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  return resolvedResponse(event, contentTarget(await getPublicContent(), kind, id), 'Content not found')
})
