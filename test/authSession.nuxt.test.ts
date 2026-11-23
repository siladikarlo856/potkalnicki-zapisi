import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useNuxtApp, useState } from '#imports'
import { useAuthSession } from '../app/composables/useAuthSession'
import AccountMenu from '../app/components/AccountMenu.vue'
import AuthCallback from '../app/pages/auth/callback.vue'

const { syncRequest, accountSyncRequest, editorialRequest } = vi.hoisted(() => ({
  syncRequest: vi.fn(), accountSyncRequest: vi.fn(), editorialRequest: vi.fn()
}))
mockNuxtImport('$fetch', () => syncRequest)

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1_900_000_000,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'editor@example.com' }
}

function resetAuthState() {
  useNuxtApp().payload.once.delete('pz-auth-session-initialized')
  useState('pz-auth-session').value = null
  useState('pz-auth-account-role').value = null
  useState('pz-auth-session-initialized').value = false
  useState('pz-auth-session-initializing').value = false
  useState('pz-auth-session-error').value = null
  useState('pz-supabase-client').value = null
}

function provideSupabase(client: unknown) {
  useState('pz-supabase-client').value = client
}

function isEditorialSessionRequest(url: unknown) {
  return String(url).includes('/api/admin/social-session')
}

const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')

beforeEach(() => {
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
  accountSyncRequest.mockReset().mockResolvedValue({ role: 'none' })
  editorialRequest.mockReset().mockResolvedValue({ ok: true })
  syncRequest.mockReset().mockImplementation((url: string, options: unknown) => {
    if (isEditorialSessionRequest(url)) return editorialRequest(options)
    return accountSyncRequest()
  })
})

afterEach(async () => {
  await flushPromises()
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
  resetAuthState()
})

const AuthProbe = defineComponent({
  setup: () => useAuthSession(),
  render: () => null
})

async function restoredAuth() {
  let storedSession: typeof session | null = session
  const client = {
    auth: {
      getSession: vi.fn().mockImplementation(async () => ({ data: { session: storedSession }, error: null })),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn().mockImplementation(async () => {
        storedSession = null
        return { error: null }
      }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null })
    }
  }
  provideSupabase(client)
  const probe = await mountSuspended(AuthProbe)
  await vi.waitFor(() => expect(probe.vm.initialized).toBe(true))
  const emit = (event: string, nextSession: typeof session | null) => {
    storedSession = nextSession
    client.auth.onAuthStateChange.mock.calls[0]![0](event, nextSession)
  }
  return { auth: probe.vm, client, emit }
}

