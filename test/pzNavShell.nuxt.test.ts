import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import PzBottomNav from '../app/components/pz/PzBottomNav.vue'
import PzHeader from '../app/components/pz/PzHeader.vue'
import { useHidePzTabBar, usePzTabBar } from '../app/composables/usePzTabBar'

beforeEach(() => {
  usePzTabBar().holds.value = []
})

describe('PzBottomNav', () => {
  it('renders four tab links in a labelled nav and marks the active one', async () => {
    const nav = await mountSuspended(PzBottomNav, { route: '/potkalnicko-prigorje/istrazi/opcina-kalnik' })
    const el = nav.find('nav[aria-label="Glavna navigacija"]')
    expect(el.exists()).toBe(true)
    const tabs = el.findAll('a')
    expect(tabs.map(tab => tab.text())).toEqual(['Početna', 'Igre', 'Istraži', 'Doprinesi'])
    expect(tabs.map(tab => tab.attributes('aria-current'))).toEqual([undefined, undefined, 'page', undefined])
    expect(tabs[3]!.attributes('href')).toBe('/potkalnicko-prigorje/doprinesi')
  })

  it('marks Početna only on the home page and nothing on O projektu', async () => {
    const home = await mountSuspended(PzBottomNav, { route: '/potkalnicko-prigorje' })
    expect(home.findAll('a[aria-current="page"]').map(tab => tab.text())).toEqual(['Početna'])
    const about = await mountSuspended(PzBottomNav, { route: '/potkalnicko-prigorje/o-projektu' })
    expect(about.findAll('a[aria-current="page"]')).toHaveLength(0)
  })

  it.each(['game', 'challenge', 'sheet'] as const)('hides while the %s hold is set and returns when released', async (reason) => {
    const nav = await mountSuspended(PzBottomNav, { route: '/potkalnicko-prigorje/igre' })
    const { hold, release } = usePzTabBar()
    expect(nav.find('nav').exists()).toBe(true)
    hold(reason)
    await nextTick()
    expect(nav.find('nav').exists()).toBe(false)
    release(reason)
    await nextTick()
    expect(nav.find('nav').exists()).toBe(true)
  })

  it('stays hidden until every hold is released', async () => {
    const nav = await mountSuspended(PzBottomNav, { route: '/potkalnicko-prigorje/igre' })
    const { hold, release } = usePzTabBar()
    hold('game')
    hold('sheet')
    release('game')
    await nextTick()
    expect(nav.find('nav').exists()).toBe(false)
    release('sheet')
    await nextTick()
    expect(nav.find('nav').exists()).toBe(true)
  })

  it('hides while a text field has focus (on-screen keyboard) and not for a button', async () => {
    const field = document.createElement('input')
    const button = document.createElement('button')
    document.body.append(field, button)
    const nav = await mountSuspended(PzBottomNav, { route: '/potkalnicko-prigorje/doprinesi' })
    button.focus()
    await nextTick()
    expect(nav.find('nav').exists()).toBe(true)
    field.focus()
    await nextTick()
    expect(nav.find('nav').exists()).toBe(false)
    field.blur()
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(nav.find('nav').exists()).toBe(true)
    field.remove()
    button.remove()
  })
})

describe('useHidePzTabBar', () => {
  it('holds while the source is true and releases on unmount', async () => {
    const active = ref(false)
    const Probe = defineComponent({
      setup() {
        useHidePzTabBar(active, 'game')
        return () => h('div')
      }
    })
    const probe = await mountSuspended(Probe)
    const { hidden } = usePzTabBar()
    expect(hidden.value).toBe(false)
    active.value = true
    await nextTick()
    expect(hidden.value).toBe(true)
    probe.unmount()
    expect(hidden.value).toBe(false)
  })
})

describe('PzHeader', () => {
  it('lists all six sections inline and in the menu, with the current one marked on desktop', async () => {
    const header = await mountSuspended(PzHeader, { route: '/potkalnicko-prigorje/govor' })
    const inline = header.find('[data-testid="pz-header-nav"]')
    expect(inline.findAll('a').map(link => link.text())).toEqual(['Igre', 'Istraži', 'Baština', 'Naš govor', 'Doprinesi', 'O projektu'])
    expect(inline.findAll('a[aria-current="page"]').map(link => link.text())).toEqual(['Naš govor'])
    expect(header.find('[data-testid="pz-menu-button"]').attributes('aria-label')).toBe('Izbornik')
    expect(header.find('[data-testid="pz-lang-desktop"]').text()).toContain('HR')
    expect(header.find('[data-testid="pz-lang-desktop"]').text()).toContain('EN')
  })

  it('is pinned only from lg up, where there is no tab bar', async () => {
    const header = await mountSuspended(PzHeader, { route: '/potkalnicko-prigorje' })
    const classes = header.find('header').classes()
    expect(classes).toContain('lg:sticky')
    expect(classes).toContain('lg:top-0')
    expect(classes).not.toContain('sticky')
    expect(classes).not.toContain('top-0')
  })
})
