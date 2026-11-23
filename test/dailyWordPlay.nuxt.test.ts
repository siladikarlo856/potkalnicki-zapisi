import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { clearNuxtData, clearNuxtState } from '#imports'
import Hub from '../app/pages/igre/index.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

const areas = [
  { id: 'county', name: 'Županija', kind: 'county' as const, parentId: null },
  { id: 'vil-a', name: 'Selo A', kind: 'settlement' as const, parentId: 'county' }
]

function payload(over: Partial<DailyWordPayload> = {}): DailyWordPayload {
  return {
    day: '2026-11-11', number: 12, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
    entry: {
      id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }], category: 'house',
      note: { hr: 'Dolazi od njemačke riječi.', en: 'From a German word.' },
      examples: [{ text: 'Idem v hižu.', translation: 'Idem u kuću.' }],
      variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [{ areaId: 'vil-a', confidence: 'reported' }] }]
    },
    areas, villageAreaId: null,
    options: [
      { id: 'a', text: { hr: 'pas', en: 'dog' } },
      { id: 'b', text: { hr: 'stol', en: 'table' } },
      { id: 'c', text: { hr: 'kuća', en: 'house' } },
      { id: 'd', text: { hr: 'mlijeko' } }
    ],
    correctOptionId: 'c',
    clues: [{ kind: 'example', text: 'Idem v hižu.' }, { kind: 'category', category: 'house' }],
    ...over
  }
}

let current: DailyWordPayload | 'not-started' = payload()
registerEndpoint('/api/heritage/daily', () => {
  if (current === 'not-started') throw createError({ statusCode: 404, statusMessage: 'not-started' })
  return current
})
registerEndpoint('/api/heritage/words', () => ({ words: [], areas }))
registerEndpoint('/api/learn/pool', () => ({
  version: 1,
  generatedAt: '',
  cards: [],
  municipalities: [],
  settlements: [],
  topics: []
}))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']

beforeEach(() => {
  current = payload()
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearNuxtData('heritage-daily-word')
})

describe('daily word placement', () => {
  it('is the first section of the games hub, ahead of the play catalogue', async () => {
    const page = await mountSuspended(Hub, { route: '/igre' })
    await expect.poll(() => page.find('[data-testid="play-catalog"]').exists(), { timeout: 3000 }).toBe(true)
    const daily = page.element.querySelector('#rijec-dana')!
    const catalog = page.element.querySelector('[data-testid="play-catalog"]')!
    expect(daily).not.toBeNull()
    expect(catalog).not.toBeNull()
    expect(daily.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    page.unmount()
  })

  it('links to the Riječ dana page from the games hub instead of listing a catalogue tile', async () => {
    const page = await mountSuspended(Hub, { route: '/igre/' })
    expect(page.element.querySelector('#rijec-dana')).not.toBeNull()
    expect(page.get('[data-testid="igre-daily-link"] a').attributes('href')).toBe('/rijec-dana/')
    expect(page.find('[data-testid="game-tile-rijec-dana"]').exists()).toBe(false)
    page.unmount()
  })
})
