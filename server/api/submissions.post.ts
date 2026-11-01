const MAX_BODY_BYTES = 16 * 1024

export default defineEventHandler(async (event) => {
  const { submissionRateLimit } = useRuntimeConfig(event)
  const key = clientKey(event)
  if (isRateLimited('submissions', key, submissionRateLimit.max, submissionRateLimit.windowSeconds)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many submissions' })
  }
  countRateLimit('submissions', key, submissionRateLimit.windowSeconds)

  const contentLength = getRequestHeader(event, 'content-length') ?? ''
  if (!/^\d+$/.test(contentLength)) {
    throw createError({ statusCode: 411, statusMessage: 'Content-Length required' })
  }
  if (Number(contentLength) > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Submission too large' })
  }

  const body = await readBody(event).catch(() => null)

  // Honeypot: people never see the "website" field, bots tend to fill it in.
  // Answer as if it worked so the bot has no reason to try again, but keep nothing.
  if (body && typeof body === 'object' && 'website' in body && body.website) {
    setResponseStatus(event, 201)
    return { ok: true }
  }

  const result = validateSubmission(body)
  if (!result.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: localizePlaceIssues(result.issues, body?.locale) } })
  }

  const selected = result.value.placeId ? resolveContributionPlace(result.value.placeId) : null
  if (result.value.placeId && !selected) {
    const place = placeById(result.value.placeId)
    const code = place && resolveActivePlace(result.value.placeId) ? 'outOfScope' : 'invalid'
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: localizePlaceIssues([{ field: 'place', code }], result.value.locale) } })
  }
  if (result.value.type === 'correction' && result.value.targetRef) {
    assertKnownCorrectionTarget(result.value.targetRef)
  }
  await insertSubmission({
    ...result.value,
    place: selected ? placeSnapshot(selected) : null,
    placeCatalogVersion: selected ? PLACE_CATALOG_VERSION : null
  })
  setResponseStatus(event, 201)
  return { ok: true }
})
