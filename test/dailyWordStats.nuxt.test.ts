import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useNuxtApp } from '#imports'
import Hub from '../app/pages/igre/index.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

const payload: DailyWordPayload = {
  day: '2026-11-11', number: 12, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
  entry: {
    id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }], category: 'house', examples: [{ text: 'Idem v hižu.' }],
    variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [{ areaId: 'vil-a', confidence: 'reported' }] }]
  },
  areas: [{ id: 'vil-a', name: 'Selo A', kind: 'settlement', parentId: null }], villageAreaId: null,
  options: [
    { id: 'a', text: { hr: 'pas', en: 'dog' } }, { id: 'b', text: { hr: 'stol', en: 'table' } },
    { id: 'c', text: { hr: 'kuća', en: 'house' } }, { id: 'd', text: { hr: 'mlijeko', en: 'milk' } }
  ],
  correctOptionId: 'c',
  clues: [{ kind: 'example', text: 'Idem v hižu.' }, { kind: 'category', category: 'house' }]
}
registerEndpoint('/api/heritage/daily', () => payload)
registerEndpoint('/api/heritage/words', () => ({ words: [], areas: payload.areas }))

const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('daily word on the games hub', () => {
  it('links to the Riječ dana page instead of hosting a second round', async () => {
    await useNuxtApp().$i18n.setLocale('hr')
    wrapper = await mountSuspended(Hub, { route: '/igre' })
    const dailySection = wrapper.get('#rijec-dana')
    expect(dailySection.find('[data-option-id]').exists()).toBe(false)
    expect(dailySection.get('a').attributes('href')).toBe('/rijec-dana/')
  })
})
