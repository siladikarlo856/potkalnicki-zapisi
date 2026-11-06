import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PzBottomSheet from '../app/components/pz/PzBottomSheet.vue'
import PzEmptyState from '../app/components/pz/PzEmptyState.vue'
import PzFactPanel from '../app/components/pz/PzFactPanel.vue'
import PzGameCard from '../app/components/pz/PzGameCard.vue'
import PzHeritageCard from '../app/components/pz/PzHeritageCard.vue'
import PzRidge from '../app/components/pz/PzRidge.vue'
import PzStickyActionBar from '../app/components/pz/PzStickyActionBar.vue'
import PzStitch from '../app/components/pz/PzStitch.vue'
import PzWordCard from '../app/components/pz/PzWordCard.vue'

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

// The sheet reads (min-width: 1024px); a stub stands in for the viewport.
function viewport(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= 1024 && query.includes('1024px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  }))
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

async function openSheet(width: number, props: Record<string, unknown> = {}) {
  viewport(width)
  wrapper = await mountSuspended(PzBottomSheet, {
    props: { open: true, title: 'Predloži ispravak', context: 'Svaki prijedlog pregledamo prije objave.', ...props },
    slots: { default: () => 'Polja obrasca' },
    attachTo: document.body
  })
  await vi.waitFor(() => expect(dialog()).not.toBeNull())
  return wrapper
}

describe('PzBottomSheet', () => {
  it('is a bottom drawer below 1024px', async () => {
    await openSheet(390)
    expect(dialog()!.hasAttribute('data-vaul-drawer')).toBe(true)
    expect(dialog()!.textContent).toContain('Predloži ispravak')
    expect(dialog()!.textContent).toContain('Svaki prijedlog pregledamo prije objave.')
    expect(dialog()!.textContent).toContain('Polja obrasca')
  })

  it('is a modal from 1024px up', async () => {
    await openSheet(1280)
    expect(dialog()!.hasAttribute('data-vaul-drawer')).toBe(false)
    expect(dialog()!.textContent).toContain('Predloži ispravak')
    expect(dialog()!.textContent).toContain('Polja obrasca')
  })

  it('gives the close button an accessible name and a 44px target', async () => {
    await openSheet(1280)
    const close = dialog()!.querySelector<HTMLElement>('button[aria-label="Zatvori"]')
    expect(close).not.toBeNull()
    expect(close!.className).toContain('size-11')
  })

  it('closes without asking when nothing was typed', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const page = await openSheet(1280, { dirty: false })
    dialog()!.querySelector<HTMLElement>('button[aria-label="Zatvori"]')!.click()
    await vi.waitFor(() => expect(page.emitted('update:open')?.at(-1)).toEqual([false]))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks before throwing away typed text, and stays open when the visitor says no', async () => {
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const page = await openSheet(1280, { dirty: true })
    dialog()!.querySelector<HTMLElement>('button[aria-label="Zatvori"]')!.click()
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(page.emitted('update:open')).toBeUndefined()
    expect(dialog()).not.toBeNull()

    confirm.mockReturnValue(true)
    dialog()!.querySelector<HTMLElement>('button[aria-label="Zatvori"]')!.click()
    await vi.waitFor(() => expect(page.emitted('update:open')?.at(-1)).toEqual([false]))
  })
})

describe('PzEmptyState', () => {
  it('names the place and renders its contribution actions as links', async () => {
    wrapper = await mountSuspended(PzEmptyState, {
      props: {
        placeName: 'Šopronu',
        municipality: 'Općina Sveti Petar Orehovec',
        nearby: [{ label: 'Kalnik', to: '/potkalnicko-prigorje/naselja/kalnik' }],
        contributeTypes: [
          { label: 'Dodaj zapis', to: '/potkalnicko-prigorje/doprinesi?vrsta=bastina&naselje=sopron', icon: 'i-lucide-landmark' },
          { label: 'Dodaj riječ', to: '/potkalnicko-prigorje/doprinesi?vrsta=rijec&naselje=sopron', icon: 'i-lucide-message-circle' }
        ]
      }
    })
    expect(wrapper.find('h2').text()).toBe('U Šopronu još skupljamo zapise.')
    const actions = wrapper.findAll('[data-testid="pz-empty-actions"] a')
    expect(actions.map(link => link.text())).toEqual(['Dodaj zapis', 'Dodaj riječ'])
    expect(actions[0]!.attributes('href')).toContain('vrsta=bastina')
    expect(wrapper.find('[data-testid="pz-empty-known"]').text()).toContain('Općina Sveti Petar Orehovec')
    expect(wrapper.text()).not.toMatch(/\b0 zapisa\b|Nema podataka/)
  })
})

describe('PzFactPanel', () => {
  it('says "nepoznato" for unknown facts instead of hiding them, and fills the slots', async () => {
    wrapper = await mountSuspended(PzFactPanel, {
      props: {
        facts: [{ label: 'Naselje', value: 'Kalnik', to: '/potkalnicko-prigorje/naselja/kalnik' }, { label: 'Godina', value: null }],
        sources: [{ label: 'Ivan Horvat, Kalnik, 2004.' }],
        play: { to: '/potkalnicko-prigorje/igre/kviz' }
      },
      slots: { trust: () => 'Provjereno', actions: () => 'Predloži ispravak' }
    })
    const text = wrapper.text()
    expect(text).toContain('Podaci')
    expect(text).toContain('Pouzdanost')
    expect(text).toContain('Provjereno')
    expect(text).toContain('Izvori')
    expect(text).toContain('Predloži ispravak')
    expect(wrapper.find('dd:last-of-type').text()).toBe('nepoznato')
    expect(wrapper.find('[data-testid="pz-fact-panel-play"]').text()).toContain('Igraj s ovim')
    expect(wrapper.findAll('h2')).toHaveLength(3)
  })

  it('leaves out sections with nothing in them', async () => {
    wrapper = await mountSuspended(PzFactPanel, { props: { facts: [{ label: 'Naselje', value: 'Kalnik' }] } })
    expect(wrapper.text()).not.toContain('Pouzdanost')
    expect(wrapper.text()).not.toContain('Izvori')
  })
})

describe('cards', () => {
  it('HeritageCard is one link, named by the title', async () => {
    wrapper = await mountSuspended(PzHeritageCard, {
      props: { title: 'Crkva sv. Brcka', to: '/potkalnicko-prigorje/bastina/kalnik/crkva-sv-brcka', settlement: 'Kalnik', municipality: 'Općina Kalnik', category: 'Crkva' },
      slots: { trust: () => 'Provjereno' }
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    const title = wrapper.find('h3')
    expect(links[0]!.attributes('aria-labelledby')).toBe(title.attributes('id'))
    expect(title.text()).toBe('Crkva sv. Brcka')
    expect(wrapper.text()).toContain('Kalnik, Općina Kalnik')
    expect(wrapper.text()).toContain('Provjereno')
    expect(wrapper.text()).toContain('Crkva')
  })

  it('WordCard is one link, named by the headword, and shows a plural-correct variants line', async () => {
    wrapper = await mountSuspended(PzWordCard, {
      props: { headword: 'jejce', to: '/potkalnicko-prigorje/govor/jejce', type: 'imenica', meaning: 'jaje', variantCount: 3, settlementCount: 21 }
    })
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.find('a').attributes('aria-labelledby')).toBe(wrapper.find('h3').attributes('id'))
    expect(wrapper.find('h3').text()).toContain('jejce')
    expect(wrapper.text()).toContain('3 oblika · u 21 selu')
  })

  it('WordCard swaps the variants line for the local form on a settlement page', async () => {
    wrapper = await mountSuspended(PzWordCard, {
      props: { headword: 'jejce', to: '/x', variantCount: 3, settlementCount: 9, localForm: 'jajce' }
    })
    expect(wrapper.text()).toContain('Ovdje: jajce')
    expect(wrapper.text()).not.toContain('3 oblika')
  })

  it('GameCard is one link, named by the title', async () => {
    wrapper = await mountSuspended(PzGameCard, {
      props: { title: 'Kaj to znači?', blurb: 'Odaberi značenje riječi.', to: '/potkalnicko-prigorje/igre/kviz', questions: 10, minutes: 3 }
    })
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.find('a').attributes('aria-labelledby')).toBe(wrapper.find('h3').attributes('id'))
    expect(wrapper.text()).toContain('10 pitanja · ~3 min')
    expect(wrapper.attributes('aria-disabled')).toBeUndefined()
  })

  it('GameCard coming soon has no link, says Uskoro and is aria-disabled', async () => {
    wrapper = await mountSuspended(PzGameCard, {
      props: { title: 'Legende', to: '/potkalnicko-prigorje/igre/legende', soon: true }
    })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Uskoro')
    expect(wrapper.attributes('aria-disabled')).toBe('true')
  })
})

describe('motif and action bar', () => {
  it('PzRidge and PzStitch are decorative', async () => {
    wrapper = await mountSuspended(PzRidge)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('path')).toHaveLength(4)
    wrapper.unmount()
    wrapper = await mountSuspended(PzStitch)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('path')).toHaveLength(10)
  })

  it('PzStickyActionBar holds its buttons and is for phones only', async () => {
    wrapper = await mountSuspended(PzStickyActionBar, {
      slots: { default: () => [h('button', 'Natrag'), h('button', 'Dalje')] }
    })
    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Natrag', 'Dalje'])
    expect(wrapper.classes()).toContain('sticky')
    expect(wrapper.classes()).toContain('bottom-0')
    expect(wrapper.classes()).toContain('lg:hidden')
  })
})
