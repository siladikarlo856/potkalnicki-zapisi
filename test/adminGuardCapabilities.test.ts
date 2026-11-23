import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('createError', (error: { statusCode?: number, statusMessage?: string }) => {
    const err = new Error(error.statusMessage ?? 'error')
    return Object.assign(err, error)
  })
  vi.stubGlobal('getRequestURL', (event: { path: string }) => new URL(`https://example.com${event.path}`))
})

describe('assertEditorialRouteCapability', () => {
  it.each([
    ['/api/admin/inbox', { mode: 'social', role: 'maintainer', accountId: 'm1', email: 'm@e.com' }, false],
    ['/api/admin/content/word', { mode: 'social', role: 'maintainer', accountId: 'm1', email: 'm@e.com' }, false],
    ['/api/admin/accounts', { mode: 'social', role: 'maintainer', accountId: 'm1', email: 'm@e.com' }, true],
    ['/api/admin/accounts/pending', { mode: 'password', role: 'admin', accountId: null, email: null }, true],
    ['/api/admin/accounts/audit', { mode: 'automation', role: 'admin', accountId: null, email: null }, true],
    ['/api/admin/accounts', { mode: 'social', role: 'admin', accountId: 'a1', email: 'a@e.com' }, false],
    ['/api/admin/inbox', { mode: 'password', role: 'admin', accountId: null, email: null }, false]
  ] as const)('on %s with %s role rejects user management only when required', async (path, reviewer, forbidden) => {
    const { assertEditorialRouteCapability } = await import('../server/utils/editorialCapabilities')
    const { setReviewerContext } = await import('../server/utils/reviewerContext')
    const event = { path, context: {} as { reviewer?: unknown } }
    setReviewerContext(event as never, reviewer)
    const run = () => assertEditorialRouteCapability(event as never)
    if (forbidden) await expect(run).toThrow(expect.objectContaining({ statusCode: 403 }))
    else expect(run).not.toThrow()
  })
})
