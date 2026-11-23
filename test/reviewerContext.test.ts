import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const h3: typeof import('h3') = createRequire(createRequire(import.meta.url).resolve('nuxt/package.json'))('@nuxt/nitro-server/h3')

const { hasAdminSession, resolveSignedInUser, loadAccountRole, verifiedProviderEmail } = vi.hoisted(() => ({
  hasAdminSession: vi.fn(),
  resolveSignedInUser: vi.fn(),
  loadAccountRole: vi.fn(),
  verifiedProviderEmail: vi.fn()
}))

vi.mock('../server/utils/adminSession', () => ({ hasAdminSession }))
vi.mock('../server/utils/accountSync', () => ({ resolveSignedInUser, loadAccountRole, verifiedProviderEmail }))

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ reviewSecret: 'automation-secret-123456' }))
  vi.stubGlobal('getRequestHeader', (event: { bearer?: string, browser?: boolean }, name: string) => {
    if (name === 'authorization') return event.bearer ? `Bearer ${event.bearer}` : undefined
    if (name === 'x-pz-browser-auth') return event.browser ? '1' : undefined
  })
  vi.stubGlobal('getCookie', (event: { cookie?: string }) => event.cookie)
  vi.stubGlobal('createError', (error: object) => Object.assign(new Error('error'), error))
  vi.stubGlobal('clientKey', () => 'reviewer-test')
  const limits = await import('../server/utils/rateLimit')
  vi.stubGlobal('isRateLimited', limits.isRateLimited)
  vi.stubGlobal('countRateLimit', limits.countRateLimit)
  hasAdminSession.mockResolvedValue(false)
  resolveSignedInUser.mockResolvedValue({ id: 'u1' })
  verifiedProviderEmail.mockReturnValue('editor@example.com')
  loadAccountRole.mockResolvedValue('maintainer')
})

afterEach(() => vi.unstubAllGlobals())

