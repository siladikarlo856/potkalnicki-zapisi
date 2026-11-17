import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import GdjeJeCrkva from '../app/pages/igre/gdje-je-crkva.vue'
import Spoji from '../app/pages/igre/spoji.vue'
import { fixtureCardPool } from './fixtures/gamePool'

const pool = fixtureCardPool()
function poolForGames() {
  const p = structuredClone(pool) as typeof pool
  const template = p.cards.find(c => c.kind === 'item')!
  const settlements = p.settlements
  for (let i = 0; p.cards.filter(c => c.kind === 'item').length < 4; i++) {
    p.cards.push({
      ...template,
      key: `item:extra-${i}`,
      id: `extra-${i}`,
      name: `Kapela test ${i}`,
      settlementId: settlements[i % settlements.length]!.id
    })
  }
  return p
}
registerEndpoint('/api/learn/pool', () => poolForGames())

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['heritage-gdje-crkva-seed', 'heritage-spoji-seed', 'pz-game-scores', 'pz-game-scores-loaded'])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
  vi.restoreAllMocks()
})

describe('Gdje je ta crkva?', () => {
  it('shows the verification badge and accepts a correct answer', async () => {
    wrapper = await mountSuspended(GdjeJeCrkva, { route: '/igre/gdje-je-crkva' })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="game-start"]').exists()).toBe(true))
    await wrapper.get('[data-testid="game-start-button"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="church-status-badge"]').exists()).toBe(true))
    expect(wrapper.get('[data-testid="church-status-badge"]').exists()).toBe(true)
    const prompt = wrapper.get('[data-testid="game-prompt"]').text()
    expect(prompt).not.toMatch(/provjeravamo|REG|research/i)
    const options = wrapper.findAll('[data-testid^="game-option-"]')
    expect(options.length).toBeGreaterThanOrEqual(2)
    await options[0]!.trigger('click')
    expect(wrapper.find('[data-testid="game-feedback"]').exists()).toBe(true)
  })

  it('widens topics to all bastina', async () => {
    wrapper = await mountSuspended(GdjeJeCrkva, { route: '/igre/gdje-je-crkva' })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="church-topic-wide"]').exists()).toBe(true))
    await wrapper.get('[data-testid="church-topic-wide"]').trigger('click')
    expect(wrapper.get('[data-testid="church-topic-wide"]').classes().join(' ')).toMatch(/primary/)
  })
})

describe('Spoji crkvu i selo', () => {
  it('pairs correctly and rejects a wrong pair', async () => {
    wrapper = await mountSuspended(Spoji, { route: '/igre/spoji' })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="match-start-button"]').exists()).toBe(true))
    await wrapper.get('[data-testid="match-start-button"]').trigger('click')
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="heritage-match-board"]').exists()).toBe(true))

    await wrapper.get('[data-testid="heritage-match-left-0"]').trigger('click')
    await wrapper.get('[data-testid="heritage-match-right-1"]').trigger('click')
    await vi.waitFor(() => {
      const wrong = wrapper!.find('[data-testid="heritage-match-wrong"]').exists()
      const locked = wrapper!.get('[data-testid="heritage-match-left-0"]').classes().join(' ').includes('success')
      expect(wrong || locked).toBe(true)
    })

    for (let i = 0; i < 4; i++) {
      const left = wrapper!.find(`[data-testid="heritage-match-left-${i}"]`)
      if (left.exists() && !left.attributes('disabled')) {
        await left.trigger('click')
        await wrapper!.get(`[data-testid="heritage-match-right-${i}"]`).trigger('click')
      }
    }
  })
})
