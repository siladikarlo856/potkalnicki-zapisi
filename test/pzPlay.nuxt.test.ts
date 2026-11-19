import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, useRouter } from '#imports'
import Igre from '../app/pages/igre/index.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

const areas = [
  { id: 'county', name: 'Županija', kind: 'county' as const, parentId: null }
]

function payload(): DailyWordPayload {
  return {
    day: '2026-11-11', number: 12, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
    entry: {
      id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }], category: 'house',
      note: { hr: '', en: '' },
      examples: [],
      variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [{ areaId: 'county', confidence: 'reported' }] }]
    },
    areas, villageAreaId: null,
    options: [
      { id: 'a', text: { hr: 'pas', en: 'dog' } },
      { id: 'b', text: { hr: 'stol', en: 'table' } },
      { id: 'c', text: { hr: 'kuća', en: 'house' } },
      { id: 'd', text: { hr: 'mlijeko' } }
    ],
    correctOptionId: 'c',
    clues: [{ kind: 'category', category: 'house' }]
  }
}

registerEndpoint('/api/heritage/daily', () => payload())
registerEndpoint('/api/learn/pool', () => ({
  version: 1,
  generatedAt: '',
  cards: [],
  municipalities: [],
  settlements: [],
  topics: []
}))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
})

async function mountIgre(route: string) {
  wrapper = await mountSuspended(Igre, { route })
  return wrapper
}

describe('Igre list', () => {
  it('groups the games by what they train and leaves the daily word and learning to their own screens', async () => {
    const page = await mountIgre('/igre/')
    await expect.poll(() => page.find('[data-testid="play-catalog"]').exists(), { timeout: 3000 }).toBe(true)
    expect(page.get('h1').text()).toBe('Igre')
    expect(page.find('[data-testid="play-group-rijeci"] [data-testid="game-tile-znacenje"]').exists()).toBe(true)
    expect(page.find('[data-testid="game-tile-rijec-dana"]').exists()).toBe(false)
    expect(page.find('[data-testid="game-tile-kartice"]').exists()).toBe(false)
    expect(page.get('[data-testid="game-tile-znacenje"] [data-testid="game-card-status"]').text()).toBe('Još nije igrano')
  })

  it('filters the cards by question type and says how many games are left', async () => {
    const page = await mountIgre('/igre/')
    await expect.poll(() => page.find('[data-testid="play-filter-odabir"]').exists(), { timeout: 3000 }).toBe(true)
    expect(page.get('[data-testid="play-filter-odabir"]').attributes('aria-pressed')).toBe('false')
    await page.get('[data-testid="play-filter-odabir"]').trigger('click')
    await expect.poll(() => page.find('[data-testid="play-filter-count"]').exists(), { timeout: 3000 }).toBe(true)
    expect(page.get('[data-testid="play-filter-count"]').text()).toMatch(/^\d+ igr(a|e)$/)
    expect(page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(true)
    expect(page.find('[data-testid="game-tile-grupiraj"]').exists()).toBe(false)
  })

  it('says the games are being prepared when an old topic address has none to show', async () => {
    const page = await mountIgre('/igre/?tema=mjesta')
    await expect.poll(() => page.find('[data-testid="play-empty-state"]').exists(), { timeout: 3000 }).toBe(true)
    expect(page.text()).toContain('Igre se još pripremaju')
    expect(page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(false)
    expect(page.get('[data-testid="play-active-topic"]').text()).toContain('Tema: Mjesta')
    expect(page.get('[data-testid="play-empty-state"] a[href="/#rijec-dana"]').text()).toBe('Riječ dana')
    await page.get('[data-testid="play-clear-topic"]').trigger('click')
    await expect.poll(() => page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(true)
    expect(page.find('[data-testid="play-active-topic"]').exists()).toBe(false)
    expect(page.find('[data-testid="play-empty-state"]').exists()).toBe(false)
  })

  it('clears a populated topic filter while preserving the question type and other query parameters', async () => {
    const page = await mountIgre('/igre/?tema=rijeci&vrsta=odabir&zadrzi=da')
    await expect.poll(() => page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(true)
    expect(page.get('[data-testid="play-active-topic"]').text()).toContain('Tema: Riječi')
    await page.get('[data-testid="play-clear-topic"]').trigger('click')
    await expect.poll(() => page.find('[data-testid="play-active-topic"]').exists()).toBe(false)
    expect(useRouter().currentRoute.value.query).toEqual({ vrsta: 'odabir', zadrzi: 'da' })
    expect(page.get('[data-testid="play-filter-odabir"]').attributes('aria-pressed')).toBe('true')
    expect(page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(true)
  })
})
