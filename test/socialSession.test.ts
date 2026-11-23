import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const h3: typeof import('h3') = createRequire(createRequire(import.meta.url).resolve('nuxt/package.json'))('@nuxt/nitro-server/h3')

const { resolveSignedInUser, loadAccountRole, verifiedProviderEmail } = vi.hoisted(() => ({
  resolveSignedInUser: vi.fn(), loadAccountRole: vi.fn(), verifiedProviderEmail: vi.fn()
}))
vi.mock('../server/utils/accountSync', () => ({ resolveSignedInUser, loadAccountRole, verifiedProviderEmail }))
vi.mock('../server/utils/adminSession', () => ({ hasAdminSession: async () => false }))

beforeEach(() => {
  vi.resetModules()
  resolveSignedInUser.mockReset().mockResolvedValue({ id: 'account-B' })
  loadAccountRole.mockReset().mockResolvedValue('none')
  verifiedProviderEmail.mockReset().mockReturnValue('b@example.com')
  for (const name of ['defineEventHandler', 'getRequestHeader', 'getCookie', 'getRequestURL', 'setCookie', 'deleteCookie', 'createError'] as const) {
    vi.stubGlobal(name, h3[name])
  }
})

afterEach(() => vi.unstubAllGlobals())

describe('social cookie replacement responses', () => {
  it('clears the password cookie without deleting a newer social credential', async () => {
    const logout = (await import('../server/api/admin/session.delete')).default
    const app = h3.createApp()
    app.use(logout)
    const response = await h3.toWebHandler(app)(new Request('https://example.com/api/admin/session', {
      method: 'DELETE', headers: { cookie: 'pz-editorial-access-token=new.google.token' }
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ authenticated: false })
    expect(response.headers.getSetCookie()).toEqual([expect.stringContaining('admin-session=; Max-Age=0')])
  })

  it.each([
    { failure: 'missing token', status: 401 },
    { failure: 'cookie-only renewal', status: 401 },
    { failure: 'invalid token', status: 401 },
    { failure: 'unverified email', status: 403 },
    { failure: 'role lookup', status: 503 }
  ])('clears the previous credential after $failure fails', async ({ failure, status }) => {
    if (failure === 'invalid token') resolveSignedInUser.mockRejectedValueOnce(h3.createError({ statusCode: 401 }))
    if (failure === 'unverified email') verifiedProviderEmail.mockReturnValueOnce(null)
    if (failure === 'role lookup') loadAccountRole.mockRejectedValueOnce(h3.createError({ statusCode: 503 }))
    const replacement = (await import('../server/api/admin/social-session.post')).default
    const { requireReviewer } = await import('../server/utils/reviewAuth')
    const app = h3.createApp({ onError: (error, event) => h3.sendError(event, error) })
    app.use('/api/admin/social-session', replacement)
    app.use('/api/admin/private', h3.defineEventHandler(async (event) => {
      await requireReviewer(event)
      return { private: true }
    }))
    const request = h3.toWebHandler(app)
    const headers = new Headers({ cookie: 'pz-editorial-access-token=account-A' })
    if (failure !== 'missing token' && failure !== 'cookie-only renewal') headers.set('authorization', 'Bearer b.google.token')
    if (failure === 'missing token') headers.delete('cookie')
    const response = await request(new Request('https://example.com/api/admin/social-session', { method: 'POST', headers }))
    expect(response.status).toBe(status)
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('pz-editorial-access-token='))
    expect(cookie).toBeDefined()
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('HttpOnly')
    if (failure === 'cookie-only renewal') {
      expect(resolveSignedInUser).not.toHaveBeenCalled()
      expect(loadAccountRole).not.toHaveBeenCalled()
    }
    loadAccountRole.mockResolvedValue('maintainer')
    const next = await request(new Request('https://example.com/api/admin/private', {
      headers: { cookie: cookie!.split(';')[0]! }
    }))
    expect(next.status).toBe(401)
  })

  it('refuses social session delete without any credential', async () => {
    const removal = (await import('../server/api/admin/social-session.delete')).default
    const app = h3.createApp({ onError: (error, event) => h3.sendError(event, error) })
    app.use(removal)
    const response = await h3.toWebHandler(app)(new Request('https://example.com/api/admin/social-session', { method: 'DELETE' }))
    expect(response.status).toBe(401)
  })

  it('clears the editorial cookie when a stale credential is still present', async () => {
    const removal = (await import('../server/api/admin/social-session.delete')).default
    const app = h3.createApp()
    app.use(removal)
    const response = await h3.toWebHandler(app)(new Request('https://example.com/api/admin/social-session', {
      method: 'DELETE',
      headers: { cookie: 'pz-editorial-access-token=stale.google.token' }
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.getSetCookie()).toEqual([expect.stringContaining('pz-editorial-access-token=; Max-Age=0')])
  })

  it('replaces the credential on a successful Bearer renewal with a fixed lifetime', async () => {
    const replacement = (await import('../server/api/admin/social-session.post')).default
    const app = h3.createApp()
    app.use(replacement)
    const headers = new Headers({ cookie: 'pz-editorial-access-token=a.google.token' })
    headers.set('authorization', 'Bearer b.google.token')
    const response = await h3.toWebHandler(app)(new Request('https://example.com/api/admin/social-session', { method: 'POST', headers }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, role: 'none' })
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining('pz-editorial-access-token=b.google.token;')
    ])
    expect(response.headers.get('set-cookie')).toContain('Max-Age=3600')
    expect(resolveSignedInUser).toHaveBeenCalledTimes(1)
    expect(loadAccountRole).toHaveBeenCalledTimes(1)
  })
})
