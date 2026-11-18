import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PersonsIndex from '../app/pages/osobe/index.vue'
import PersonPage from '../app/pages/osobe/[slug].vue'
import Settlement from '../app/pages/mjesta/[opcina]/[naselje].vue'
import Municipality from '../app/pages/mjesta/[opcina]/index.vue'
import HeritageItem from '../app/pages/bastina/[naselje]/[slug].vue'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

describe('Potkalnički zapisi person pages', () => {
  it('lists persons with years, role and place, and offers a proposal', async () => {
    const page = await mountSuspended(PersonsIndex, { route: '/osobe' })
    await vi.waitFor(() => expect(page.find('[data-testid="persons-list"]').exists()).toBe(true))
    const list = page.get('[data-testid="persons-list"]').text()
    expect(list).toContain('Ivan Kalničan')
    expect(list).toContain('1813–1849')
    expect(list).toContain('kapelan i pjesnik')
    expect(list).not.toContain('Stara Osoba')
    expect(page.find('[data-testid="persons-filter"]').exists()).toBe(true)
    expect(page.get('[data-testid="persons-suggest"]').text()).toContain('Predloži osobu')
    expect(page.text()).toContain('Zapisujemo samo preminule i povijesne osobe.')
    // WP19 adds these; they stay hidden until the person card and "Tko je to?" exist (≥4 seeded persons).
    expect(page.text()).not.toContain('Uči osobe')
    expect(page.text()).not.toContain('Tko je to?')
  })

  it('renders a person page: eyebrow, places by role, heritage, open points and sources', async () => {
    const page = await mountSuspended(PersonPage, {
      route: { path: '/osobe/ivan-kalnican', params: { slug: 'ivan-kalnican' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="person-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="person-eyebrow"]').text()).toBe('Osoba · Kalnik')
    expect(page.find('[data-testid="verification-badge-unverified"]').exists()).toBe(true)
    expect(page.get('[data-testid="person-life"]').text()).toContain('14. 1. 1813., Edde (HU)')
    expect(page.get('[data-testid="person-bio"]').text()).toBe('Kratka biografija.')
    const places = page.get('[data-testid="person-places"]')
    expect(places.text()).toContain('Rođen/a')
    expect(places.text()).toContain('Umro/la')
    expect(places.find('a[href="/mjesta/opcina-kalnik/kalnik/"]').exists()).toBe(true)
    expect(page.get('[data-testid="person-heritage"]').text()).toContain('kapela mu je posvećena')
    expect(page.get('[data-testid="person-open-questions"]').text()).toContain('1849. ili 1850.')
    expect(page.get('[data-testid="person-sources"]').text()).toContain('Registar kulturnih dobara')
    expect(page.get('[data-testid="person-suggest-correction"]').text()).toContain('Predloži ispravak')
    expect(page.get('[data-testid="person-suggest-source"]').text()).toContain('Dodaj izvor')
  })

  it('lists persons on the settlement, unit and heritage item pages', async () => {
    const settlement = await mountSuspended(Settlement, {
      route: { path: '/mjesta/opcina-kalnik/kalnik/', params: { opcina: 'opcina-kalnik', naselje: 'kalnik' } }
    })
    await vi.waitFor(() => expect(settlement.find('[data-testid="settlement-persons"]').exists()).toBe(true))
    expect(settlement.text()).toContain('Osobe iz ovog mjesta')
    expect(settlement.get('[data-testid="settlement-persons"]').text()).toContain('Ivan Kalničan')

    const unit = await mountSuspended(Municipality, {
      route: { path: '/mjesta/opcina-kalnik/', params: { opcina: 'opcina-kalnik' } }
    })
    await vi.waitFor(() => expect(unit.find('[data-testid="municipality-persons"]').exists()).toBe(true))
    expect(unit.get('[data-testid="municipality-persons"]').text()).toContain('Ivan Kalničan')

    const item = await mountSuspended(HeritageItem, {
      route: { path: '/bastina/kalnik/crkva-sv-brcka', params: { naselje: 'kalnik', slug: 'crkva-sv-brcka' } }
    })
    await vi.waitFor(() => expect(item.find('[data-testid="heritage-persons"]').exists()).toBe(true))
    expect(item.text()).toContain('Povezane osobe')
    expect(item.get('[data-testid="heritage-persons"]').text()).toContain('Ivan Kalničan')
  })

  it('hides the person section on a place without persons', async () => {
    const unit = await mountSuspended(Municipality, {
      route: { path: '/mjesta/opcina-gornja-rijeka/', params: { opcina: 'opcina-gornja-rijeka' } }
    })
    await vi.waitFor(() => expect(unit.find('[data-testid="settlement-list"]').exists()).toBe(true))
    expect(unit.find('[data-testid="municipality-persons"]').exists()).toBe(false)
  })
})
