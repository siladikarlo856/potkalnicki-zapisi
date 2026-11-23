import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useNuxtApp, useState } from '#imports'
import { createSSRApp, defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import PzBottomNav from '../app/components/pz/PzBottomNav.vue'
import PzHeader from '../app/components/pz/PzHeader.vue'
import { useHidePzTabBar, usePzTabBar, type PzTabBarHold } from '../app/composables/usePzTabBar'

beforeEach(() => {
  useState<Record<string, PzTabBarHold[]>>('pz-tabbar-owners', () => ({})).value = {}
})

describe('PzBottomNav', () => {
  it('renders four tab links in a labelled nav and marks the active one', async () => {
    const nav = await mountSuspended(PzBottomNav, { route: '/mjesta/opcina-kalnik/' })
    const el = nav.find('nav[aria-label="Glavna navigacija"]')
    expect(el.exists()).toBe(true)
    const tabs = el.findAll('a')
    expect(tabs.map(tab => tab.text())).toEqual(['Početna', 'Igre', 'Istraži', 'Doprinesi'])
    expect(tabs.map(tab => tab.attributes('aria-current'))).toEqual([undefined, undefined, 'page', undefined])
    expect(tabs[3]!.attributes('href')).toBe('/doprinesi/')
  })

  it('marks Početna only on the home page and nothing on O projektu', async () => {
    const home = await mountSuspended(PzBottomNav, { route: '/' })
    expect(home.findAll('a[aria-current="page"]').map(tab => tab.text())).toEqual(['Početna'])
    const about = await mountSuspended(PzBottomNav, { route: '/o-projektu' })
    expect(about.findAll('a[aria-current="page"]')).toHaveLength(0)
  })

  it.each(['game', 'challenge', 'sheet'] as const)('hides while the %s hold is set and returns when released', async (reason) => {
    const nav = await mountSuspended(PzBottomNav, { route: '/igre' })
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
    const nav = await mountSuspended(PzBottomNav, { route: '/igre' })
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
    const nav = await mountSuspended(PzBottomNav, { route: '/doprinesi' })
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
  it('reuses the server-rendered owner during hydration and releases it on client unmount', async () => {
    const nuxt = useNuxtApp()
    const Probe = defineComponent({
      setup() {
        useHidePzTabBar(true, 'challenge')
        return () => h('p', 'Challenge action')
      }
    })
    const host = document.createElement('div')
    document.body.append(host)
    const client = createSSRApp(Probe)
    try {
      host.innerHTML = await nuxt.runWithContext(() => renderToString(createSSRApp(Probe)))
      expect(usePzTabBar().hidden.value).toBe(true)
      nuxt.runWithContext(() => client.mount(host))
      expect(host.textContent).toBe('Challenge action')
      expect(usePzTabBar().hidden.value).toBe(true)
    } finally {
      client.unmount()
      host.remove()
    }
    expect(usePzTabBar().hidden.value).toBe(false)
  })

  it.each(['challenge', 'game', 'sheet', 'keyboard'] as const)('keeps independent %s holds across overlapping scopes and inactive callers', async (reason) => {
    const nav = await mountSuspended(PzBottomNav)
    const outgoing = effectScope()
    const incoming = effectScope()
    const inactive = effectScope()
    const outgoingActive = ref(true)
    const incomingActive = ref(true)
    try {
      outgoing.run(() => useHidePzTabBar(outgoingActive, reason))
      incoming.run(() => useHidePzTabBar(incomingActive, reason))
      inactive.run(() => useHidePzTabBar(false, reason))
      await nextTick()
      expect(nav.find('nav').exists()).toBe(false)
      inactive.stop()
      outgoingActive.value = false
      await nextTick()
      expect(nav.find('nav').exists()).toBe(false)
      outgoingActive.value = true
      await nextTick()
      incoming.stop()
      await nextTick()
      expect(nav.find('nav').exists()).toBe(false)
      outgoing.stop()
      await nextTick()
      expect(nav.find('nav').exists()).toBe(true)
    } finally {
      outgoing.stop()
      incoming.stop()
      inactive.stop()
      nav.unmount()
    }
  })

  it('makes repeated holds and releases idempotent for each caller', async () => {
    const nav = await mountSuspended(PzBottomNav)
    const first = usePzTabBar()
    const second = usePzTabBar()
    try {
      first.hold('challenge')
      first.hold('challenge')
      second.hold('challenge')
      first.release('challenge')
      first.release('challenge')
      await nextTick()
      expect(nav.find('nav').exists()).toBe(false)
      second.release('challenge')
      await nextTick()
      expect(nav.find('nav').exists()).toBe(true)
    } finally {
      first.release('challenge')
      second.release('challenge')
      nav.unmount()
    }
  })

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
  it('lists all seven sections inline and in the menu, with the current one marked on desktop', async () => {
    const header = await mountSuspended(PzHeader, { route: '/govor' })
    const inline = header.find('[data-testid="pz-header-nav"]')
    expect(inline.findAll('a').map(link => link.text())).toEqual(['Igre', 'Istraži', 'Baština', 'Priče i običaji', 'Naš govor', 'Doprinesi', 'O projektu'])
    expect(inline.findAll('a[aria-current="page"]').map(link => link.text())).toEqual(['Naš govor'])
    expect(header.find('[data-testid="pz-menu-button"]').attributes('aria-label')).toBe('Izbornik')
    expect(header.find('[data-testid="pz-lang-desktop"]').exists()).toBe(false)
    expect(header.find('[data-testid="pz-lang-menu"]').exists()).toBe(false)
    expect(header.find('[aria-label="Jezik"]').exists()).toBe(false)
  })

  it('is pinned only from lg up, where there is no tab bar', async () => {
    const header = await mountSuspended(PzHeader, { route: '' })
    const classes = header.find('header').classes()
    expect(classes).toContain('lg:sticky')
    expect(classes).toContain('lg:top-0')
    expect(classes).not.toContain('sticky')
    expect(classes).not.toContain('top-0')
  })
})