describe('account role synchronization', () => {
  it('reports failed cookie restoration after role synchronization', async () => {
    editorialRequest.mockRejectedValue(new Error('cookie replacement failed'))
    const { auth } = await restoredAuth()
    expect(auth.error).toContain('Urednička sesija nije usklađena')
    expect(auth.role).toBe('none')
    expect(accountSyncRequest).toHaveBeenCalledOnce()
  })

  it('keeps cookie replacement failure visible after an account event finishes role synchronization', async () => {
    const { auth, emit } = await restoredAuth()
    editorialRequest.mockRejectedValueOnce(new Error('cookie replacement failed'))
    emit('SIGNED_IN', { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } })
    await vi.waitFor(() => expect(auth.error).toContain('Urednička sesija nije usklađena'))
    await flushPromises()
    expect(auth.error).toContain('Urednička sesija nije usklađena')
    expect(auth.user?.id).toBe('user-2')
  })

  it('returns cookie replacement failures from the callback', async () => {
    const { auth } = await restoredAuth()
    editorialRequest.mockRejectedValueOnce(new Error('cookie replacement failed'))
    expect(await auth.finishCallback('code')).toContain('Urednička sesija nije usklađena')
    expect(auth.error).toContain('Urednička sesija nije usklađena')
  })

  it('reports failed cookie deletion after an account event', async () => {
    const { auth, emit } = await restoredAuth()
    editorialRequest.mockRejectedValue(new Error('cookie deletion failed'))
    emit('SIGNED_OUT', null)
    await vi.waitFor(() => expect(auth.error).toContain('Urednička sesija nije usklađena'))
    expect(auth.user).toBeNull()
  })

  it('reports cookie deletion failure after sign-out without restoring the signed-out account', async () => {
    const { auth, client } = await restoredAuth()
    editorialRequest.mockRejectedValue(new Error('cookie deletion failed'))
    expect(await auth.signOut()).toContain('Urednička sesija nije usklađena')
    expect(auth.error).toContain('Urednička sesija nije usklađena')
    expect(auth.user).toBeNull()
    expect(auth.loading).toBe(false)
    expect(client.auth.signOut).toHaveBeenCalledOnce()
  })

  it('reports failed cookie cleanup for a refused account', async () => {
    const { auth, emit } = await restoredAuth()
    editorialRequest.mockImplementation(async (options: { method: string }) => {
      if (options.method === 'DELETE') throw new Error('cookie deletion failed')
      return { ok: true }
    })
    accountSyncRequest.mockRejectedValueOnce({ statusCode: 403 })
    emit('TOKEN_REFRESHED', { ...session, access_token: 'refused-token' })
    await vi.waitFor(() => expect(auth.error).toContain('Urednička sesija nije usklađena'))
    expect(auth.user).toBeNull()
  })

  it('reports cookie restoration failure after Supabase refuses sign-out', async () => {
    const { auth, client } = await restoredAuth()
    client.auth.signOut.mockResolvedValueOnce({ error: new Error('sign-out failed') })
    editorialRequest.mockRejectedValue(new Error('cookie replacement failed'))
    expect(await auth.signOut()).toContain('Urednička sesija nije usklađena')
    expect(auth.error).toContain('Urednička sesija nije usklađena')
    expect(auth.user?.id).toBe(session.user.id)
  })

  it('does not overwrite a newer account with an obsolete cookie failure', async () => {
    const { auth, emit } = await restoredAuth()
    const pending = Promise.withResolvers<{ ok: true }>()
    editorialRequest.mockReturnValueOnce(pending.promise)
    emit('TOKEN_REFRESHED', { ...session, access_token: 'old-token' })
    await vi.waitFor(() => expect(editorialRequest).toHaveBeenCalledWith(expect.objectContaining({ headers: { Authorization: 'Bearer old-token' } })))
    emit('SIGNED_IN', { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } })
    pending.reject(new Error('obsolete failure'))
    await vi.waitFor(() => expect(auth.role).toBe('none'))
    await flushPromises()
    expect(auth.user?.id).toBe('user-2')
    expect(auth.error).toBeNull()
  })

  it('updates the cookie on an account switch even when role sync fails', async () => {
    accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, emit } = await restoredAuth()
    accountSyncRequest.mockRejectedValueOnce({ statusCode: 500 })
    emit('SIGNED_IN', { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } })
    await vi.waitFor(() => expect(syncRequest).toHaveBeenCalledWith('/api/admin/social-session', {
      method: 'POST', headers: { Authorization: 'Bearer other-token' }
    }))
    expect(auth.user?.id).toBe('user-2')
    expect(auth.role).toBeNull()
  })

  it('clears the cookie when another tab signs out or the session expires', async () => {
    const { auth, emit } = await restoredAuth()
    syncRequest.mockClear()
    emit('SIGNED_OUT', null)
    await vi.waitFor(() => expect(syncRequest).toHaveBeenCalledWith('/api/admin/social-session', { method: 'DELETE' }))
    expect(auth.user).toBeNull()
  })

  it.each([new Error('network unavailable'), { statusCode: 500 }])('preserves a known role when refresh sync fails (%j)', async (failure) => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, emit } = await restoredAuth()
    expect(auth.role).toBe('admin')

    sync.mockRejectedValueOnce(failure)
    emit('TOKEN_REFRESHED', { ...session, access_token: 'refreshed-token' })
    await vi.waitFor(() => expect(auth.error).toContain('Uloga računa trenutačno nije dostupna'))
    expect(auth.role).toBe('admin')
    expect(auth.user?.id).toBe(session.user.id)
  })

  it('shows an unavailable role when the first sync fails', async () => {
    accountSyncRequest.mockRejectedValue(new Error('network unavailable'))
    const { auth } = await restoredAuth()
    expect(auth.role).toBeNull()
    expect(auth.user?.id).toBe(session.user.id)
    const menu = await mountSuspended(AccountMenu)
    expect(menu.find('.sr-only').text()).toContain('nedostupna')
  })

  it.each(['admin', 'refused', 'failed'])('ignores an old account sync resolving as %s after switching accounts', async (outcome) => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, client, emit } = await restoredAuth()
    const oldSync = Promise.withResolvers<{ role: string }>()
    const newSync = Promise.withResolvers<{ role: string }>()
    sync.mockReturnValueOnce(oldSync.promise).mockReturnValueOnce(newSync.promise)

    emit('TOKEN_REFRESHED', { ...session, access_token: 'refreshed-token' })
    const otherSession = { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } }
    emit('SIGNED_IN', otherSession)
    expect(auth.role).toBeNull()
    newSync.resolve({ role: 'none' })
    await vi.waitFor(() => expect(auth.role).toBe('none'))

    if (outcome === 'admin') oldSync.resolve({ role: 'admin' })
    else oldSync.reject({ statusCode: outcome === 'refused' ? 403 : 500 })
    await flushPromises()
    expect(auth.user?.id).toBe('user-2')
    expect(auth.role).toBe('none')
    expect(auth.error).toBeNull()
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })

  it('ignores an obsolete token response for the same account', async () => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, client, emit } = await restoredAuth()
    const oldSync = Promise.withResolvers<{ role: string }>()
    sync.mockReturnValueOnce(oldSync.promise).mockResolvedValueOnce({ role: 'none' })
    emit('TOKEN_REFRESHED', { ...session, access_token: 'older-token' })
    emit('TOKEN_REFRESHED', { ...session, access_token: 'latest-token' })
    await vi.waitFor(() => expect(auth.role).toBe('none'))

    oldSync.reject({ statusCode: 403 })
    await flushPromises()
    expect(auth.role).toBe('none')
    expect(auth.user?.id).toBe(session.user.id)
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })

  it('ignores a pending sync after sign-out', async () => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, emit } = await restoredAuth()
    const pending = Promise.withResolvers<{ role: string }>()
    sync.mockReturnValueOnce(pending.promise)
    emit('TOKEN_REFRESHED', { ...session, access_token: 'refreshed-token' })
    await auth.signOut()
    pending.resolve({ role: 'admin' })
    await flushPromises()
    expect(auth.user).toBeNull()
    expect(auth.role).toBeNull()
  })

  it('preserves the role and reports callback sync failure', async () => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth } = await restoredAuth()
    sync.mockRejectedValueOnce({ statusCode: 500 })
    expect(await auth.finishCallback('code')).toContain('Uloga računa trenutačno nije dostupna')
    expect(auth.role).toBe('admin')
  })

  it('clears the previous role while syncing a different callback account', async () => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, client } = await restoredAuth()
    const otherSession = { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } }
    client.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: otherSession }, error: null })
    const pending = Promise.withResolvers<{ role: string }>()
    sync.mockReturnValueOnce(pending.promise)
    const callback = auth.finishCallback('code')
    await vi.waitFor(() => expect(auth.user?.id).toBe('user-2'))
    expect(auth.role).toBeNull()
    pending.resolve({ role: 'none' })
    expect(await callback).toBeNull()
    expect(auth.role).toBe('none')
  })

  it.each(['returned', 'thrown'])('restores the known role when sign-out has a %s error and resync fails', async (failure) => {
    const sync = accountSyncRequest.mockResolvedValue({ role: 'admin' })
    const { auth, client } = await restoredAuth()
    if (failure === 'returned') client.auth.signOut.mockResolvedValueOnce({ error: new Error('sign-out failed') })
    else client.auth.signOut.mockRejectedValueOnce(new Error('sign-out failed'))
    sync.mockRejectedValueOnce({ statusCode: 500 })
    await auth.signOut()
    expect(auth.user?.id).toBe(session.user.id)
    expect(auth.role).toBe('admin')
    expect(auth.error).toContain('Odjava nije uspjela')
  })

  it('does not restore a signed-out account over a new sign-in', async () => {
    const { auth, client, emit } = await restoredAuth()
    const pending = Promise.withResolvers<{ error: Error | null }>()
    client.auth.signOut.mockReturnValueOnce(pending.promise)
    const signOut = auth.signOut()
    emit('SIGNED_IN', { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } })
    await vi.waitFor(() => expect(auth.role).toBe('none'))
    pending.resolve({ error: new Error('sign-out failed') })
    await signOut
    expect(auth.user?.id).toBe('user-2')
    expect(auth.role).toBe('none')
  })

  it('signs out a refused current account without clearing a later sign-in', async () => {
    const accountSyncResponses = [
      () => Promise.resolve({ role: 'admin' }),
      () => Promise.reject({ statusCode: 403 }),
      () => Promise.resolve({ role: 'none' })
    ]
    accountSyncRequest.mockImplementation(() => {
      const next = accountSyncResponses.shift()
      return next ? next() : Promise.resolve({ role: 'admin' })
    })
    const { auth, client, emit } = await restoredAuth()
    const pendingSignOut = Promise.withResolvers<{ error: null }>()
    client.auth.signOut.mockReturnValueOnce(pendingSignOut.promise)
    emit('TOKEN_REFRESHED', { ...session, access_token: 'refused-token' })
    await vi.waitFor(() => expect(client.auth.signOut).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(auth.user).toBeNull())
    emit('SIGNED_IN', { ...session, access_token: 'other-token', user: { id: 'user-2', email: 'other@example.com' } })
    await vi.waitFor(() => expect(auth.role).toBe('none'))
    pendingSignOut.resolve({ error: null })
    await flushPromises()
    expect(auth.user?.id).toBe('user-2')
    expect(auth.role).toBe('none')
    expect(auth.error).toBeNull()
  })
})

