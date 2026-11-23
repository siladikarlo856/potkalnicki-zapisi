import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveReviewerContext = vi.hoisted(() => vi.fn())

vi.mock('../server/utils/reviewerContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/reviewerContext')>()
  return { ...actual, resolveReviewerContext }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  resolveReviewerContext.mockResolvedValue(null)
  vi.stubGlobal('createError', (error: { statusCode?: number, statusMessage?: string }) => {
    const err = new Error(error.statusMessage ?? 'error')
    return Object.assign(err, error)
  })
  vi.stubGlobal('useRuntimeConfig', () => ({ reviewSecret: 'automation-secret-123456' }))
  vi.stubGlobal('clientKey', () => 'k')
  vi.stubGlobal('isRateLimited', () => false)
  vi.stubGlobal('countRateLimit', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requireReviewer', () => {
  it('allows password, automation, and editorial social sessions and blocks role none', async () => {
    const { requireReviewer } = await import('../server/utils/reviewAuth')
    const event = { context: {} }

    resolveReviewerContext.mockResolvedValueOnce({ mode: 'password', role: 'admin', accountId: null, email: null })
    await expect(requireReviewer(event as never)).resolves.toBeUndefined()
    expect(event.context.reviewer).toMatchObject({ mode: 'password' })

    resolveReviewerContext.mockResolvedValueOnce({ mode: 'automation', role: 'admin', accountId: null, email: null })
    await expect(requireReviewer({ context: {} } as never)).resolves.toBeUndefined()

    resolveReviewerContext.mockResolvedValueOnce({ mode: 'social', role: 'maintainer', accountId: 'u1', email: 'm@example.com' })
    const maintainerEvent = { context: {} }
    await expect(requireReviewer(maintainerEvent as never)).resolves.toBeUndefined()
    expect(maintainerEvent.context.reviewer?.role).toBe('maintainer')

    resolveReviewerContext.mockResolvedValueOnce({ mode: 'social', role: 'none', accountId: 'u2', email: 'n@example.com' })
    await expect(requireReviewer({ context: {} } as never)).rejects.toMatchObject({ statusCode: 403 })

    resolveReviewerContext.mockResolvedValueOnce(null)
    await expect(requireReviewer({ context: {} } as never)).rejects.toMatchObject({ statusCode: 401 })
  })
})
