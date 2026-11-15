import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#imports'
import type { CardPool, PoolCard } from '../shared/utils/learn/types'
import { LEARN_STORAGE_KEY } from '../app/composables/useLearnState'
import { PROGRESS_STORAGE_KEY } from '../app/composables/useProgress'
import LearnHomePanel from '../app/components/learn/HomePanel.vue'

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
    'pz-learn-state',
    'pz-learn-loaded',
    'card-pool'
  ])
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

describe('learn home panel', () => {
  it('shows continue and new-lesson buttons with distinct labels when a session exists', async () => {
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({
      version: 1,
      current: {
        topics: ['rijeci'],
        n: 10,
        queue: pool.cards.slice(0, 10).map(c => c.key),
        index: 1,
        requeued: [],
        results: { 'word:w0': 'known' },
        startedAt: T,
        mode: 'new'
      },
      lastTopics: ['rijeci'],
      lastN: 10
    }))
    wrapper = await mountSuspended(LearnHomePanel, {
      props: { pool },
      route: ''
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-state-a"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-home-continue"]').text()).toContain('Nastavi lekciju')
    expect(wrapper!.get('[data-testid="learn-home-new-lesson"]').text()).toContain('Započni novu lekciju')
  })

  it('shows review state when due cards exist without a current session', async () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      cards: {
        'word:w0': { box: 1, due: '2026-11-03', seen: 1, known: 0, missed: 1, lastPlayed: '2026-11-03' }
      },
      lastPlayed: '2026-11-03',
      streak: 1
    }))
    wrapper = await mountSuspended(LearnHomePanel, {
      props: { pool },
      route: ''
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-state-b"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-home-review"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-home-new-lesson"]').exists()).toBe(true)
  })

  it('shows first lesson state for empty progress', async () => {
    wrapper = await mountSuspended(LearnHomePanel, {
      props: { pool },
      route: ''
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-state-c"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-home-first"]').exists()).toBe(true)
  })

  it('hides the top block when progress exists but nothing is due', async () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      cards: {
        'word:w0': { box: 2, due: '2026-12-01', seen: 1, known: 1, missed: 0, lastPlayed: '2026-11-04' }
      },
      lastPlayed: '2026-11-04',
      streak: 1
    }))
    wrapper = await mountSuspended(LearnHomePanel, {
      props: { pool },
      route: ''
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-new-block"]').exists()).toBe(true)
    expect(wrapper!.find('[data-testid="learn-home-state-a"]').exists()).toBe(false)
    expect(wrapper!.find('[data-testid="learn-home-state-b"]').exists()).toBe(false)
    expect(wrapper!.find('[data-testid="learn-home-state-c"]').exists()).toBe(false)
  })
})
