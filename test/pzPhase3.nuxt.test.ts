import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Explore from '../app/pages/mjesta/index.vue'
import Municipality from '../app/pages/mjesta/[opcina]/index.vue'
import Settlement from '../app/pages/mjesta/[opcina]/[naselje].vue'
import HeritageList from '../app/pages/bastina/index.vue'
import HeritageItem from '../app/pages/bastina/[naselje]/[slug].vue'
import { heritageItemByRoute } from './helpers/atlasFixtures'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

describe('Potkalnički zapisi phase 3 atlas routes', () => {
  it('renders the explore hub with five municipalities', async () => {
    const page = await mountSuspended(Explore, { route: '/mjesta/' })
    expect(page.find('[data-testid="municipality-list"]').exists()).toBe(true)
    expect(page.findAll('li').length).toBe(5)
  })

  it('opens the explore hub with four equal entries: places, Baština, Priče i običaji, Naš govor', async () => {
    const page = await mountSuspended(Explore, { route: '/mjesta/' })
    const entries = page.findAll('[data-testid="explore-entries"] a')
    expect(entries.map(entry => entry.find('b').text())).toEqual(['Mjesta', 'Baština', 'Priče i običaji', 'Naš govor'])
    expect(entries.map(entry => entry.attributes('href'))).toEqual([
      '/mjesta/#opcine',
      '/bastina/',
      '/price-i-obicaji/',
      '/govor/'
    ])
  })

  it('renders a municipality settlement list', async () => {
    const page = await mountSuspended(Municipality, {
      route: { path: '/mjesta/opcina-kalnik/', params: { opcina: 'opcina-kalnik' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="settlement-list"]').exists()).toBe(true))
    expect(page.text()).toContain('Kalnik')
  })

  it('renders a settlement heritage list', async () => {
    const page = await mountSuspended(Settlement, {
      route: { path: '/mjesta/opcina-kalnik/kalnik/', params: { opcina: 'opcina-kalnik', naselje: 'kalnik' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="settlement-heritage-list"]').exists()).toBe(true))
    expect(page.text()).toContain('Crkva sv. Brcka')
  })

  it('renders heritage list filters', async () => {
    const page = await mountSuspended(HeritageList, { route: '/bastina' })
    expect(page.find('[data-testid="heritage-list"]').exists()).toBe(true)
    expect(page.find('[data-testid="heritage-filter-municipality"]').exists()).toBe(true)
  })

  it('renders an item page with verification badge and research notes', async () => {
    const item = heritageItemByRoute('kalnik', 'crkva-sv-brcka')
    expect(item).toBeDefined()
    const page = await mountSuspended(HeritageItem, {
      route: { path: '/bastina/kalnik/crkva-sv-brcka', params: { naselje: 'kalnik', slug: 'crkva-sv-brcka' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="heritage-item-page"]').exists()).toBe(true))
    expect(page.find('[data-testid="verification-badge-unverified"]').exists()).toBe(true)
    expect(page.text()).toContain('Što još provjeravamo')
    expect(page.text()).toContain(item!.researchNotes.slice(0, 20))
  })
})
