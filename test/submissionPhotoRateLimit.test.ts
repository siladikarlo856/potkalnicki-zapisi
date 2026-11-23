import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientKey, countRateLimit, isRateLimited } from '../server/utils/rateLimit'

const boundary = vi.hoisted(() => ({
  contributor: vi.fn(), multipart: vi.fn(), insert: vi.fn(), capacity: vi.fn()
}))
vi.mock('h3', () => ({ readMultipartFormData: boundary.multipart }))
vi.mock('../server/utils/requireContributor', () => ({ requireSignedInContributor: boundary.contributor }))
vi.mock('../server/utils/contributions', () => ({ assertPendingCapacity: boundary.capacity }))
vi.mock('../server/utils/submissionPhotos', () => ({
  SUBMISSION_PHOTO_BODY_LIMIT: 55_000_000,
  parsePhotoSubmissionMeta: () => ({ ok: true, value: { photos: [{}] } }),
  matchPhotoFiles: () => ({ files: [{}], issues: [] }),
  insertPhotoSubmission: boundary.insert
}))

let client = 0
beforeEach(() => {
  vi.clearAllMocks()
  client++
  boundary.contributor.mockResolvedValue({ accountId: 'account' })
  boundary.multipart.mockResolvedValue([{ name: 'meta', data: new TextEncoder().encode('{}') }])
  boundary.insert.mockResolvedValue(1)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', (error: object) => Object.assign(new Error('request failed'), error))
  vi.stubGlobal('useRuntimeConfig', () => ({ submissionRateLimit: { max: 1, windowSeconds: 60 } }))
  vi.stubGlobal('getRequestHeader', (_event: unknown, header: string) => header === 'content-length' ? '2' : `192.0.2.${client}`)
  vi.stubGlobal('clientKey', clientKey)
  vi.stubGlobal('isRateLimited', isRateLimited)
  vi.stubGlobal('countRateLimit', countRateLimit)
  vi.stubGlobal('setResponseStatus', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('photo submission throttling', () => {
  it('blocks repeated uploads before authentication and multipart buffering', async () => {
    const { default: submit } = await import('../server/api/submissions/photo.post')
    await expect(submit({} as never)).resolves.toEqual({ ok: true, id: 1 })
    await expect(submit({} as never)).rejects.toMatchObject({ statusCode: 429 })
    expect(boundary.contributor).toHaveBeenCalledTimes(1)
    expect(boundary.multipart).toHaveBeenCalledTimes(1)
    expect(boundary.insert).toHaveBeenCalledTimes(1)
  })

  it('shares the existing submissions bucket', async () => {
    countRateLimit('submissions', `192.0.2.${client}`, 60)
    const { default: submit } = await import('../server/api/submissions/photo.post')
    await expect(submit({} as never)).rejects.toMatchObject({ statusCode: 429 })
    expect(boundary.contributor).not.toHaveBeenCalled()
    expect(boundary.multipart).not.toHaveBeenCalled()
  })
})
