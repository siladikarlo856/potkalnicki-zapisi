import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useState } from '#imports'
import MainPlacePage from '../app/pages/racun/glavno-mjesto.vue'
import AccountSettings from '../app/pages/racun/index.vue'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

function signedIn() {
  useState('pz-auth-session').value = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: 1_900_000_000,
    token_type: 'bearer',
    user: { id: 'user-1', email: 'igrač@example.com' }
  }
  useState('pz-auth-account-role').value = 'none'
  useState('pz-auth-session-initialized').value = true
  useState('pz-supabase-client').value = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: useState('pz-auth-session').value }, error: null }),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn()
    }
  }
  fetchMock.mockImplementation((url: string) => {
    if (url === '/api/account/sync') return Promise.resolve({ role: 'none' })
    if (url === '/api/admin/social-session') return Promise.resolve({ ok: true, role: 'none' })
    return Promise.reject(new Error(url))
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  useState('pz-auth-session').value = null
  useState('pz-auth-account-role').value = null
  useState('pz-supabase-client').value = null
  useState('pz-account-main-place').value = null
  useState('pz-account-main-place-error').value = null
  useState('pz-account-main-place-loading').value = false
})

describe('Glavno mjesto account UI', () => {
  it('links to Glavno mjesto from account settings', async () => {
    signedIn()
    const wrapper = await mountSuspended(AccountSettings, { route: '/racun/' })
    expect(wrapper.get('[data-testid="account-settings-main-place"]').attributes('href')).toContain('/racun/glavno-mjesto/')
    wrapper.unmount()
  })

  it('loads the preference when signed in', async () => {
    signedIn()
    const place = { id: 'c9731a87-1dee-807a-94ed-83d47b96fad2', name: 'Apatovec', municipality: 'Grad Križevci', county: 'KKŽ' }
    fetchMock.mockResolvedValueOnce({ mainPlaceId: place.id, place, archivedNote: null })

    const wrapper = await mountSuspended(MainPlacePage, { route: '/racun/glavno-mjesto/' })
    await vi.waitFor(() => expect(wrapper.find('[data-testid="main-place-settings"]').exists()).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('/api/account/main-place', expect.objectContaining({ method: 'GET' }))
    expect(wrapper.get('[data-testid="main-place-clear"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows signed-out state without calling the API', async () => {
    useState('pz-supabase-client').value = { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() } }
    const wrapper = await mountSuspended(MainPlacePage, { route: '/racun/glavno-mjesto/' })
    expect(wrapper.find('[data-testid="main-place-signed-out"]').exists()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
