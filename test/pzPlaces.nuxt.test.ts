import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PzAreaMap from '../app/components/pz/PzAreaMap.vue'
import PzPlaceExplorer from '../app/components/pz/PzPlaceExplorer.vue'
import Explore from '../app/pages/mjesta/index.vue'
import Municipality from '../app/pages/mjesta/[opcina]/index.vue'
import HeritageList from '../app/pages/bastina/index.vue'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'
import type { AtlasHeritageListResponse } from '../shared/types/publicAtlas'

registerAtlasApiEndpoints()

const areas = [
  { slug: 'grad-krizevci', name: 'Križevci', to: '/mjesta/grad-krizevci/' },
  { slug: 'opcina-gornja-rijeka', name: 'Gornja Rijeka', to: '/mjesta/opcina-gornja-rijeka/' },
  { slug: 'opcina-kalnik', name: 'Kalnik', to: '/mjesta/opcina-kalnik/' },
  { slug: 'opcina-sveti-ivan-zabno', name: 'Sveti Ivan Žabno', to: '/mjesta/opcina-sveti-ivan-zabno/' },
  { slug: 'opcina-sveti-petar-orehovec', name: 'Sveti Petar Orehovec', to: '/mjesta/opcina-sveti-petar-orehovec/' }
]

const viewWidth = (map: Awaited<ReturnType<typeof mountSuspended>>) => Number(map.find('svg').attributes('viewBox')!.split(' ')[2])

describe('PzAreaMap', () => {
  it('draws all five areas from their real boundaries as one named image, names them and credits OpenStreetMap', async () => {
    const map = await mountSuspended(PzAreaMap, { props: { areas, label: 'Karta područja' } })
    expect(map.findAll('path[data-area]').map(path => path.attributes('data-area')).sort()).toEqual(areas.map(area => area.slug).sort())
    expect(map.find('svg').attributes('role')).toBe('img')
    expect(map.find('svg').attributes('aria-label')).toBe('Karta područja')
    expect(map.findAll('[data-area-name]').map(name => name.text()).sort()).toEqual(areas.map(area => area.name).sort())
    expect(map.find('[data-testid="area-map-credit"]').attributes('href')).toBe('https://www.openstreetmap.org/copyright')
  })

  it('leaves out an area it has no boundary for', async () => {
    const map = await mountSuspended(PzAreaMap, { props: { areas: [...areas, { slug: 'opcina-nepoznata', name: 'Nepoznata' }], label: 'Karta' } })
    expect(map.findAll('path[data-area]').length).toBe(5)
    expect(map.text()).not.toContain('Nepoznata')
  })

  it('zooms to the selected area, dims the others and draws its outline last', async () => {
    const whole = await mountSuspended(PzAreaMap, { props: { areas, label: 'Karta' } })
    const zoomed = await mountSuspended(PzAreaMap, { props: { areas, selected: 'opcina-kalnik', label: 'Karta' } })
    expect(viewWidth(zoomed)).toBeLessThan(viewWidth(whole) / 2)
    expect(zoomed.attributes('data-selected')).toBe('opcina-kalnik')
    const paths = zoomed.findAll('path[data-area]')
    expect(paths.at(-1)!.attributes('data-area')).toBe('opcina-kalnik')
    expect(paths.filter(path => path.attributes('opacity') === '0.5').length).toBe(4)
    // The page title names the selected area; the map names only its neighbours.
    expect(zoomed.find('[data-area-name="opcina-kalnik"]').exists()).toBe(false)
    expect(zoomed.find('[data-area-name="grad-krizevci"]').exists()).toBe(true)
  })

  it('reports the area and the point under the pointer, and names the active point', async () => {
    const points = [{ id: 'kalnik', lat: 46.12833, lng: 16.4625, name: 'Kalnik' }]
    const map = await mountSuspended(PzAreaMap, { props: { areas, points, label: 'Karta' } })
    await map.find('path[data-area="opcina-kalnik"]').trigger('pointerenter')
    await map.find('[data-point="kalnik"]').trigger('pointerenter')
    expect(map.emitted('hover')).toEqual([['opcina-kalnik'], ['kalnik']])
    expect(map.find('[data-point="kalnik"]').text()).toBe('')
    await map.setProps({ active: 'kalnik' })
    expect(map.find('[data-point="kalnik"]').text()).toBe('Kalnik')
  })
})