describe('public account menu', () => {
  it('clearly disables sign-in when Supabase is not configured', async () => {
    const menu = await mountSuspended(AccountMenu)

    expect(menu.find('[data-testid="account-sign-in-disabled"]').exists()).toBe(true)
    expect(menu.find('[data-testid="account-sign-in"]').exists()).toBe(false)
  })

  it('shows a role-less signed-in account after the session is restored', async () => {
    const onAuthStateChange = vi.fn()
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        onAuthStateChange,
        signOut: vi.fn().mockResolvedValue({ error: null }),
        signInWithOAuth: vi.fn()
      }
    }
    provideSupabase(client)

    const menu = await mountSuspended(AccountMenu, { route: '/igraj/' })
    await vi.waitFor(() => expect(menu.find('.sr-only').text()).toContain('none'))

    expect(menu.find('button[aria-label="Račun"]').exists()).toBe(true)
    expect(menu.text()).toContain('editor@example.com')
    expect(onAuthStateChange).toHaveBeenCalledOnce()
  })

  it('starts Google OAuth with an app-derived callback and signs out', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null })
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(),
        signOut,
        signInWithOAuth
      }
    }
    provideSupabase(client)

    const probe = await mountSuspended(AuthProbe, { route: '/bastina/' })
    const auth = (probe as { vm: ReturnType<typeof useAuthSession> }).vm
    await vi.waitFor(() => expect(auth.configured).toBe(true))
    await auth.signIn('/bastina/')
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback/') }
    })

    useState('pz-auth-session').value = session
    const signedIn = await mountSuspended(AccountMenu, { route: '/bastina/' })
    await nextTick()
    await signedIn.find('button[aria-label="Račun"]').trigger('click')
    const logout = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(item => item.textContent?.includes('Odjava'))
    expect(logout).toBeTruthy()
    await (logout as HTMLElement).click()
    await flushPromises()
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('keeps the public site usable with plain-language callback and expiry errors', async () => {
    provideSupabase({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('refresh token expired') }),
        onAuthStateChange: vi.fn(),
        signOut: vi.fn(),
        signInWithOAuth: vi.fn()
      }
    })
    const menu = await mountSuspended(AccountMenu)
    await vi.waitFor(() => expect(menu.find('[data-testid="account-auth-error"]').exists()).toBe(true))
    expect(menu.find('[data-testid="account-auth-error"]').text()).toContain('Sesija je istekla')

    resetAuthState()
    provideSupabase({
      auth: {
        exchangeCodeForSession: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn()
      }
    })
    const callback = await mountSuspended(AuthCallback, { route: '/auth/callback/?error=access_denied' })
    await vi.waitFor(() => expect(callback.find('[data-testid="auth-callback-error"]').exists()).toBe(true))
    expect(callback.text()).toContain('Prijava je otkazana')
    expect(callback.text()).toContain('Natrag na početnu')
  })
})
