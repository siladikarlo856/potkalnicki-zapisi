import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useNuxtApp } from '#imports'
import Challenge from '../app/components/heritage/ChallengeExperience.vue'
import type { ChallengeState } from '../shared/utils/challenge'

const code = 'componentproof1234'
let phase: 'ready' | 'question' = 'ready'
const snapshot = (): ChallengeState => ({
  code, title: { hr: 'Moj izazov', en: 'My challenge' }, sample: true,
  createdAt: '2026-10-30T12:00:00Z', closesAt: '2026-11-06T12:00:00Z', closed: false,
  questionCount: 15, maxScore: 1500, targetScore: null,
  rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 5 }],
  participant: { nickname: 'Ana', phase, index: 0, total: 0, completedAt: null, rounds: [] },
  question: phase === 'question' ? { id: 'q1', prompt: { hr: 'Pitanje?', en: 'Question?' }, options: ['A', 'B', 'C', 'D'].map(v => ({ hr: v, en: v })), round: 0, number: 1 } : null,
  feedback: null
})
registerEndpoint(`/api/challenges/${code}`, () => snapshot())
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
  Object.defineProperty(navigator, 'clipboard', clipboardDescriptor ?? { configurable: true, value: undefined })
  Object.defineProperty(navigator, 'share', shareDescriptor ?? { configurable: true, value: undefined })
})

describe.each(['hr', 'en'] as const)('%s early challenge sharing', (locale) => {
  it.each(['ready', 'question'] as const)('offers copy, native share, close date and scoreboard in the %s phase', async (nextPhase) => {
    phase = nextPhase
    await useNuxtApp().$i18n.setLocale(locale)
    const prefix = locale === 'en' ? '/en' : ''
    wrapper = await mountSuspended(Challenge, { props: { code }, route: `${prefix}/heritage/challenge/${code}` })
    await expect.poll(() => wrapper!.find('[data-testid="challenge-share"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="challenge-finish"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="challenge-scoreboard-link"]').attributes('href')).toBe(`${prefix}/heritage/challenge/${code}/leaderboard`)
    expect(wrapper.text()).toContain(locale === 'hr' ? 'Otvoren do' : 'Open until')
    expect(wrapper.find(`a[href="${prefix}/heritage/challenge"]`).exists()).toBe(true)
    const link = wrapper.get('[data-testid="challenge-share"] input[readonly]').element as HTMLInputElement
    expect(link.value).toContain(`${prefix}/heritage/challenge/${code}`)
    await wrapper.get('[data-testid="challenge-copy"]').trigger('click')
    expect(copy).toHaveBeenCalledWith(link.value)
    await wrapper.get('[data-testid="challenge-native-share"]').trigger('click')
    expect(share).toHaveBeenCalledWith({ title: locale === 'hr' ? 'Izazov zavičaja' : 'Heritage challenge', url: link.value })
  })
})
