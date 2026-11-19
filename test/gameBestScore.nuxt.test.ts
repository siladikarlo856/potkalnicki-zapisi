import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import TkoJeTo from '../app/pages/igre/tko-je-to.vue'
import Tile from '../app/components/games/GameCard.vue'
import { GAME_CATALOGUE } from '../shared/utils/games/catalogue'
import { pzRoutes } from '../shared/utils/appRoutes'
import { GAME_SCORES_KEY } from '../shared/utils/games/scores'

const persons = Array.from({ length: 6 }, (_, i) => ({
  kind: 'person' as const,
  key: `person:p${i}` as const,
  id: `p${i}`,
  topics: ['osobe'],
  name: `Osoba ${i}`,
  slug: `osoba-${i}`,
  years: `19${10 + i}–19${80 + i}`,
  clue: `Trag broj ${i}.`,
  role: 'pisac',
  areaIds: [],
  verification: 'verified' as const
}))
registerEndpoint('/api/learn/pool', () => ({
  version: 1, generatedAt: '2026-11-06T00:00:00.000Z', cards: persons, municipalities: [], settlements: [], topics: []
}))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['heritage-tko-je-to-seed', 'pz-game-scores', 'pz-game-scores-loaded', 'heritage-progress', 'heritage-progress-loaded'])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
  vi.restoreAllMocks()
})

async function playRound(page: NonNullable<typeof wrapper>, correct = true) {
  for (let i = 0; i < 20 && !page.find('[data-testid="game-result"]').exists(); i++) {
    const n = page.get('[data-testid="game-prompt"]').text().match(/Trag broj (\d+)/)![1]
    const option = page.findAll('[data-testid^="game-option-"]').find(o => o.text().includes(`Osoba ${n}`) === correct)!
    await option.trigger('click')
    await page.get('[data-testid="game-check"]').trigger('click')
    await page.get('[data-testid="game-next"]').trigger('click')
  }
}

describe('best score of a game', () => {
  it('shows the best Tko je to? round on its catalogue tile', async () => {
    wrapper = await mountSuspended(TkoJeTo, { route: pzRoutes.tkoJeTo })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="game-start-button"]').exists()).toBe(true))
    await wrapper.get('[data-testid="game-start-button"]').trigger('click')
    await playRound(wrapper)
    expect(wrapper.find('[data-testid="game-result"]').exists()).toBe(true)
    wrapper.unmount()

    const entry = GAME_CATALOGUE.find(game => game.path === pzRoutes.tkoJeTo)!
    wrapper = await mountSuspended(Tile, { props: { game: entry } })
    await vi.waitFor(() => expect(wrapper!.text()).toMatch(/Najbolje: 6\/6/))
  })

  it.each([false, true])('shows a saved best after a zero round, with an earlier positive round: %s', async (previousPositive) => {
    wrapper = await mountSuspended(TkoJeTo, { route: pzRoutes.tkoJeTo })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="game-start-button"]').exists()).toBe(true))
    await wrapper.get('[data-testid="game-start-button"]').trigger('click')
    if (previousPositive) {
      await playRound(wrapper)
      await wrapper.get('[data-testid="game-replay"]').trigger('click')
    }
    await playRound(wrapper, false)
    expect(wrapper.get('[data-testid="game-result-score"]').text()).toBe('Rezultat: 0/6')
    const score = previousPositive ? 6 : 0
    expect(JSON.parse(localStorage.getItem(GAME_SCORES_KEY)!).best.osoba).toMatchObject({ score, max: 6 })
    wrapper.unmount()
    clearNuxtState(['pz-game-scores', 'pz-game-scores-loaded'])

    const entry = GAME_CATALOGUE.find(game => game.id === 'osoba')!
    wrapper = await mountSuspended(Tile, { props: { game: entry } })
    await vi.waitFor(() => expect(wrapper!.get('[data-testid="game-card-status"]').text()).toBe(`Najbolje: ${score}/6`))
  })
})
