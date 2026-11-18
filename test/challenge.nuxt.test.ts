import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import Challenge from '../app/components/heritage/ChallengeExperience.vue'
import { usePzTabBar } from '../app/composables/usePzTabBar'
import ChallengeShare from '../app/components/heritage/ChallengeShare.vue'
import type { ChallengeState } from '../shared/utils/challenge'

const code = 'componentproof1234'
let phase: 'ready' | 'question' = 'ready'
const snapshot = (): ChallengeState => ({
  code, title: { hr: 'Moj izazov', en: 'My challenge' }, sample: true,
  createdAt: '2026-10-30T12:00:00Z', closesAt: '2026-11-06T12:00:00Z', closed: false,
  questionCount: 15, maxScore: 1500, targetScore: null,
  rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 5 }],
  participant: { nickname: 'Ana', phase, index: 0, total: 0, completedAt: null, rounds: [] },
  question: phase === 'question'
    ? {
        id: 'q1',
        prompt: { hr: 'Koje je ovo selo?', en: 'Which village?' },
        options: ['A', 'B', 'C', 'D'].map(v => ({ hr: v, en: v })),
        round: 0,
        number: 1,
        display: { type: 'map-target', point: { lat: 46.05, lng: 16.5 } }
      }
    : null,
  feedback: null
})
registerEndpoint(`/api/challenges/${code}`, () => snapshot())
registerEndpoint('/api/challenges', () => ({
  ...snapshot(),
  participant: { nickname: 'Ana', phase: 'finished', index: 2, total: 100, completedAt: '2026-10-30T12:01:00Z', rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 2, answered: 2, score: 100 }] }
}))
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share')
const copy = vi.fn(async () => {})
const share = vi.fn(async () => {})
beforeEach(() => {
  copy.mockClear()
  share.mockClear()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
})
afterEach(() => {
  wrapper?.unmount()
  expect(usePzTabBar().hidden.value).toBe(false)
  Object.defineProperty(navigator, 'clipboard', clipboardDescriptor ?? { configurable: true, value: undefined })
  Object.defineProperty(navigator, 'share', shareDescriptor ?? { configurable: true, value: undefined })
})

describe('hr early challenge sharing', () => {
  it.each(['ready', 'question'] as const)('offers copy, native share, close date and scoreboard in the %s phase', async (nextPhase) => {
    phase = nextPhase
    await useNuxtApp().$i18n.setLocale('hr')
    wrapper = await mountSuspended(Challenge, { props: { code }, route: `/izazov/${code}` })
    await expect.poll(() => wrapper!.find('[data-testid="challenge-share"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="challenge-finish"]').exists()).toBe(false)
    // After "Kreni" the sticky action bar takes the tab bar's place.
    expect(usePzTabBar().holds.value).toEqual(['challenge'])
    expect(wrapper.get('[data-testid="challenge-scoreboard-link"]').attributes('href')).toBe(`/izazov/${code}/ljestvica/`)
    expect(wrapper.text()).toContain('Otvoren do')
    expect(wrapper.find('a[href="/izazov/"]').exists()).toBe(true)
    const link = wrapper.get('[data-testid="challenge-share"] input[readonly]').element as HTMLInputElement
    expect(link.value).toContain(`/izazov/${code}`)
    await wrapper.get('[data-testid="challenge-copy"]').trigger('click')
    expect(copy).toHaveBeenCalledWith(link.value)
    await wrapper.get('[data-testid="challenge-native-share"]').trigger('click')
    expect(share).toHaveBeenCalledWith({ title: 'Izazov zavičaja', url: link.value })
    expect(wrapper.get('[data-testid="challenge-whatsapp"]').attributes('href')).toContain('https://wa.me/?text=')
    expect(wrapper.get('[data-testid="challenge-viber"]').attributes('href')).toContain('viber://forward?text=')
    if (nextPhase === 'question') expect(wrapper.find('[data-testid="challenge-map"]').exists()).toBe(true)
    // One primary action per screen: Igraj prvi before the round, none beside the answers (Dalje follows the feedback).
    expect(wrapper.find('[data-testid="challenge-primary"]').exists()).toBe(nextPhase === 'ready')
    if (nextPhase === 'ready') expect(wrapper.get('[data-testid="challenge-primary"]').text()).toBe('Igraj prvi')
  })
})

describe('hr quiz challenge creation', () => {
  it('creates a completed challenge from the played round before offering every share action', async () => {
    await useNuxtApp().$i18n.setLocale('hr')
    wrapper = await mountSuspended(ChallengeShare, {
      props: {
        quiz: {
          questions: [
            { id: 'hiza', optionIds: ['hiza', 'vura'] },
            { id: 'vura', optionIds: ['hiza', 'vura'] }
          ],
          results: [true, false]
        }
      } as never,
      route: '/igre/kviz'
    })
    expect(wrapper.get('[data-testid="challenge-create"]').text()).toContain('Stvori izazov za prijatelja')
    await wrapper.get('input[name="nickname"]').setValue('Ana')
    await wrapper.get('[data-testid="challenge-create"] form').trigger('submit')
    await expect.poll(() => wrapper!.find('[data-testid="challenge-share-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="challenge-copy"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="challenge-native-share"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="challenge-whatsapp"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="challenge-viber"]').exists()).toBe(true)
  })
})
