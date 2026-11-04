import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#imports'
import type { CardPool, PoolCard } from '../shared/utils/learn/types'
import { LEARN_STORAGE_KEY } from '../app/composables/useLearnState'
import { buildLearnReviewQuestion } from '../shared/utils/learn/reviewQuestion'
import LearnSession from '../app/pages/potkalnicko-prigorje/uci/sesija.vue'

const T = '2026-11-04T12:00:00.000Z'

function word(id: string, headword: string): PoolCard {
  return {
    kind: 'word',
    key: `word:${id}`,
    id,
    topics: ['rijeci'],
    headword,
    meaning: `značenje ${headword}`,
    variants: [],
    status: 'verified',
    transparency: 0.5,
    difficulty: 2
  }
}

function testPool(count: number): CardPool {
  const cards = Array.from({ length: count }, (_, i) => word(`w${i}`, `riječ${i}`))
  return {
    version: 1,
    generatedAt: T,
    cards,
    municipalities: [],
    settlements: [],
    topics: [{ id: 'rijeci', label: 'Riječi', status: 'live', count: cards.length }]
  }
}

const pool = testPool(12)
registerEndpoint('/api/learn/pool', () => pool)

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T10:00:00'))
  localStorage.clear()
  clearNuxtState([
    'heritage-progress',
    'heritage-progress-loaded',
    'pz-progress',
    'pz-progress-loaded',
    'pz-learn-state',
    'pz-learn-loaded',
    'card-pool'
  ])
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

async function flipAndAnswer(page: Awaited<ReturnType<typeof mountSuspended>>, knew: boolean) {
  await page.get('[data-testid="learn-card"]').trigger('click')
  const flip = page.findAll('button').find(b => b.text().includes('Okreni'))!
  await flip.trigger('click')
  await page.get(`[data-testid="learn-${knew ? 'known' : 'unknown'}"]`).trigger('click')
}

describe('learn session page', () => {
  it('runs setup through ten answers to the summary', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/potkalnicko-prigorje/uci/sesija?teme=rijeci&n=10'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists(), { timeout: 5000 }).toBe(true)
    for (let i = 0; i < 10; i++) await flipAndAnswer(wrapper!, true)
    await expect.poll(() => wrapper!.find('[data-testid="learn-summary"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('Gotovo! Znaš 10 od 10.')
  })

  it('requeues a missed card exactly once in the queue', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/potkalnicko-prigorje/uci/sesija?teme=rijeci&n=3'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    await flipAndAnswer(wrapper!, false)
    const stored = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!)
    expect(stored.current.requeued).toEqual(['word:w0'])
    expect(stored.current.queue.filter((k: string) => k === 'word:w0').length).toBe(2)
  })

  it('resumes current session at the same card index', async () => {
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({
      version: 1,
      current: {
        topics: ['rijeci'],
        n: 10,
        queue: pool.cards.slice(0, 10).map(c => c.key),
        index: 3,
        requeued: [],
        results: { 'word:w0': 'known', 'word:w1': 'known', 'word:w2': 'known' },
        startedAt: T,
        mode: 'new'
      },
      lastTopics: ['rijeci'],
      lastN: 10
    }))
    wrapper = await mountSuspended(LearnSession, {
      route: '/potkalnicko-prigorje/uci/sesija?nastavi=1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('Kartica 4 od 10')
  })

  it('preserves kartice query order and ignores invalid keys', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/potkalnicko-prigorje/uci/sesija?kartice=word:w2,word:w0,bad'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('riječ2')
  })

  it('shows multiple-choice options in review mode', async () => {
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({
      version: 1,
      current: {
        topics: ['rijeci'],
        n: 5,
        queue: ['word:w0'],
        index: 0,
        requeued: [],
        results: {},
        startedAt: T,
        mode: 'review'
      },
      lastTopics: ['rijeci'],
      lastN: 5
    }))
    wrapper = await mountSuspended(LearnSession, {
      route: '/potkalnicko-prigorje/uci/sesija?nastavi=1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-review-card"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('Odaberi točan odgovor')
    const question = buildLearnReviewQuestion(pool, 'word:w0')!
    await wrapper!.get(`[data-testid="game-option-${question.correct}"]`).trigger('click')
    await expect.poll(() => wrapper!.find('[data-testid="learn-summary"]').exists()).toBe(true)
  })

  it('records a wrong review option as missed', async () => {
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({
      version: 1,
      current: {
        topics: ['rijeci'],
        n: 5,
        queue: ['word:w0'],
        index: 0,
        requeued: [],
        results: {},
        startedAt: T,
        mode: 'review'
      },
      lastTopics: ['rijeci'],
      lastN: 5
    }))
    wrapper = await mountSuspended(LearnSession, {
      route: '/potkalnicko-prigorje/uci/sesija?nastavi=1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-review-card"]').exists()).toBe(true)
    const question = buildLearnReviewQuestion(pool, 'word:w0')!
    const wrongIndex = question.options.findIndex((_, index) => index !== question.correct)
    await wrapper!.get(`[data-testid="game-option-${wrongIndex}"]`).trigger('click')
    await expect.poll(() => {
      const stored = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!)
      return stored.current?.results?.['word:w0']
    }).toBe('missed')
  })
})