describe('PzPlaceExplorer', () => {
  const cards = [
    { id: 'kalnik-unit', title: 'Općina Kalnik', meta: '8 naselja · 6 zapisa', to: '/mjesta/opcina-kalnik/', area: 'opcina-kalnik' },
    { id: 'sopron', title: 'Šopron', meta: 'još bez zapisa', to: '/mjesta/opcina-kalnik/sopron/', area: 'opcina-kalnik', point: { lat: 46.12059, lng: 16.46437 }, quiet: true }
  ]
  const props = { areas, cards, mapLabel: 'Karta', searchLabel: 'Nađi naselje ili općinu', listLabel: 'Općine i naselja' }

  it('lists every card as one link, an area card with its swatch and a settlement with a point on the map', async () => {
    const explorer = await mountSuspended(PzPlaceExplorer, { props })
    const links = explorer.findAll('[data-testid="place-cards"] li a')
    expect(links.map(link => [link.attributes('href'), link.find('b').text()])).toEqual([
      ['/mjesta/opcina-kalnik/', 'Općina Kalnik'],
      ['/mjesta/opcina-kalnik/sopron/', 'Šopron']
    ])
    expect(explorer.find('[data-testid="place-cards"]').attributes('aria-label')).toBe('Općine i naselja')
    expect(explorer.findAll('[data-point]').map(point => point.attributes('data-point'))).toEqual(['sopron'])
    expect(explorer.find('[data-card="sopron"] small').classes()).toContain('text-dimmed')
  })

  it('pairs the views: a card under the pointer or focus outlines its area, an area or point under the pointer marks its card', async () => {
    const explorer = await mountSuspended(PzPlaceExplorer, { props })
    const unitCard = () => explorer.find('[data-card="kalnik-unit"] a')
    const area = () => explorer.find('path[data-area="opcina-kalnik"]')

    await unitCard().trigger('pointerenter')
    expect(area().attributes('stroke-width')).toBe('3.5')
    await unitCard().trigger('pointerleave')
    expect(area().attributes('stroke-width')).toBe('1.25')

    await unitCard().trigger('focus')
    expect(area().attributes('stroke-width')).toBe('3.5')
    await unitCard().trigger('blur')

    await area().trigger('pointerenter')
    expect(unitCard().attributes('data-marked')).toBe('true')
    await explorer.find('[data-point="sopron"]').trigger('pointerenter')
    expect(explorer.find('[data-card="sopron"] a').attributes('data-marked')).toBe('true')
    expect(unitCard().attributes('data-marked')).toBeUndefined()
  })

  it('on a phone lists the first cards of a long list and a button that shows the rest and focuses the first of them', async () => {
    const explorer = await mountSuspended(PzPlaceExplorer, { props: { ...props, collapseAfter: 1, showAllLabel: 'Prikaži sva naselja (2)' }, attachTo: document.body })
    expect(explorer.find('[data-card="kalnik-unit"]').classes()).not.toContain('max-lg:hidden')
    expect(explorer.find('[data-card="sopron"]').classes()).toContain('max-lg:hidden')
    const button = explorer.find('[data-testid="place-cards-show-all"]')
    expect(button.text()).toBe('Prikaži sva naselja (2)')
    expect(button.classes()).toContain('lg:hidden')
    await button.trigger('click')
    await vi.waitFor(() => expect(document.activeElement).toBe(explorer.find('[data-card="sopron"] a').element))
    expect(explorer.find('[data-card="sopron"]').classes()).not.toContain('max-lg:hidden')
    expect(explorer.find('[data-testid="place-cards-show-all"]').exists()).toBe(false)
    explorer.unmount()
  })

  it('lists every match while searching, however long the list', async () => {
    const explorer = await mountSuspended(PzPlaceExplorer, { props: { ...props, collapseAfter: 1, showAllLabel: 'Prikaži sve', query: 'o' } })
    expect(explorer.find('[data-card="sopron"]').classes()).not.toContain('max-lg:hidden')
    expect(explorer.find('[data-testid="place-cards-show-all"]').exists()).toBe(false)
  })

  it('says the empty text, or the loading text while results are on their way', async () => {
    const empty = await mountSuspended(PzPlaceExplorer, { props: { ...props, cards: [], emptyText: 'Nema naselja „xyz”.' } })
    expect(empty.find('[data-testid="place-cards-empty"]').text()).toBe('Nema naselja „xyz”.')
    const loading = await mountSuspended(PzPlaceExplorer, { props: { ...props, cards: [], loading: true, loadingText: 'Učitavam naselja…' } })
    expect(loading.find('[data-testid="place-cards-loading"]').text()).toBe('Učitavam naselja…')
    expect(loading.find('[data-testid="place-cards-empty"]').exists()).toBe(false)
  })
})

