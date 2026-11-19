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
  it('offers the first words as radios and a start link that carries the choice', async () => {
    wrapper = await mountSuspended(LearnSetup, { route: '/uci?mjesto=sopron' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-setup"]').exists(), { timeout: 5000 }).toBe(true)
    const start = () => wrapper!.get('[data-testid="learn-setup-start"]')
    expect(start().text()).toBe('Počni s 10 kartica')
    expect(start().attributes('href')).toContain('/uci/sesija/?teme=rijeci&n=10')
    const radios = wrapper!.findAll('input[name="first-pick"]')
    expect(radios.map(radio => radio.attributes('value'))).toContain('mjesto')
    await radios.find(radio => radio.attributes('value') === 'mjesto')!.setValue(true)
    expect(start().attributes('href')).toContain('mjesto=sopron')
  })
})

describe('learn hub with progress', () => {
  const progress = (due: string) => JSON.stringify({
    version: 2,
    cards: { 'word:a': { box: 1, due, seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-01' } },
    lastPlayed: '2026-11-01',
    streak: 1
  })

  it('shows the three numbers and Počni ponavljanje when a card is due', async () => {
    localStorage.setItem('pz-progress/v2', progress('2020-01-01'))
    clearNuxtState(['heritage-progress', 'heritage-progress-loaded'])
    wrapper = await mountSuspended(LearnSetup, { route: '/uci' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-hub"]').exists(), { timeout: 5000 }).toBe(true)
    const review = wrapper.get('[data-testid="learn-home-review"]')
    expect(review.text()).toBe('Počni ponavljanje')
    expect(review.attributes('href')).toContain('/uci/sesija/?ponovi=1')
    expect(wrapper.get('[data-testid="learn-today"]').text()).toContain('za ponavljanje')
    expect(wrapper.findAll('[data-testid="learn-topic-row"]')).toHaveLength(1)
  })

  it('says everything is repeated and offers new words when nothing is due', async () => {
    localStorage.setItem('pz-progress/v2', progress('2999-01-01'))
    clearNuxtState(['heritage-progress', 'heritage-progress-loaded'])
    wrapper = await mountSuspended(LearnSetup, { route: '/uci' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-hub"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.text()).toContain('Za danas je sve ponovljeno.')
    expect(wrapper.get('[data-testid="learn-home-new-lesson"]').text()).toBe('Nauči nove riječi')
  })

  it('names the next review day and how many cards fall on it when nothing is due', async () => {
    const localDay = (offset: number) => {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    const card = (due: string) => ({ box: 2, due, seen: 1, known: 1, missed: 0, lastPlayed: localDay(0) })
    localStorage.setItem('pz-progress/v2', JSON.stringify({
      version: 2,
      cards: { 'word:a': card(localDay(1)), 'word:b': card(localDay(1)), 'word:c': card(localDay(5)) },
      lastPlayed: localDay(0),
      streak: 1
    }))
    clearNuxtState(['heritage-progress', 'heritage-progress-loaded'])
    wrapper = await mountSuspended(LearnSetup, { route: '/uci' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-hub"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('[data-testid="learn-home-next-review"]').text()).toBe('Sljedeće ponavljanje: sutra, 2 kartice.')
    expect(wrapper.get('[data-testid="learn-topic-row"]').text()).toContain('2 kartice ·')
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
