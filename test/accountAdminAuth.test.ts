import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveReviewerContext = vi.hoisted(() => vi.fn())
const requireReviewer = vi.hoisted(() => vi.fn())

vi.mock('../server/utils/reviewerContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/reviewerContext')>()
  return { ...actual, resolveReviewerContext }
})
vi.mock('../server/utils/reviewAuth', () => ({ requireReviewer }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  requireReviewer.mockResolvedValue(undefined)
  resolveReviewerContext.mockResolvedValue(null)
  vi.stubGlobal('createError', (error: { statusCode?: number, statusMessage?: string }) => {
    const err = new Error(error.statusMessage ?? 'error')
    return Object.assign(err, error)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requireSocialAdmin', () => {
  it('allows only a Google admin session', async () => {
    const { requireSocialAdmin } = await import('../server/utils/accountAdminAuth')
    const event = { context: { reviewer: { mode: 'social', role: 'admin', accountId: 'a1', email: 'a@e.com' } } }
    resolveReviewerContext.mockResolvedValue(event.context.reviewer)
    await expect(requireSocialAdmin(event as never)).resolves.toMatchObject({ mode: 'social', accountId: 'a1' })
    expect(requireReviewer).toHaveBeenCalled()
  })

  it.each([
    ['password', 'admin'],
    ['automation', 'admin'],
    ['social', 'maintainer'],
    ['social', 'none']
  ] as const)('returns 403 for %s/%s', async (mode, role) => {
    const { requireSocialAdmin } = await import('../server/utils/accountAdminAuth')
    resolveReviewerContext.mockResolvedValue({ mode, role, accountId: mode === 'social' ? 'u1' : null, email: null })
    await expect(requireSocialAdmin({ context: {} } as never)).rejects.toMatchObject({ statusCode: 403 })
  })
})
