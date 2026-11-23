import { readMultipartFormData } from 'h3'
import { requireSignedInContributor } from '../../utils/requireContributor'
import {
  SUBMISSION_PHOTO_BODY_LIMIT,
  insertPhotoSubmission,
  matchPhotoFiles,
  parsePhotoSubmissionMeta
} from '../../utils/submissionPhotos'
import { assertPendingCapacity } from '../../utils/contributions'

export default defineEventHandler(async (event) => {
  const { submissionRateLimit } = useRuntimeConfig(event)
  const key = clientKey(event)
  if (isRateLimited('submissions', key, submissionRateLimit.max, submissionRateLimit.windowSeconds)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many submissions' })
  }
  countRateLimit('submissions', key, submissionRateLimit.windowSeconds)

  const contentLength = Number(getRequestHeader(event, 'content-length') ?? '0')
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw createError({ statusCode: 411, statusMessage: 'Content-Length required' })
  }
  if (contentLength > SUBMISSION_PHOTO_BODY_LIMIT) {
    throw createError({ statusCode: 413, statusMessage: 'Submission too large' })
  }

  const { accountId } = await requireSignedInContributor(event)
  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: [{ path: 'photos', message: 'Dodaj barem jednu fotografiju.' }] } })
  }

  const metaPart = parts.find(part => part.name === 'meta')
  const parsed = parsePhotoSubmissionMeta(metaPart ? new TextDecoder().decode(metaPart.data) : null)
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues: parsed.issues } })
  }

  const { files, issues } = await matchPhotoFiles(parts, parsed.value.photos.length)
  if (issues.length) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid submission', data: { issues } })
  }

  await assertPendingCapacity()
  const submissionId = await insertPhotoSubmission(accountId, parsed.value, files)
  setResponseStatus(event, 201)
  return { ok: true, id: submissionId }
})