describe('Mjesta', () => {
  it('shows the map beside the municipality cards, without a Karta/Popis switch', async () => {
    const page = await mountSuspended(Explore, { route: '/mjesta/' })
    expect(page.findAll('[data-testid="area-map"]').length).toBe(1)
    expect(page.find('[aria-label="Prikaz mjesta"]').exists()).toBe(false)
    expect(page.findAll('[data-testid="municipality-list"] li').length).toBe(5)
    expect(page.find('[data-testid="municipality-list"]').text()).toContain('naselja')
  })

  it('searches units and settlements across the region and puts the matching settlements on the map', async () => {
    const page = await mountSuspended(Explore, { route: '/mjesta/' })
    await page.find('[data-testid="search-field"] input').setValue('kalnik')
    await vi.waitFor(() => expect(page.findAll('[data-testid="municipality-list"] li').length).toBeGreaterThan(1))
    const titles = page.findAll('[data-testid="municipality-list"] li b').map(title => title.text())
    expect(titles[0]).toBe('Općina Kalnik')
    expect(titles).toContain('Kalnik')
    const settlement = page.findAll('[data-testid="municipality-list"] li').find(li => li.find('b').text() === 'Kalnik')!
    expect(settlement.find('a').attributes('href')).toBe('/mjesta/opcina-kalnik/kalnik/')
    expect(settlement.find('small').text()).toContain('Općina Kalnik')

    await page.find('[data-testid="search-field"] input').setValue('qqq')
    await vi.waitFor(() => expect(page.find('[data-testid="place-cards-empty"]').text()).toBe('Nema naselja ni općine „qqq”.'))
  })
})

describe('Town or municipality page', () => {
  const mountKalnik = () => mountSuspended(Municipality, {
    route: { path: '/mjesta/opcina-kalnik/', params: { opcina: 'opcina-kalnik' } }
  })

  it('lists each settlement once, beside the map zoomed to the unit, with no Baština tab', async () => {
    const page = await mountKalnik()
    await vi.waitFor(() => expect(page.find('[data-testid="settlement-list"]').exists()).toBe(true))
    const links = page.findAll('[data-testid="settlement-list"] a').map(link => link.attributes('href'))
    expect(links.length).toBeGreaterThan(0)
    for (const href of links) expect(page.findAll(`a[href="${href}"]`).length).toBe(1)
    expect(page.find('[data-testid="area-map"]').attributes('data-selected')).toBe('opcina-kalnik')
    expect(page.find('[role="tablist"]').exists()).toBe(false)
    expect(page.find('[data-testid="municipality-heritage-list"]').exists()).toBe(false)
    expect(page.find('.pz-overline').exists()).toBe(false)
    expect(page.find('h1').text()).toBe('Općina Kalnik')
  })

  it('links to its heritage on the Baština page, filtered to the unit', async () => {
    const page = await mountKalnik()
    const link = page.find('[data-testid="municipality-heritage-link"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('/bastina/?opcina=opcina-kalnik')
    expect(link.attributes('data-variant')).toBe('link')
    expect(link.text()).toContain('Baština ovog područja')
    expect(link.find('[data-testid="pz-tile-arrow"]').exists()).toBe(true)
  })

  it('narrows the settlements by name and says when none match', async () => {
    const page = await mountKalnik()
    await page.find('[data-testid="search-field"] input').setValue('sopr')
    await vi.waitFor(() => expect(page.findAll('[data-testid="settlement-list"] li b').map(title => title.text())).toEqual(['Šopron']))
    await page.find('[data-testid="search-field"] input').setValue('qqq')
    await vi.waitFor(() => expect(page.find('[data-testid="place-cards-empty"]').text()).toBe('Nema naselja „qqq” u ovom području.'))
  })
})

describe('Baština', () => {
  it('opens filtered to the unit named in ?opcina=', async () => {
    const page = await mountSuspended(HeritageList, { route: '/bastina/?opcina=opcina-kalnik' })
    await vi.waitFor(() => expect(page.findAll('[data-testid="pz-heritage-card"]').length).toBeGreaterThan(0))
    const units = page.findAll('[data-testid="pz-heritage-card"]').map(card => card.text())
    expect(units.every(text => text.includes('Općina Kalnik'))).toBe(true)
  })

  it('drops an unknown ?opcina= and shows the whole list instead of an error page', async () => {
    const page = await mountSuspended(HeritageList, { route: '/bastina/?opcina=nepostojeca-opcina' })
    const router = useRouter()
    await vi.waitFor(() => expect(router.currentRoute.value.query.opcina).toBeUndefined())
    const all = await $fetch<AtlasHeritageListResponse>('/api/atlas/heritage')
    await vi.waitFor(() => expect(page.findAll('[data-testid="pz-heritage-card"]').length).toBe(all.items.length))
  })
})
