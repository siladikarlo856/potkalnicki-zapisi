import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { clearNuxtState, useNuxtApp, useRouter, useState } from '#imports'
import adminMiddleware from '../app/middleware/admin'
import { useAuthSession } from '../app/composables/useAuthSession'

const { request, navigate } = vi.hoisted(() => {
  const request = Object.assign(vi.fn(), {
    create: (defaults: { onRequest: (context: { options: { headers: Headers } }) => Promise<void> }) =>
      async (url: string, options: { headers?: HeadersInit } = {}): Promise<unknown> => {
        const headers = new Headers(options.headers)
        await defaults.onRequest({ options: { headers } })
        return request(url, { ...options, headers })
      }
  })
  return { request, navigate: vi.fn() }
})
mockNuxtImport('$fetch', () => request)
mockNuxtImport('navigateTo', () => navigate)

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
let storedSession: Session | null
let role: 'none' | 'maintainer' | 'admin'
let passwordSession: boolean
let cookieFailure: boolean
let staleEditorialCookie: boolean
let client: {
  auth: {
    getSession: ReturnType<typeof vi.fn>
    onAuthStateChange: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
  }
}

function resetAuth() {
  clearNuxtState(key => key.startsWith('pz-auth-') || key === 'pz-supabase-client')
  useNuxtApp().payload.once.delete('pz-auth-session-initialized')
}

function decide(path: string) {
  return useNuxtApp().runWithContext(() => adminMiddleware(useRouter().resolve(path), useRouter().currentRoute.value))
}

