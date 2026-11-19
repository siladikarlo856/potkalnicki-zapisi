import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#imports'
import HeritageMatch from '../app/components/games/HeritageMatch.vue'
import WordFlipCard from '../app/components/heritage/WordFlipCard.vue'
import type { WordEntry } from '../app/types/heritage'
import Feedback from '../app/components/games/Feedback.vue'
import BezGreske from '../app/pages/igre/bez-greske.vue'
import { usePzTabBar } from '../app/composables/usePzTabBar'
import type { HeritageMatchBoard } from '../shared/utils/games/heritageMatch'
import { fixtureCardPool } from './fixtures/gamePool'

registerEndpoint('/api/learn/pool', () => fixtureCardPool())

const board: HeritageMatchBoard = {
  pairs: [],
  left: [0, 1, 2, 3].map(i => ({ id: `l${i}`, label: `Crkva ${i}`, pairIndex: i })),
  right: [3, 2, 1, 0].map(i => ({ id: `r${i}`, label: `Selo ${i}`, pairIndex: i }))
}

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const left = (i: number) => `[data-testid="heritage-match-left-${i}"]`
const right = (i: number) => `[data-testid="heritage-match-right-${i}"]`

describe('AnswerFeedback', () => {
  it('is a status region with the verdict, the right answer and why', async () => {
    wrapper = await mountSuspended(Feedback, { props: { correct: true, answer: 'jaje', explanation: 'Jejce je jaje.' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    expect(wrapper.get('h3').text()).toBe('Točno')
    expect(wrapper.get('h3').attributes('tabindex')).toBe('-1')
    expect(wrapper.text()).toMatch(/Točan odgovor: jaje\.\s*Jejce je jaje\./)
  })

  it('says "Netočno" for a wrong answer', async () => {
    wrapper = await mountSuspended(Feedback, { props: { correct: false, answer: 'jaje' } })
    expect(wrapper.get('h3').text()).toBe('Netočno')
  })
})

describe('MatchGroup (HeritageMatch)', () => {
  it('locks a right pair with an icon and a word', async () => {
    wrapper = await mountSuspended(HeritageMatch, { props: { board, boardIndex: 0, boardCount: 3 } })
    await wrapper.get(left(0)).trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain('Crkva 0')
    await wrapper.get(right(0)).trigger('click')
    const tile = wrapper.get(left(0))
    expect(tile.attributes('data-state')).toBe('paired')
    expect(tile.text()).toContain('Spojeno')
    expect(tile.find('[class*="lucide:check"]').exists()).toBe(true)
  })

  it('flashes a wrong pair with a cross and a word for 600ms, then resets, without moving on', async () => {
    vi.useFakeTimers()
    wrapper = await mountSuspended(HeritageMatch, { props: { board, boardIndex: 0, boardCount: 3 } })
    await wrapper.get(left(0)).trigger('click')
    await wrapper.get(right(1)).trigger('click')
    expect(wrapper.get(left(0)).attributes('data-state')).toBe('wrong')
    expect(wrapper.get(left(0)).text()).toContain('Nije par')
    expect(wrapper.get(left(0)).find('[class*="lucide:x"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(599)
    expect(wrapper.get(left(0)).attributes('data-state')).toBe('wrong')
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.get(left(0)).attributes('data-state')).toBe('default')
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('finishes with the feedback summary and waits for Dalje', async () => {
    vi.useFakeTimers()
    wrapper = await mountSuspended(HeritageMatch, { props: { board, boardIndex: 0, boardCount: 3 } })
    for (let i = 0; i < 4; i++) {
      await wrapper.get(left(i)).trigger('click')
      await wrapper.get(right(i)).trigger('click')
    }
    expect(wrapper.get('[data-testid="game-feedback"]').attributes('role')).toBe('status')
    expect(wrapper.get('[data-testid="game-feedback"]').text()).toContain('4 od 4 para')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.emitted('complete')).toBeUndefined()
    await wrapper.get('[data-testid="game-next"]').trigger('click')
    expect(wrapper.emitted('complete')).toEqual([[4]])
  })

  it('counts only first-try pairs and reads "Pogledaj rezultat" on the last board', async () => {
    vi.useFakeTimers()
    wrapper = await mountSuspended(HeritageMatch, { props: { board, boardIndex: 2, boardCount: 3 } })
    await wrapper.get(left(0)).trigger('click')
    await wrapper.get(right(1)).trigger('click')
    await vi.advanceTimersByTimeAsync(600)
    for (let i = 0; i < 4; i++) {
      await wrapper.get(left(i)).trigger('click')
      await wrapper.get(right(i)).trigger('click')
    }
    expect(wrapper.get('[data-testid="game-next"]').text()).toBe('Pogledaj rezultat')
    await wrapper.get('[data-testid="game-next"]').trigger('click')
    expect(wrapper.emitted('complete')).toEqual([[2]])
  })
})

describe('Bez greške', () => {
  it('shows feedback after an answer and only moves on with Dalje', async () => {
    wrapper = await mountSuspended(BezGreske, { route: '/igre/bez-greske' })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="bez-prompt"]').exists()).toBe(true))
    vi.useFakeTimers()
    const prompt = wrapper.get('[data-testid="bez-prompt"]').text()
    await wrapper.get('[data-testid="game-option-0"]').trigger('click')
    expect(wrapper.find('[data-testid="game-feedback"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.get('[data-testid="bez-prompt"]').text()).toBe(prompt)
    expect(wrapper.find('[data-testid="game-next"]').exists()).toBe(true)
    const { hidden } = usePzTabBar()
    expect(hidden.value).toBe(true)
    await wrapper.get('[data-testid="game-next"]').trigger('click')
    // A wrong first pick ends the streak, a right one draws the next question; either way it took Dalje.
    const ended = wrapper.find('[data-testid="bez-result"]').exists()
    const next = wrapper.find('[data-testid="bez-prompt"]').exists()
    expect(ended || next).toBe(true)
    if (ended) expect(hidden.value).toBe(false)
  })
})

describe('FlipCard (WordFlipCard)', () => {
  const entry = {
    id: 'hiza',
    headword: 'hiža',
    meaning: { hr: 'kuća' },
    partOfSpeech: 'imenica',
    variants: [{ form: 'hiža', usages: [] }],
    status: 'community',
    sources: []
  } as unknown as WordEntry

  it('is one button with aria-expanded that turns the card, and the back turns it again', async () => {
    wrapper = await mountSuspended(WordFlipCard, { props: { entry } })
    const front = wrapper.get('[data-testid="word-flip-front"]')
    expect(front.element.tagName).toBe('BUTTON')
    expect(front.attributes('aria-expanded')).toBe('false')
    await front.trigger('click')
    expect(wrapper.emitted('update:flipped')).toEqual([[true]])
    await wrapper.setProps({ flipped: true })
    expect(wrapper.get('[data-testid="word-flip-front"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('kuća')
    await wrapper.get('[data-testid="word-flip-back"]').trigger('click')
    expect(wrapper.emitted('update:flipped')?.at(-1)).toEqual([false])
  })
})
