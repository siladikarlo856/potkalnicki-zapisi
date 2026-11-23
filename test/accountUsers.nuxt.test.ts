import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp, UPagination } from '#components'
import Users from '../app/pages/admin/korisnici.vue'
import type { AccountAdminList } from '../shared/types/accounts'

mockNuxtImport('useAdminConfirm', () => () => async () => true)

let accountsTotal = 26
let pendingTotal = 26
let role: 'none' | 'maintainer' = 'none'

registerEndpoint('/api/admin/session', () => ({ authenticated: true, userManagement: true }))
registerEndpoint('/api/admin/accounts/audit', () => ({ rows: [] }))
registerEndpoint('/api/admin/accounts', (event) => {
  const url = new URL((event as { path: string }).path, 'http://localhost')
  const page = Number(url.searchParams.get('page') ?? 1)
  const pendingPage = Number(url.searchParams.get('pendingPage') ?? 1)
  return {
    accounts: page <= Math.ceil(accountsTotal / 25) ? [{ id: `account-${page}`, email: `account-page-${page}@test.hr`, role, createdAt: '2026-01-01' }] : [],
    pending: pendingPage <= Math.ceil(pendingTotal / 25) ? [{ id: `pending-${pendingPage}`, email: `pending-page-${pendingPage}@test.hr`, status: 'pending', grantedRole: 'maintainer', createdAt: '2026-01-01', createdBy: null, matchedAccountId: null, matchedAt: null }] : [],
    accountsTotal, pendingTotal, page, pendingPage, size: 25
  } satisfies AccountAdminList
})

function shrinkPending() {
  pendingTotal = 25
  return { ok: true }
}
registerEndpoint('/api/admin/accounts/pending/pending-2', { method: 'DELETE', handler: shrinkPending })
registerEndpoint('/api/admin/accounts/account-2/promote', { method: 'POST', handler: shrinkPending })
registerEndpoint('/api/admin/accounts/account-2/revoke', { method: 'POST', handler: shrinkPending })

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
  accountsTotal = 26
  pendingTotal = 26
  role = 'none'
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData(['admin-accounts', 'admin-accounts-audit'])
  await useRouter().replace({ path: '/', query: {} })
})

function mountUsers(route = '/admin/korisnici') {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(Users) }) }, {
    attachTo: document.body, route
  })
}

describe('Korisnici pagination', () => {
  it('keeps independent page selections and resets both when search changes', async () => {
    wrapper = await mountUsers()
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="account-table"]').text()).toContain('account-page-1@test.hr'))
    wrapper.findAllComponents(UPagination)[0]!.vm.$emit('update:page', 2)
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="account-table"]').text()).toContain('account-page-2@test.hr'))
    expect(useRouter().currentRoute.value.query.page).toBe('2')
    wrapper.findAllComponents(UPagination)[1]!.vm.$emit('update:page', 2)
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="account-pending-table"]').text()).toContain('pending-page-2@test.hr'))
    expect(useRouter().currentRoute.value.query).toMatchObject({ page: '2', pendingPage: '2' })
    await wrapper.find('[data-testid="account-search"]').setValue('anna_smith')
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({ q: 'anna_smith' }))
    await vi.waitFor(() => {
      expect(wrapper!.find('[data-testid="account-table"]').text()).toContain('account-page-1@test.hr')
      expect(wrapper!.find('[data-testid="account-pending-table"]').text()).toContain('pending-page-1@test.hr')
    })
  })

  it.each(['cancel', 'promote', 'revoke'] as const)('returns to a reachable page after %s shrinks the pending list', async (action) => {
    if (action === 'revoke') role = 'maintainer'
    wrapper = await mountUsers('/admin/korisnici?page=2&pendingPage=2')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="account-table"]').text()).toContain('account-page-2@test.hr'))
    const button = action === 'cancel' ? 'account-cancel-pending-2' : `account-${action}-account-2`
    await wrapper.find(`[data-testid="${button}"]`).trigger('click')
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({ page: '2' }))
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="account-pending-table"]').text()).toContain('pending-page-1@test.hr'))
    expect(wrapper.find('[data-testid="account-pending-pagination"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="account-table"]').text()).toContain('account-page-2@test.hr')
  })

  it('clamps both pages when an external refresh removes all rows', async () => {
    wrapper = await mountUsers('/admin/korisnici?page=2&pendingPage=2')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="account-table"]').text()).toContain('account-page-2@test.hr'))
    accountsTotal = 0
    pendingTotal = 0
    await refreshNuxtData('admin-accounts')
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({}))
    await vi.waitFor(() => {
      expect(wrapper!.find('[data-testid="account-table"]').text()).not.toContain('@test.hr')
      expect(wrapper!.find('[data-testid="account-pending-table"]').text()).not.toContain('@test.hr')
    })
  })
})