describe('resolveReviewerContext', () => {
  it('refuses an older social cookie when a browser request has no current account', async () => {
    const { requireReviewer } = await import('../server/utils/reviewAuth')
    await expect(requireReviewer({ context: {}, cookie: 'old.editor.token', browser: true } as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(resolveSignedInUser).not.toHaveBeenCalled()
  })

  it('uses the current role-none Bearer instead of the older editor cookie', async () => {
    loadAccountRole.mockResolvedValue('none')
    const { requireReviewer } = await import('../server/utils/reviewAuth')
    await expect(requireReviewer({ context: {}, bearer: 'new.google.token', cookie: 'old.editor.token', browser: true } as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(resolveSignedInUser).toHaveBeenCalledExactlyOnceWith('new.google.token')
  })

  it('retains password access when a browser request has no social account', async () => {
    hasAdminSession.mockResolvedValue(true)
    const { resolveReviewerContext } = await import('../server/utils/reviewerContext')
    await expect(resolveReviewerContext({ context: {}, cookie: 'old.editor.token', browser: true } as never)).resolves.toMatchObject({ mode: 'password', role: 'admin' })
    expect(resolveSignedInUser).not.toHaveBeenCalled()
  })

  it('accepts automation Bearers and shared password sessions', async () => {
    const { resolveReviewerContext } = await import('../server/utils/reviewerContext')
    await expect(resolveReviewerContext({ context: {}, bearer: 'automation-secret-123456' } as never)).resolves.toMatchObject({ mode: 'automation', role: 'admin' })
    hasAdminSession.mockResolvedValueOnce(true)
    await expect(resolveReviewerContext({ context: {} } as never)).resolves.toMatchObject({ mode: 'password', role: 'admin' })
  })

  it.each(['incorrect-secret', 'invalid.jwt.token'])('throttles failed Bearers (%s) using the password allowance', async (bearer) => {
    resolveSignedInUser.mockRejectedValue(new Error('invalid session'))
    const { resolveReviewerContext } = await import('../server/utils/reviewerContext')
    const { verifyReviewerPassword } = await import('../server/utils/reviewerPassword')
    for (let i = 0; i < 10; i++) {
      await expect(resolveReviewerContext({ context: {}, bearer } as never)).rejects.toMatchObject({ statusCode: 401 })
    }
    await expect(resolveReviewerContext({ context: {}, bearer: 'automation-secret-123456' } as never)).rejects.toMatchObject({ statusCode: 429 })
    expect(() => verifyReviewerPassword({} as never, 'automation-secret-123456')).toThrow(expect.objectContaining({ statusCode: 429 }))
    await expect(resolveReviewerContext({ context: {}, bearer: 'valid.google.token' } as never)).rejects.toMatchObject({ statusCode: 429 })
    resolveSignedInUser.mockResolvedValue({ id: 'u1' })
    await expect(resolveReviewerContext({ context: {}, bearer: 'valid.google.token' } as never)).resolves.toMatchObject({ mode: 'social', role: 'maintainer' })
  })

  it.each(['bearer', 'cookie'])('verifies a social %s once per request and reloads roles on the next request', async (source) => {
    const { requireReviewer } = await import('../server/utils/reviewAuth')
    const event = { context: {}, [source]: 'valid.google.token' }
    await Promise.all([requireReviewer(event as never), requireReviewer(event as never)])
    await requireReviewer(event as never)
    expect(resolveSignedInUser).toHaveBeenCalledTimes(1)
    expect(loadAccountRole).toHaveBeenCalledTimes(1)
    loadAccountRole.mockResolvedValue('none')
    await expect(requireReviewer({ context: {}, [source]: 'valid.google.token' } as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(resolveSignedInUser).toHaveBeenCalledTimes(2)
    expect(loadAccountRole).toHaveBeenCalledTimes(2)
  })
})

describe('social cookie creation', () => {
  beforeEach(() => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRequestURL', () => new URL('https://example.com/api/admin/social-session'))
    vi.stubGlobal('setCookie', vi.fn())
    vi.stubGlobal('deleteCookie', vi.fn())
  })

  it('reuses the verified Bearer user when loading the role', async () => {
    const handler = (await import('../server/api/admin/social-session.post')).default
    const event = { context: {}, bearer: 'valid.google.token' }
    await expect(handler(event as never)).resolves.toEqual({ ok: true, role: 'maintainer' })
    expect(resolveSignedInUser).toHaveBeenCalledTimes(1)
    expect(loadAccountRole).toHaveBeenCalledExactlyOnceWith('u1')
    expect(setCookie).toHaveBeenCalledWith(event, 'pz-editorial-access-token', 'valid.google.token', expect.objectContaining({ httpOnly: true, secure: true, maxAge: 3600 }))
  })

  it('refuses unverified users before setting a cookie', async () => {
    verifiedProviderEmail.mockReturnValue(null)
    const handler = (await import('../server/api/admin/social-session.post')).default
    await expect(handler({ context: {}, bearer: 'invalid.google.token' } as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(loadAccountRole).not.toHaveBeenCalled()
    expect(setCookie).not.toHaveBeenCalled()
  })
})

describe('combined credential HTTP requests', () => {
  beforeEach(async () => {
    const adminSession = await vi.importActual<typeof import('../server/utils/adminSession')>('../server/utils/adminSession')
    hasAdminSession.mockImplementation(adminSession.hasAdminSession)
    vi.stubGlobal('useRuntimeConfig', () => ({
      reviewSecret: 'automation-secret-123456',
      adminSessionPassword: 'test-only-session-password-with-at-least-32-characters'
    }))
    for (const name of ['defineEventHandler', 'getRequestHeader', 'getCookie', 'useSession', 'createError'] as const) {
      vi.stubGlobal(name, h3[name])
    }
    loadAccountRole.mockResolvedValue('none')
  })

  it.each([
    ['/api/admin/private', 'GET'],
    ['/api/admin/private', 'POST'],
    ['/api/review/private', 'GET'],
    ['/api/review/private', 'POST']
  ])('accepts a valid password cookie beside a role-none Google Bearer at %s (%s)', async (path, method) => {
    const { useAdminSession } = await vi.importActual<typeof import('../server/utils/adminSession')>('../server/utils/adminSession')
    const { requireReviewer } = await import('../server/utils/reviewAuth')
    const status = (await import('../server/api/admin/session.get')).default
    const { getReviewerContext } = await import('../server/utils/reviewerContext')
    const app = h3.createApp()
    app.use('/password-login', h3.defineEventHandler(async (event) => {
      const session = await useAdminSession(event)
      await session.update({ authenticated: true })
      return { ok: true }
    }))
    app.use('/api/admin/session', status)
    app.use(path, h3.defineEventHandler(async (event) => {
      await requireReviewer(event)
      await requireReviewer(event)
      return { ok: true, reviewer: getReviewerContext(event) }
    }))
    const request = h3.toWebHandler(app)
    const login = await request(new Request('https://example.com/password-login', { method: 'POST' }))
    expect(login.status).toBe(200)
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('admin-session='))!.split(';')[0]!
    const headers = { cookie, 'authorization': 'Bearer role.none.token', 'x-pz-browser-auth': '1' }
    const session = await request(new Request('https://example.com/api/admin/session', { headers }))
    expect(await session.json()).toEqual({ authenticated: true, role: 'admin' })
    const response = await request(new Request(`https://example.com${path}`, { method, headers }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, reviewer: { mode: 'password', role: 'admin', accountId: null, email: null }
    })
    expect(resolveSignedInUser).not.toHaveBeenCalled()
    const denied = await request(new Request(`https://example.com${path}`, {
      method, headers: { ...headers, cookie: 'admin-session=invalid' }
    }))
    expect(denied.status).toBe(403)
    expect(resolveSignedInUser).toHaveBeenCalledExactlyOnceWith('role.none.token')
  })
})