beforeEach(() => {
  resetAuth()
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
  storedSession = {
    access_token: 'restored.google.token', refresh_token: 'refresh', expires_in: 3600,
    token_type: 'bearer', user: { id: 'account-B', email: 'b@example.com' }
  } as Session
  role = 'none'
  passwordSession = false
  cookieFailure = false
  staleEditorialCookie = false
  client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: storedSession }, error: null })),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(async () => {
        storedSession = null
        return { error: null }
      })
    }
  }
  useState('pz-supabase-client').value = client
  navigate.mockClear()
  request.mockReset().mockImplementation(async (url: string, options?: { method?: string, headers?: HeadersInit }) => {
    if (url === '/api/account/sync') return { role }
    if (url === '/api/admin/social-session') {
      if (cookieFailure) throw new Error('cookie synchronization failed')
      return { ok: true, role }
    }
    if (url === '/api/admin/session') {
      if (passwordSession) return { authenticated: true, role: 'admin' }
      const headers = new Headers(options?.headers)
      if (staleEditorialCookie && headers.get('x-pz-browser-auth') !== '1') return { authenticated: true, role: 'maintainer' }
      expect(headers.get('x-pz-browser-auth')).toBe('1')
      if (!headers.has('authorization')) return { authenticated: false }
      expect(headers.get('authorization')).toBe(storedSession ? `Bearer ${storedSession.access_token}` : null)
      return storedSession
        ? { authenticated: role !== 'none', accountSignedIn: true, role }
        : { authenticated: false }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
})

afterEach(async () => {
  await flushPromises()
  resetAuth()
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})

describe('admin session restoration', () => {
  it('keeps password navigation working when Google restoration returns an error', async () => {
    passwordSession = true
    client.auth.getSession.mockImplementation(async () => ({ data: { session: null }, error: new Error('refresh endpoint unavailable') }))
    await decide('/admin/rijeci')
    expect(navigate).not.toHaveBeenCalled()
    const statusRequests = request.mock.calls.filter(([url]) => url === '/api/admin/session')
    expect(statusRequests.length).toBeGreaterThan(0)
    for (const [, options] of statusRequests) {
      const headers = new Headers(options.headers)
      expect(headers.get('authorization')).toBeNull()
      expect(headers.get('x-pz-browser-auth')).toBe('1')
    }
  })

  it('rejects a stale cookie on admin entry and login after logout cleanup fails', async () => {
    role = 'maintainer'
    await decide('/admin')
    staleEditorialCookie = true
    cookieFailure = true
    const failure = await useNuxtApp().runWithContext(() => useAuthSession().signOut())
    expect(failure).toContain('Urednička sesija nije usklađena')
    expect(storedSession).toBeNull()
    cookieFailure = false
    navigate.mockClear()
    await decide('/admin/rijeci')
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ path: '/admin/prijava', query: { next: '/admin/rijeci' } })
    navigate.mockClear()
    await decide('/admin/prijava?next=%2Fadmin%2Frijeci')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('checks persisted credentials when another tab changes accounts after initialization', async () => {
    role = 'maintainer'
    await decide('/admin')
    const previousSession = useState('pz-auth-session').value
    storedSession = { ...storedSession!, access_token: 'new.google.token', user: { ...storedSession!.user, id: 'account-C' } }
    role = 'none'
    expect(useState('pz-auth-session').value).toBe(previousSession)
    await decide('/admin/rijeci')
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/nema-pristupa')
  })

  it.each(['/admin', '/admin/prijava', '/admin/prijava/'])('restores a role-none account before choosing the destination for %s', async (path) => {
    const pending = Promise.withResolvers<{ data: { session: Session | null }, error: null }>()
    client.auth.getSession.mockReturnValueOnce(pending.promise)
    const navigation = decide(path)
    await Promise.resolve()
    expect(request).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    pending.resolve({ data: { session: storedSession }, error: null })
    await navigation
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/nema-pristupa')
    expect(useState('pz-auth-account-role').value).toBe('none')
  })

  it.each(['admin', 'maintainer'] as const)('restores %s access before entering editorial content', async (editorialRole) => {
    role = editorialRole
    await decide('/admin/rijeci')
    expect(navigate).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith('/api/admin/social-session', {
      method: 'POST', headers: { Authorization: 'Bearer restored.google.token' }
    })
  })

  it('shares pending restoration between concurrent guard calls', async () => {
    const pending = Promise.withResolvers<{ data: { session: Session | null }, error: null }>()
    client.auth.getSession.mockReturnValueOnce(pending.promise)
    const first = decide('/admin')
    const second = decide('/admin/rijeci')
    await Promise.resolve()
    expect(client.auth.getSession).toHaveBeenCalledOnce()
    expect(request).not.toHaveBeenCalled()
    pending.resolve({ data: { session: storedSession }, error: null })
    await Promise.all([first, second])
    expect(client.auth.onAuthStateChange).toHaveBeenCalledOnce()
    expect(navigate.mock.calls.map(([path]) => path)).toEqual(['/admin/nema-pristupa', '/admin/nema-pristupa'])
  })

  it('awaits the initial auth event synchronization before deciding the destination', async () => {
    const pendingRole = Promise.withResolvers<{ role: string }>()
    const defaultRequest = request.getMockImplementation()!
    request.mockImplementation((url, options) => url === '/api/account/sync' ? pendingRole.promise : defaultRequest(url, options))
    client.auth.getSession.mockImplementationOnce(async () => {
      client.auth.onAuthStateChange.mock.calls[0]![0]('INITIAL_SESSION', storedSession)
      return { data: { session: storedSession }, error: null }
    })
    const navigation = decide('/admin')
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('/api/account/sync', expect.anything()))
    expect(navigate).not.toHaveBeenCalled()
    expect(request.mock.calls.some(([url]) => url === '/api/admin/session')).toBe(false)
    pendingRole.resolve({ role: 'none' })
    await navigation
    expect(navigate).toHaveBeenCalledWith('/admin/nema-pristupa')
  })

  it('refreshes the cookie on token events after entering admin directly', async () => {
    role = 'maintainer'
    await decide('/admin')
    storedSession = { ...storedSession!, access_token: 'refreshed.google.token' }
    client.auth.onAuthStateChange.mock.calls[0]![0]('TOKEN_REFRESHED', storedSession)
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('/api/admin/social-session', {
      method: 'POST', headers: { Authorization: 'Bearer refreshed.google.token' }
    }))
  })

  it('keeps role-none accounts away from password login when cookie synchronization fails', async () => {
    cookieFailure = true
    await decide('/admin')
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/nema-pristupa')
    expect(useState('pz-auth-session-error').value).toContain('Urednička sesija nije usklađena')
  })

  it('keeps password-only editorial access working', async () => {
    storedSession = null
    passwordSession = true
    await decide('/admin')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('offers password login to signed-out visitors', async () => {
    storedSession = null
    await decide('/admin/rijeci')
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ path: '/admin/prijava', query: { next: '/admin/rijeci' } })
  })

  it('returns a restored editor from login to the requested admin page', async () => {
    role = 'maintainer'
    await decide('/admin/prijava?next=%2Fadmin%2Frijeci')
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/rijeci')
  })
})
