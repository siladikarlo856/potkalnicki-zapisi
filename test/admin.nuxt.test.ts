import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ReviewWords from '../app/pages/review-words.vue'
import Review from '../app/pages/review.vue'
import sampleWords from '../content/heritage/words.json'
import sampleAreas from '../content/heritage/areas.json'

const word = sampleWords[0]!
const submission = {
  id: 7, text: 'Moja riječ', type: null, place: null, placeId: null, name: null, contact: null,
  locale: 'hr', consentPublish: true, consentVersion: 'v1', status: 'pending', createdAt: '2026-10-30 10:00:00'
}

registerEndpoint('/api/review/words', () => [{
  entry: word, areas: sampleAreas, active: true, submissionId: null, submissionPlace: null, createdAt: '2026-10-30', updatedAt: '2026-10-30'
}])
registerEndpoint('/api/review/submissions', () => [submission])

beforeEach(() => sessionStorage.setItem('review-secret', 'x'))
afterEach(() => sessionStorage.clear())

describe('admin tables', () => {
  for (const [name, page, label] of [['words', ReviewWords, word.headword], ['submissions', Review, 'Moja riječ']] as const) {
    it(`${name}: row click and info button toggle the expanded row`, async () => {
      const wrapper = await mountSuspended(page)
      await vi.waitFor(() => expect(wrapper.text()).toContain(label))
      const info = wrapper.find('button[aria-label^="Detalji"]')
      expect(info.attributes('aria-expanded')).toBe('false')
      await info.trigger('click')
      expect(wrapper.find('button[aria-label^="Detalji"]').attributes('aria-expanded')).toBe('true')
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
      await info.trigger('click')
      expect(wrapper.findAll('tbody tr')).toHaveLength(1)
      await wrapper.find('tbody tr').trigger('click')
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    })
  }
})
