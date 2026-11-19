import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#imports'
import type { CardPool, PoolCard } from '../shared/utils/learn/types'
import LearnSetup from '../app/pages/uci/index.vue'
import PzLearnPlaySwitch from '../app/components/pz/PzLearnPlaySwitch.vue'

function word(id: string): PoolCard {
  return {
    kind: 'word',
    key: `word:${id}`,
    id,
    topics: ['rijeci'],
    headword: `riječ ${id}`,
    meaning: 'značenje',
    variants: [],
    status: 'verified',
    transparency: 0.5,
    difficulty: 2
  }
}

const pool: CardPool = {
  version: 1,
  generatedAt: '2026-11-04T12:00:00.000Z',
  cards: [word('a'), word('b')],
  municipalities: [],
  settlements: [],
  topics: [
    { id: 'rijeci', label: 'Riječi', status: 'live', count: 2 },
    { id: 'mjesta', label: 'Mjesta', status: 'soon', count: 0 }
  ]
}
registerEndpoint('/api/learn/pool', () => pool)

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['pz-learn-state', 'pz-learn-loaded', 'card-pool', 'pz-home-tab', 'pz-home-loaded'])
})

afterEach(() => wrapper?.unmount())

describe('learn setup page', () => {
  it('shows topics and lengths as pressed-state chips and a start link that carries the choice', async () => {
    wrapper = await mountSuspended(LearnSetup, { route: '/uci?mjesto=sopron' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-setup"]').exists(), { timeout: 5000 }).toBe(true)
    const chips = wrapper!.findAll('[data-testid="learn-chip"]')
    const rijeci = chips.find(chip => chip.text().includes('Riječi'))!
    expect(rijeci.attributes('aria-pressed')).toBe('true')
    const soon = chips.find(chip => chip.text().includes('Mjesta'))!
    expect(soon.attributes('disabled')).toBeDefined()
    const twenty = chips.find(chip => chip.text() === '20')!
    await twenty.trigger('click')
    expect(twenty.attributes('aria-pressed')).toBe('true')
    const href = wrapper!.get('[data-testid="learn-setup-start"]').attributes('href')!
    expect(href).toContain('/uci/sesija/?teme=rijeci&n=20')
    expect(href).toContain('mjesto=sopron')
  })
})

describe('Uči | Igraj switch', () => {
  it('is a pill UTabs switch whose Igraj panel holds three game cards and a link to all games', async () => {
    wrapper = await mountSuspended(PzLearnPlaySwitch)
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map(tab => tab.text())).toEqual(['Uči', 'Igraj'])
    expect(wrapper.get('[role="tablist"]').classes()).toContain('rounded-full')
    const igraj = wrapper.get('[data-testid="learn-play-panel-igraj"]')
    expect(igraj.findAll('[data-testid="pz-game-card"]')).toHaveLength(3)
    expect(igraj.text()).toContain('Sve igre')
  })
})
