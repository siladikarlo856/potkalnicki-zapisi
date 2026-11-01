import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Explore from '../app/pages/potkalnicko-prigorje/istrazi/index.vue'
import Municipality from '../app/pages/potkalnicko-prigorje/istrazi/[opcina].vue'
import Settlement from '../app/pages/potkalnicko-prigorje/naselja/[naselje].vue'
import HeritageList from '../app/pages/potkalnicko-prigorje/bastina/index.vue'
import HeritageItem from '../app/pages/potkalnicko-prigorje/bastina/[naselje]/[slug].vue'
import { heritageItemByRoute } from '../shared/utils/atlasData'

describe('Potkalnički zapisi phase 3 atlas routes', () => {
  it('renders the explore hub with five municipalities', async () => {
    const page = await mountSuspended(Explore, { route: '/potkalnicko-prigorje/istrazi' })
    expect(page.find('[data-testid="municipality-list"]').exists()).toBe(true)
    expect(page.findAll('li').length).toBe(5)
  })

  it('renders a municipality settlement list', async () => {
    const page = await mountSuspended(Municipality, { route: '/potkalnicko-prigorje/istrazi/opcina-kalnik' })
    expect(page.find('[data-testid="settlement-list"]').exists()).toBe(true)
    expect(page.text()).toContain('Kalnik')
  })

  it('renders a settlement heritage list', async () => {
    const page = await mountSuspended(Settlement, { route: '/potkalnicko-prigorje/naselja/kalnik' })
    expect(page.find('[data-testid="settlement-heritage-list"]').exists()).toBe(true)
    expect(page.text()).toContain('Crkva sv. Brcka')
  })

  it('renders heritage list filters', async () => {
    const page = await mountSuspended(HeritageList, { route: '/potkalnicko-prigorje/bastina' })
    expect(page.find('[data-testid="heritage-list"]').exists()).toBe(true)
    expect(page.find('[data-testid="heritage-filter-municipality"]').exists()).toBe(true)
  })

  it('renders an item page with verification badge and research notes', async () => {
    const item = heritageItemByRoute('kalnik', 'crkva-sv-brcka')
    expect(item).toBeDefined()
    const page = await mountSuspended(HeritageItem, { route: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka' })
    expect(page.find('[data-testid="heritage-item-page"]').exists()).toBe(true)
    expect(page.find('[data-testid="heritage-status-unverified"]').exists()).toBe(true)
    expect(page.text()).toContain('Što još provjeravamo')
    expect(page.text()).toContain(item!.researchNotes.slice(0, 20))
  })
})
