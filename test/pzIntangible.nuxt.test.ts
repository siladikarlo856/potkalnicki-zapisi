import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import IntangibleIndex from '../app/pages/price-i-obicaji/index.vue'
import IntangibleRecord from '../app/pages/price-i-obicaji/[kind]/[slug].vue'
import ThemePage from '../app/pages/price-i-obicaji/teme/[slug].vue'
import NarratorPage from '../app/pages/price-i-obicaji/kazivaci/[slug].vue'
import PersonPage from '../app/pages/osobe/[slug].vue'
import Settlement from '../app/pages/mjesta/[opcina]/[naselje].vue'
import Municipality from '../app/pages/mjesta/[opcina]/index.vue'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

// The public Priče i običaji pages on the fake snapshot (test/helpers/fakeIntangible.ts): the list and its filters,
// a record page per kind, a theme, narrators with and without consent, and the lists on place and person pages.
const ROOT = '/price-i-obicaji'

describe('Priče i običaji list', () => {
  it('lists records with kind and type, and offers the kind filter and the Memory route', async () => {
    const page = await mountSuspended(IntangibleIndex, { route: ROOT })
    await vi.waitFor(() => expect(page.find('[data-testid="intangible-list"]').exists()).toBe(true))
    const list = page.get('[data-testid="intangible-list"]').text()
    expect(list).toContain('Kalnička vještica')
    expect(list).toContain('Priča · legenda/predaja')
    expect(list).toContain('Običaj · godišnji običaji')
    expect(list).toContain('pjesma')
    expect(list).not.toContain('Usmeni tekst · pjesma')
    expect(list).toContain('Što je bilo, bilo je.')
    expect(list).not.toContain('Skinuta priča')
    expect(page.get('[data-testid="intangible-count"]').text()).toBe('6 zapisa')
    const kinds = page.get('[data-testid="intangible-filter-kind"]').findAll('button').map(b => b.text())
    expect(kinds).toEqual(['Sve', 'Priče', 'Običaji', 'Usmeni tekstovi'])
    expect(page.find('[data-testid="intangible-filter-type"]').exists()).toBe(false)
    expect(page.get('[data-testid="intangible-contribute"]').attributes('href')).toBe('/doprinesi/?vrsta=sjecanje')
  })

  it('narrows by kind and then offers the types of that kind', async () => {
    const page = await mountSuspended(IntangibleIndex, { route: `${ROOT}?kind=price` })
    await vi.waitFor(() => expect(page.find('[data-testid="intangible-filter-type"]').exists()).toBe(true))
    expect(page.get('[data-testid="intangible-filter-type"]').findAll('button').map(b => b.text())).toEqual(['Sve', 'legenda/predaja'])
    const list = page.get('[data-testid="intangible-list"]').text()
    expect(list).toContain('Kalnička vještica')
    expect(list).not.toContain('Martinje u Kalniku')
  })
})

