import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import Igre from '../app/pages/potkalnicko-prigorje/igre/index.vue'
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

describe('Potkalnički zapisi play catalogue (WP2)', () => {
  it('renders the daily word anchor and play catalogue', async () => {
    const page = await mountSuspended(Igre, { route: '/potkalnicko-prigorje/igre' })
    expect(page.find('#rijec-dana').exists()).toBe(true)
    expect(page.find('[data-testid="play-catalog"]').exists()).toBe(true)
    expect(page.find('[data-testid="game-tile-rijec-dana"]').exists()).toBe(true)
    expect(page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(true)
  })

  it('filters tiles when a topic chip is selected after mount', async () => {
    const page = await mountSuspended(Igre, { route: '/potkalnicko-prigorje/igre?tema=mjesta' })
    await expect.poll(() => page.find('[data-testid="play-filter-mjesta"]').exists(), { timeout: 3000 }).toBe(true)
    await page.get('[data-testid="play-filter-mjesta"]').trigger('click')
    await expect.poll(() => page.find('[data-testid="play-empty-state"]').exists(), { timeout: 3000 }).toBe(true)
    expect(page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(false)
  })

  it('shows riječi games when the rijeci filter is applied', async () => {
    const page = await mountSuspended(Igre, { route: '/potkalnicko-prigorje/igre' })
    await page.get('[data-testid="play-filter-rijeci"]').trigger('click')
    await expect.poll(() => page.find('[data-testid="game-tile-znacenje"]').exists(), { timeout: 3000 }).toBe(true)
    expect(page.find('[data-testid="game-tile-znacenje"]').exists()).toBe(true)
    expect(page.find('[data-testid="play-empty-state"]').exists()).toBe(false)
  })
})
