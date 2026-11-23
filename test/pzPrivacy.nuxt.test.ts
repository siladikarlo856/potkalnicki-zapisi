import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Privacy from '../app/pages/privatnost.vue'

describe('privacy page', () => {
  it('explains device storage and confirms clearing it', async () => {
    localStorage.setItem('pz-learn/v1', '{"version":1}')
    const page = await mountSuspended(Privacy, { route: '/privatnost' })

    expect(page.text()).toContain('Javne stranice možeš koristiti bez računa')
    expect(page.text()).toContain('Što ostaje na tvom uređaju')

    await page.findAll('button').find(button => button.text() === 'Obriši podatke s ovog uređaja')!.trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Želiš li obrisati podatke s ovog uređaja?'))

    const destructive = [...document.body.querySelectorAll('button')].find(button => button.textContent === 'Obriši podatke')
    expect(destructive).toBeDefined()
    destructive!.click()

    expect(localStorage.getItem('pz-learn/v1')).toBeNull()
  })
})
