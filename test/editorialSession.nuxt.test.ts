import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearNuxtState, useNuxtApp, useState } from '#imports'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { syncEditorialSessionCookie, withEditorialSessionLock } from '../app/utils/editorialSession'
import { useAdminSignOut } from '../app/composables/useAdminSession'
import { useAuthSession } from '../app/composables/useAuthSession'

const { request, navigate } = vi.hoisted(() => ({ request: vi.fn(), navigate: vi.fn() }))
mockNuxtImport('$fetch', () => request)
mockNuxtImport('navigateTo', () => navigate)

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
let storedToken: string | null
let cookie: string | null
let pending: ReturnType<typeof Promise.withResolvers<undefined>> | null
let active: number
let maximumActive: number

function client() {
  return {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: async () => ({ data: { session: storedToken ? { access_token: storedToken } : null }, error: null }),
      signOut: vi.fn().mockImplementation(async () => {
        storedToken = null
        return { error: null }
      })
    }
  } as unknown as SupabaseClient
}

beforeEach(() => {
  clearNuxtState(key => key.startsWith('pz-auth-') || key === 'pz-supabase-client')
  useNuxtApp().payload.once.delete('pz-auth-session-initialized')
  navigate.mockClear()
  let tail = Promise.resolve()
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name: string, action: () => Promise<void>) => {
        const next = tail.then(action)
        tail = next.catch(() => {})
        return next
      }
    }
  })
  storedToken = 'account-A'
  cookie = null
  pending = null
  active = 0
  maximumActive = 0
  request.mockReset().mockImplementation(async (url: string, options: { method: string, headers?: { Authorization: string } }) => {
    active++
    maximumActive = Math.max(maximumActive, active)
    const delay = pending
    pending = null
    await delay?.promise
    active--
    if (url === '/api/admin/social-session') {
      if (options.method === 'DELETE' && !cookie) throw { statusCode: 401 }
      cookie = options.method === 'POST' ? options.headers!.Authorization.slice('Bearer '.length) : null
    }
    return { ok: true }
  })
})

