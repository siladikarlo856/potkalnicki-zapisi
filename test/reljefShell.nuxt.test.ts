import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import BottomNav from '../app/components/BottomNav.vue'
import AppHeader from '../app/components/AppHeader.vue'
import RoundBar from '../app/components/RoundBar.vue'

describe('Reljef public shell', () => {
  it('renders five bottom destinations and marks Arhiv as current', async () => {
    const wrapper = await mountSuspended(BottomNav, { route: '/bastina/' })
    const nav = wrapper.find('nav[aria-label="Glavna navigacija"]')
    expect(nav.findAll('a').map(link => link.text())).toEqual(['Početna', 'Arhiv', 'Traži', 'Igraj', 'Doprinesi'])
    expect(nav.find('a[aria-current="page"]').text()).toBe('Arhiv')
  })

  it('shows all nine section links in the desktop header', async () => {
    const wrapper = await mountSuspended(AppHeader, { route: '/bastina/' })
    const links = wrapper.findAll('header a').map(link => link.text()).filter(Boolean)
    expect(links).toEqual(expect.arrayContaining(['Mjesta', 'Baština', 'Priče i običaji', 'Osobe', 'Govor', 'Riječ dana', 'Uči', 'Igre', 'Izazovi']))
    expect(wrapper.find('a[aria-current="page"]').text()).toBe('Baština')
  })

  it('asks before leaving a round and uses the exact Croatian confirmation copy', async () => {
    const wrapper = await mountSuspended(RoundBar, { props: { title: 'Kviz', current: 3, total: 10 } })
    await wrapper.find('button[aria-label="Izađi iz igre"]').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('Želiš li prekinuti igru?')
    expect(document.body.textContent).toContain('Napredak u ovoj igri neće se spremiti.')
    expect(document.body.textContent).toContain('Nastavi igru')
    expect(document.body.textContent).toContain('Prekini')
  })
})
