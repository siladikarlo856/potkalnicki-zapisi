import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#imports'
import Opcine from '../app/pages/igre/opcine.vue'
import SelaOpcine from '../app/pages/igre/sela-i-opcine.vue'
import Nabroji from '../app/pages/igre/nabroji.vue'
import { fixtureCardPool } from './fixtures/gamePool'

const pool = fixtureCardPool()

registerEndpoint('/api/learn/pool', () => pool)

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
  vi.restoreAllMocks()
})

async function waitForStart() {
  await vi.waitFor(() => expect(wrapper!.find('[data-testid="game-start-button"]').exists()).toBe(true))
}

describe('opcine game page', () => {
  it('starts a round and finishes after all answers', async () => {
    wrapper = await mountSuspended(Opcine, { route: '/igre/opcine' })
    await waitForStart()
    await wrapper.get('[data-testid="game-start-button"]').trigger('click')
    expect(wrapper.find('[data-testid="game-shell-opcina"]').exists()).toBe(true)
    for (let i = 0; i < 12 && wrapper.find('[data-testid="game-result"]').exists() === false; i++) {
      if (!wrapper.find('[data-testid="game-option-0"]').exists()) break
      await wrapper.get('[data-testid="game-option-0"]').trigger('click')
      await wrapper.get('[data-testid="game-check"]').trigger('click')
      if (wrapper.find('[data-testid="game-next"]').exists()) {
        await wrapper.get('[data-testid="game-next"]').trigger('click')
      }
    }
    expect(wrapper.find('[data-testid="game-result"]').exists()).toBe(true)
  })
})

describe('sela-i-opcine game page', () => {
  it('builds a board and finishes after Provjeri', async () => {
    wrapper = await mountSuspended(SelaOpcine, { route: '/igre/sela-i-opcine' })
    await waitForStart()
    await wrapper.get('[data-testid="game-start-button"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="sela-chips"]').exists()).toBe(true))
    const chips = wrapper.findAll('[data-testid^="sela-chip-"]')
    for (const chip of chips) {
      await chip.trigger('click')
      const chipId = chip.attributes('data-testid')!.replace('sela-chip-', '')
      const place = pool.cards.find(card => card.kind === 'place' && card.id === chipId)
      expect(place).toBeTruthy()
      await wrapper.get(`[data-testid="sela-bucket-${place!.municipalityId}"]`).trigger('click')
    }
    await wrapper.get('[data-testid="sela-verify"]').trigger('click')
    expect(wrapper.find('[data-testid="game-result"]').exists()).toBe(true)
  })
})

describe('nabroji game page', () => {
  it('lists eight slots for Općina Kalnik and accepts sopron for Šopron', async () => {
    wrapper = await mountSuspended(Nabroji, { route: '/igre/nabroji' })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="nabroji-unit-opcina-kalnik"]').exists()).toBe(true))
    await wrapper.get('[data-testid="nabroji-unit-opcina-kalnik"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="nabroji-slot-"]')).toHaveLength(8)
    const input = wrapper.get('[data-testid="nabroji-input"]')
    await input.setValue('sopron')
    await flushPromises()
    await wrapper.get('[data-testid="nabroji-submit"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper!.get('[data-testid="nabroji-slot-Šopron"]').text()).toBe('Šopron'))
  })
})
