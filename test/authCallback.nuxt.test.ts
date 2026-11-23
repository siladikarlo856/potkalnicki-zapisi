import { expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState, useNuxtApp, useRuntimeConfig, useState } from '#imports'
import type { SupabaseClient } from '@supabase/supabase-js'
import supabasePlugin from '../app/plugins/supabase.client'
import AuthCallback from '../app/pages/auth/callback.vue'

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

registerEndpoint('/api/account/sync', () => ({ role: 'none' }))
registerEndpoint('/api/admin/social-session', { method: 'POST', handler: () => ({ ok: true, role: 'none' }) })

it('exchanges a PKCE callback once and returns the signed-in visitor to account settings', async () => {
  const config = useRuntimeConfig()
  const previousConfig = config.public.supabase
  const previousUrl = window.location.href
  const storageKey = 'sb-pkce-regression-auth-token'
  const callbackUrl = '/auth/callback/?code=issued-code&next=%2Fracun%2F'
  const tokenRequest = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'user-1', email: 'editor@example.com' }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  const originalFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith('https://pkce-regression.supabase.co/auth/v1/')) {
      return tokenRequest(input, init)
    }
    return originalFetch(input, init)
  })

  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
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
  let client: SupabaseClient | null = null
  let callback: Awaited<ReturnType<typeof mountSuspended>> | undefined
  try {
    clearNuxtState(key => key.startsWith('pz-auth-') || key === 'pz-supabase-client')
    useNuxtApp().payload.once.delete('pz-auth-session-initialized')
    config.public.supabase = { url: 'https://pkce-regression.supabase.co', anonKey: 'test-anon-key' }
    window.history.replaceState(null, '', callbackUrl)
    localStorage.setItem(`${storageKey}-code-verifier`, JSON.stringify('test-code-verifier'))
    await useNuxtApp().runWithContext(() => supabasePlugin(useNuxtApp()))
    client = useState<SupabaseClient | null>('pz-supabase-client').value

    callback = await mountSuspended(AuthCallback, { route: callbackUrl })

    await vi.waitFor(() => expect(
      navigateToMock.mock.calls.length > 0 || callback?.find('[data-testid="auth-callback-error"]').exists()
    ).toBe(true))
    expect(useState('pz-auth-session').value).toMatchObject({ user: { email: 'editor@example.com' } })
    expect(callback.find('[data-testid="auth-callback-error"]').exists()).toBe(false)
    expect(navigateToMock).toHaveBeenCalledWith('/racun/', { replace: true })
    expect(tokenRequest).toHaveBeenCalledOnce()
    expect(tokenRequest.mock.calls[0]?.[0]).toBe('https://pkce-regression.supabase.co/auth/v1/token?grant_type=pkce')
    expect(JSON.parse(tokenRequest.mock.calls[0]?.[1].body)).toEqual({
      auth_code: 'issued-code', code_verifier: 'test-code-verifier'
    })
  } finally {
    await tail
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
    else Reflect.deleteProperty(navigator, 'locks')
    callback?.unmount()
    await client?.auth.stopAutoRefresh()
    localStorage.removeItem(storageKey)
    localStorage.removeItem(`${storageKey}-code-verifier`)
    config.public.supabase = previousConfig
    window.history.replaceState(null, '', previousUrl)
    clearNuxtState(key => key.startsWith('pz-auth-') || key === 'pz-supabase-client')
    useNuxtApp().payload.once.delete('pz-auth-session-initialized')
    vi.unstubAllGlobals()
    navigateToMock.mockClear()
  }
})
