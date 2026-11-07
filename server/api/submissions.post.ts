import type { ContributionKind } from '../../shared/utils/contribution'
import { allPublished, findPublished } from '../utils/content/records'

const MAX_BODY_BYTES = 16 * 1024
// A visitor may send a few corrections about one record, not dozens.
const TARGET_LIMIT = { max: 3, windowSeconds: 24 * 60 * 60 }

function invalidIssue(field: SubmissionIssue['field'], code: SubmissionIssue['code'], path?: string) {
  return createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: [{ field, code, ...(path ? { path } : {}) }] } })
}

// A Proposal names Published rows its Draft is built from (a category, a settlement or municipality, a parent town).
async function assertProposalReferences(kind: ContributionKind, payload: Record<string, string>) {
  if (kind === 'heritage_item') {
    if (payload.categoryId && !await findPublished('heritage_category', payload.categoryId)) throw invalidIssue('payload', 'invalid', 'categoryId')
    const places = [payload.settlementId, payload.municipalityId].filter(Boolean) as string[]
    if (!await allPublished('area', places)) throw invalidIssue('payload', 'invalid', payload.settlementId ? 'settlementId' : 'municipalityId')
  } else if (kind === 'area' && !await findPublished('area', { id: payload.parentId!, kind: ['town', 'municipality'] })) {
    throw invalidIssue('payload', 'invalid', 'parentId')
  } else if (kind === 'person' && !await findPublished('area', { id: payload.settlementId!, kind: 'settlement' })) {
    throw invalidIssue('payload', 'invalid', 'settlementId')
  }
}

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
  const input = result.value
  // Above 1000 pending submissions the form says "try later": a flood must not fill the free-tier database.
  await assertPendingCapacity()
  if (input.wordId) await assertActiveWord(input.wordId, input.locale)

  let fingerprint: string | null = null
  let throttleKey = ''
  const structured = !!input.targetKind && !!input.payload
  if (structured) {
    // A form that sent no valid render-time token is a script; one that was too quick or too old gets a
    // silent success so it learns nothing. Without a configured secret the check is skipped.
    const token = checkFormToken(event, body?.formToken)
    if (token === 'invalid') throw invalidIssue('payload', 'invalid', 'formToken')
    if (token === 'too-fast' || token === 'expired') {
      setResponseStatus(event, 201)
      return { ok: true }
    }
    assertLinkCap(input)
    if (input.type === 'correction') {
      const target = await resolveContributionTarget(input.targetKind!, input.targetId!)
      if (!target) throw invalidIssue('targetId', 'invalid')
      input.targetId = target.id
      input.baseRevision ??= target.revision
    } else {
      await assertProposalReferences(input.targetKind!, input.payload!)
    }
    throttleKey = `${key}|${input.type}|${input.targetKind}|${input.targetId ?? ''}`
    if (isRateLimited('submission-targets', throttleKey, TARGET_LIMIT.max, TARGET_LIMIT.windowSeconds)) {
      throw createError({ statusCode: 429, statusMessage: 'Too many submissions' })
    }
    fingerprint = submissionFingerprint(input, input.targetId)
    if (await isRecentDuplicate(fingerprint)) {
      setResponseStatus(event, 201)
      return { ok: true }
    }
  }
  await insertSubmission({
    ...input,
    fingerprint,
    place: selected ? placeSnapshot(selected) : null,
    placeCatalogVersion: selected ? PLACE_CATALOG_VERSION : null
  })
  if (throttleKey) countRateLimit('submission-targets', throttleKey, TARGET_LIMIT.windowSeconds)
  setResponseStatus(event, 201)
  return { ok: true }
})
