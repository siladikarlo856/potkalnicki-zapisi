import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import AdminNoAccess from '../app/pages/admin/nema-pristupa.vue'

registerEndpoint('/api/admin/session', () => ({ authenticated: false, accountSignedIn: true, role: 'none' }))

function mountInApp(component: unknown, route: string) {
  return mountSuspended({ setup: () => () => h(UApp, null, { default: () => h(component as never) }) }, { attachTo: document.body, route })
}

describe('admin no-access page', () => {
  it('explains missing editorial role in Croatian', async () => {
    const wrapper = await mountInApp(AdminNoAccess, '/admin/nema-pristupa')
    expect(wrapper.text()).toContain('Nema pristupa uređivanju')
    expect(wrapper.text()).toContain('nema uredničku ulogu')
    expect(wrapper.find('[data-testid="admin-no-access-alert"]').exists()).toBe(true)
  })
})