afterEach(() => {
  clearNuxtState(key => key.startsWith('pz-auth-') || key === 'pz-supabase-client')
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

describe('editorial cookie ordering', () => {
  it('preserves a newer sign-in while the older password logout is pending', async () => {
    const authClient = client()
    useState('pz-supabase-client').value = authClient
    const delay = Promise.withResolvers<undefined>()
    const implementation = request.getMockImplementation()!
    request.mockImplementation((url, options) => {
      if (url === '/api/admin/session') pending = delay
      return implementation(url, options)
    })
    const logout = useAdminSignOut()()
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('/api/admin/session', { method: 'DELETE' }))
    storedToken = 'account-B'
    await syncEditorialSessionCookie(authClient)
    expect(cookie).toBe('account-B')
    delay.resolve(undefined)
    await logout
    expect(cookie).toBe('account-B')
    expect(storedToken).toBe('account-B')
  })

  it('keeps admin logout incomplete when Supabase sign-out fails', async () => {
    const authClient = client()
    vi.mocked(authClient.auth.signOut).mockResolvedValueOnce({ error: new Error('sign-out failed') } as never)
    useState('pz-supabase-client').value = authClient
    expect(await useAdminSignOut()()).toContain('Odjava nije uspjela')
    expect(storedToken).toBe('account-A')
    expect(request.mock.calls.some(([url]) => url === '/api/admin/session')).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('still logs out password-only sessions', async () => {
    useState('pz-supabase-client').value = null
    await useAdminSignOut()()
    expect(request).toHaveBeenCalledWith('/api/admin/session', { method: 'DELETE' })
    expect(navigate).toHaveBeenCalledWith('/admin/prijava')
  })

  it.each([
    { method: 'POST', failure: new Error('synchronization failed') },
    { method: 'DELETE', failure: new Error('synchronization failed') },
    { method: 'POST', failure: { statusCode: 401 } },
    { method: 'DELETE', failure: { statusCode: 403 } },
    { method: 'DELETE', failure: { statusCode: 500 } }
  ])('propagates failed $method synchronization ($failure)', async ({ method, failure }) => {
    storedToken = method === 'POST' ? 'account-B' : null
    request.mockRejectedValueOnce(failure)
    await expect(syncEditorialSessionCookie(client())).rejects.toBe(failure)
    expect(request).toHaveBeenCalledWith('/api/admin/social-session', expect.objectContaining({ method }))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('initializes an anonymous session without a cookie synchronization error', async () => {
    storedToken = null
    useState('pz-supabase-client').value = client()
    const auth = useAuthSession()
    await auth.initialize()
    expect(auth.initialized.value).toBe(true)
    expect(auth.error.value).toBeNull()
    expect(request).toHaveBeenCalledWith('/api/admin/social-session', { method: 'DELETE' })
  })

  it('completes social logout when queued cleanup finds the cookie already cleared', async () => {
    cookie = storedToken
    useState('pz-supabase-client').value = client()
    const auth = useAuthSession()
    await useAdminSignOut()()
    expect(storedToken).toBeNull()
    expect(cookie).toBeNull()
    expect(auth.error.value).toBeNull()
    expect(request.mock.calls.filter(([url]) => url === '/api/admin/social-session')).toHaveLength(2)
    expect(navigate).toHaveBeenCalledWith('/admin/prijava')
  })

  it('reconciles a newer sign-in after credential-free DELETE returns 401', async () => {
    storedToken = null
    request.mockImplementationOnce(async () => {
      storedToken = 'account-B'
      throw { statusCode: 401 }
    })
    await syncEditorialSessionCookie(client())
    expect(cookie).toBe('account-B')
    expect(request).toHaveBeenNthCalledWith(1, '/api/admin/social-session', { method: 'DELETE' })
    expect(request).toHaveBeenNthCalledWith(2, '/api/admin/social-session', {
      method: 'POST', headers: { Authorization: 'Bearer account-B' }
    })
  })

  it.each(['account-B', null])('reconciles a late account-A POST to the current session %s', async (nextToken) => {
    const delay = Promise.withResolvers<undefined>()
    pending = delay
    const firstTab = syncEditorialSessionCookie(client())
    await vi.waitFor(() => expect(active).toBe(1))
    storedToken = nextToken
    const secondTab = syncEditorialSessionCookie(client())
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)
    delay.resolve(undefined)
    await Promise.all([firstTab, secondTab])
    expect(cookie).toBe(nextToken)
    expect(maximumActive).toBe(1)
  })

  it('reads the current shared session after acquiring the lock', async () => {
    const delay = Promise.withResolvers<undefined>()
    const blocker = withEditorialSessionLock(() => delay.promise)
    const queued = syncEditorialSessionCookie(client())
    storedToken = 'account-B'
    delay.resolve(undefined)
    await Promise.all([blocker, queued])
    expect(cookie).toBe('account-B')
    expect(request.mock.calls.every(([, options]) => options.headers?.Authorization === 'Bearer account-B')).toBe(true)
  })

  it('reconciles a late DELETE after another tab signs in', async () => {
    storedToken = null
    const delay = Promise.withResolvers<undefined>()
    pending = delay
    const logout = syncEditorialSessionCookie(client())
    await vi.waitFor(() => expect(active).toBe(1))
    storedToken = 'account-B'
    const login = syncEditorialSessionCookie(client())
    delay.resolve(undefined)
    await Promise.all([logout, login])
    expect(cookie).toBe('account-B')
    expect(maximumActive).toBe(1)
  })

  it('ends the persisted session before completing admin logout after a pending cookie write', async () => {
    const authClient = client()
    useState('pz-supabase-client').value = authClient
    const delay = Promise.withResolvers<undefined>()
    pending = delay
    const login = syncEditorialSessionCookie(authClient)
    await vi.waitFor(() => expect(active).toBe(1))
    const logout = useAdminSignOut()()
    await vi.waitFor(() => expect(authClient.auth.signOut).toHaveBeenCalledOnce())
    expect(storedToken).toBeNull()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)
    delay.resolve(undefined)
    await Promise.all([login, logout])
    expect(cookie).toBeNull()
    expect(maximumActive).toBe(1)
    expect(navigate).toHaveBeenCalledWith('/admin/prijava')
    request.mockClear()
    await syncEditorialSessionCookie(authClient)
    expect(cookie).toBeNull()
    expect(request.mock.calls.every(([, options]) => options.method === 'DELETE')).toBe(true)
  })
})