describe('record pages', () => {
  it('renders a Story: both tellings, people, places, date, period, themes, sources and attestation worded as attestation', async () => {
    const page = await mountSuspended(IntangibleRecord, {
      route: { path: `${ROOT}/price/kalnicka-vjestica/`, params: { kind: 'price', slug: 'kalnicka-vjestica' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="intangible-story-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="intangible-overline"]').text()).toBe('Priča · legenda/predaja')
    expect(page.get('h1').text()).toBe('Kalnička vještica')
    expect(page.get('[data-testid="intangible-text-local"]').text()).toContain('Kaj je bilo, bilo je.')
    expect(page.get('[data-testid="intangible-text-standard"]').text()).toBe('Što je bilo, bilo je.')
    const narrators = page.findAll('[data-testid="intangible-narrator"]')
    expect(narrators.map(n => n.text())).toEqual(['Marija Horvat', 'kazivač, r. 1950., Kalnik'])
    expect(narrators[0]!.attributes('href')).toBe(`${ROOT}/kazivaci/marija-horvat/`)
    expect(page.findAll('[data-testid="intangible-collector"]').map(n => n.text())).toEqual(['Marija Horvat', 'Kazivač/ica'])
    expect(page.get('[data-testid="intangible-author"]').text()).toBe('Ivan Kalničan')
    expect(page.get('[data-testid="intangible-recorded-in"]').text()).toBe('Kalnik')
    expect(page.get('[data-testid="intangible-about"]').text()).toBe('Potkalničko prigorje')
    expect(page.get('[data-testid="intangible-recorded-on"]').text()).toBe('12. ožujka 1987.')
    expect(page.get('[data-testid="intangible-period"]').text()).toBe('u turska vremena')
    expect(page.get('[data-testid="intangible-heritage"]').text()).toContain('Crkva sv. Brcka')
    expect(page.get('[data-testid="intangible-themes"]').find('a').attributes('href')).toBe(`${ROOT}/teme/vino/`)
    expect(page.get('[data-testid="pz-fact-panel"]').text()).toContain('Registar kulturnih dobara')
    expect(page.get('[data-testid="intangible-credits"]').text()).toContain('Ana Pošiljateljica')
    const attestation = page.get('[data-testid="attestation-verified"]').text()
    expect(attestation).toContain('Potvrđeno da je ovako zaista bilo')
    expect(attestation).toContain('To ne znači da je sve što priča kaže istina.')
    expect(page.text()).not.toContain('Ivan Novak')
    expect(page.text()).not.toContain('PRIVATN')
  })

  it('renders a Custom: occasion, description, quotes, approximate era and its Folk texts', async () => {
    const page = await mountSuspended(IntangibleRecord, {
      route: { path: `${ROOT}/obicaji/martinje-u-kalniku/`, params: { kind: 'obicaji', slug: 'martinje-u-kalniku' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="intangible-custom-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="intangible-occasion"]').text()).toBe('Martinje')
    expect(page.get('[data-testid="intangible-description"]').text()).toBe('Mošt se krstio u vino.')
    expect(page.get('[data-testid="intangible-quotes"]').text()).toContain('Sveti Martin, krsti vino!')
    expect(page.get('[data-testid="intangible-period"]').text()).toBe('1960-ih (približno)')
    expect(page.get('[data-testid="intangible-recorded-on"]').text()).toBe('studeni 1990.')
    expect(page.get('[data-testid="intangible-folk-texts"]').text()).toContain('Martinjska zdravica')
    expect(page.find('[data-testid="attestation-unverified"]').exists()).toBe(true)
    expect(page.text()).toContain('Još bez potvrde')
  })

  it('renders a Folk text with the Custom it belonged to and its Words', async () => {
    const page = await mountSuspended(IntangibleRecord, {
      route: { path: `${ROOT}/narodni-tekstovi/martinjska-zdravica/`, params: { kind: 'narodni-tekstovi', slug: 'martinjska-zdravica' } }
    })
    await vi.waitFor(() => expect(page.find('[data-testid="intangible-folk_text-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="intangible-overline"]').text()).toBe('pjesma')
    expect(page.get('[data-testid="intangible-text-local"]').text()).toBe('Živio Martin, živilo vino!')
    expect(page.get('[data-testid="intangible-custom"]').text()).toContain('Martinje u Kalniku')
    expect(page.get('[data-testid="intangible-words"]').find('a').attributes('href')).toBe('/govor/martin/')
    expect(page.get('[data-testid="intangible-recorded-on"]').text()).toBe('1975.')
    expect(page.find('[data-testid="intangible-period"]').exists()).toBe(false)
  })
})

describe('themes and narrators', () => {
  it('lists a theme across kinds', async () => {
    const page = await mountSuspended(ThemePage, { route: { path: `${ROOT}/teme/vino/`, params: { slug: 'vino' } } })
    await vi.waitFor(() => expect(page.find('[data-testid="theme-page"]').exists()).toBe(true))
    expect(page.get('h1').text()).toBe('Vino')
    expect(page.get('[data-testid="theme-description"]').text()).toBe('Što se pilo i sadilo.')
    const records = page.get('[data-testid="theme-records"]').text()
    for (const title of ['Kalnička vještica', 'Martinje u Kalniku', 'Martinjska zdravica']) expect(records).toContain(title)
  })

  it('shows an empty theme without breaking', async () => {
    const page = await mountSuspended(ThemePage, { route: { path: `${ROOT}/teme/prazna/`, params: { slug: 'prazna' } } })
    await vi.waitFor(() => expect(page.find('[data-testid="theme-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="theme-empty"]').text()).toBe('U ovoj temi još nema zapisa.')
  })

  it('shows a consenting narrator by name with details, and everything they told and wrote down', async () => {
    const page = await mountSuspended(NarratorPage, { route: { path: `${ROOT}/kazivaci/marija-horvat/`, params: { slug: 'marija-horvat' } } })
    await vi.waitFor(() => expect(page.find('[data-testid="narrator-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="narrator-name"]').text()).toBe('Marija Horvat')
    expect(page.get('[data-testid="narrator-details"]').text()).toContain('Rođen/a 1938.')
    expect(page.get('[data-testid="narrator-details"]').text()).toContain('Preminuo/la')
    expect(page.get('[data-testid="narrator-person"]').attributes('href')).toBe('/osobe/ivan-kalnican/')
    expect(page.get('[data-testid="narrator-told"]').text()).toContain('Martinjska zdravica')
    expect(page.get('[data-testid="narrator-collected"]').text()).toContain('Kalnička vještica')
    expect(page.find('[data-testid="narrator-anonymous"]').exists()).toBe(false)
  })

  it('shows a narrator without consent by description only, with no name and no details', async () => {
    const page = await mountSuspended(NarratorPage, { route: { path: `${ROOT}/kazivaci/kazivac-r-1950-kalnik/`, params: { slug: 'kazivac-r-1950-kalnik' } } })
    await vi.waitFor(() => expect(page.find('[data-testid="narrator-page"]').exists()).toBe(true))
    expect(page.get('[data-testid="narrator-name"]').text()).toBe('kazivač, r. 1950., Kalnik')
    expect(page.get('[data-testid="narrator-anonymous"]').text()).toContain('bez njegovog pristanka')
    expect(page.find('[data-testid="narrator-details"]').exists()).toBe(false)
    expect(page.find('[data-testid="narrator-person"]').exists()).toBe(false)
    expect(page.text()).not.toContain('Ivan Novak')
    expect(page.get('[data-testid="narrator-told"]').text()).toContain('Kalnička vještica')
    expect(page.get('[data-testid="narrator-collected"]').text()).toContain('Martinje u Kalniku')
  })
})

describe('records on place and person pages', () => {
  it('lists them on the settlement, municipality and person pages', async () => {
    const settlement = await mountSuspended(Settlement, { route: { path: '/mjesta/opcina-kalnik/kalnik/', params: { opcina: 'opcina-kalnik', naselje: 'kalnik' } } })
    await vi.waitFor(() => expect(settlement.find('[data-testid="settlement-intangible"]').exists()).toBe(true))
    expect(settlement.get('[data-testid="settlement-intangible"]').text()).toContain('Kalnička vještica')
    expect(settlement.get('[data-testid="settlement-intangible"]').text()).toContain('Priča · legenda/predaja')

    const unit = await mountSuspended(Municipality, { route: { path: '/mjesta/opcina-kalnik/', params: { opcina: 'opcina-kalnik' } } })
    await vi.waitFor(() => expect(unit.find('[data-testid="municipality-intangible"]').exists()).toBe(true))
    expect(unit.get('[data-testid="municipality-intangible"]').text()).toContain('Martinje u Kalniku')

    const person = await mountSuspended(PersonPage, { route: { path: '/osobe/ivan-kalnican', params: { slug: 'ivan-kalnican' } } })
    await vi.waitFor(() => expect(person.find('[data-testid="person-intangible"]').exists()).toBe(true))
    expect(person.get('[data-testid="person-intangible"]').text()).toContain('Kalnička vještica')
  })
})
