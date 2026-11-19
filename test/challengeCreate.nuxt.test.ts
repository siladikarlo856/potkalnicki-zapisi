import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import CreateChallenge from '../app/pages/izazov/novi.vue'
import type { ChallengeSetPublic } from '../shared/utils/challenge'
import type { CardPool } from '../shared/utils/learn/types'

const sets: ChallengeSetPublic[] = [
  {
    id: 'sample-template',
    title: { hr: 'Koliko poznaješ naš kraj?', en: 'How well do you know our region?' },
    sample: true,
    rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 5 }]
  },
  {
    id: 'ordinary-template',
    title: { hr: 'Riječi našega kraja', en: 'Words of our region' },
    sample: false,
    rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 5 }]
  }
]
const pool: CardPool = {
  version: 1,
  generatedAt: '2026-11-19T12:00:00Z',
  cards: [],
  municipalities: [],
  settlements: [],
  topics: []
}
registerEndpoint('/api/challenges/sets', () => sets)
registerEndpoint('/api/learn/pool', () => pool)

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('challenge template chooser', () => {
  it('discloses Sample templates with a visible, accessible label before and after selection', async () => {
    wrapper = await mountSuspended(CreateChallenge, { route: '/izazov/novi/' })
    await expect.poll(() => wrapper!.find('[data-testid="challenge-source-set"]').exists()).toBe(true)
    await wrapper.get('[data-testid="challenge-source-set"] input').setValue(true)

    const sample = wrapper.get('button[data-set-id="sample-template"]')
    const ordinary = wrapper.get('button[data-set-id="ordinary-template"]')
    const label = sample.get('[data-testid="sample-label"]')
    expect(label.text()).toBe('Uzorak')
    expect(label.isVisible()).toBe(true)
    expect(label.element.closest('[aria-hidden="true"], [hidden], [inert]')).toBeNull()
    expect(sample.attributes('aria-label')).toBeUndefined()
    expect(ordinary.find('[data-testid="sample-label"]').exists()).toBe(false)
    expect(sample.attributes('aria-pressed')).toBe('false')

    await sample.trigger('click')
    expect(sample.attributes('aria-pressed')).toBe('true')
    expect(sample.text()).toContain('Uzorak')
    expect(label.isVisible()).toBe(true)

    await ordinary.trigger('click')
    expect(ordinary.attributes('aria-pressed')).toBe('true')
    expect(sample.attributes('aria-pressed')).toBe('false')
    expect(sample.text()).toContain('Uzorak')
    expect(ordinary.text()).not.toContain('Uzorak')
  })
})
