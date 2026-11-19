import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from '#imports'
import type { CardPool, PoolCard } from '../shared/utils/learn/types'
import { LEARN_STORAGE_KEY } from '../app/composables/useLearnState'
import { buildLearnReviewQuestion } from '../shared/utils/learn/reviewQuestion'
import LearnSession from '../app/pages/uci/sesija.vue'

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
  const words = Array.from({ length: count }, (_, i) => word(`w${i}`, `riječ${i}`))
  const village: PoolCard = { kind: 'place', key: 'place:p1', id: 'p1', topics: ['mjesta'], name: 'Šopron', slug: 'sopron', municipalityId: 'm1', lat: 46, lng: 16, itemCount: 1, seat: false, difficulty: 2 }
  return {
    version: 1,
    generatedAt: T,
    cards: [...words, village],
    municipalities: [],
    settlements: [{ id: 's1', name: 'Šopron', slug: 'sopron', municipalityId: 'm1' }],
    topics: [{ id: 'rijeci', label: 'Riječi', status: 'live', count: words.length }, { id: 'mjesta', label: 'Mjesta', status: 'live', count: 1 }]
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
  await page.get('[data-testid="learn-card-front"]').trigger('click')
  await page.get(`[data-testid="learn-${knew ? 'known' : 'unknown'}"]`).trigger('click')
}

describe('learn session page', () => {
  it('runs setup through ten answers to the summary', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?teme=rijeci&n=10'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists(), { timeout: 5000 }).toBe(true)
    for (let i = 0; i < 10; i++) await flipAndAnswer(wrapper!, true)
    await expect.poll(() => wrapper!.find('[data-testid="learn-summary"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('Odlično, 10 od 10 znaš.')
    expect(wrapper!.get('[data-testid="learn-stat-known"]').text()).toContain('10')
    expect(wrapper!.get('[data-testid="learn-summary-more"]').text()).toBe('Nova sesija')
  })

  it('requeues a missed card exactly once in the queue', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?teme=rijeci&n=3'
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
      route: '/uci/sesija?nastavi=1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('Kartica 4 od 10')
  })

  it('preserves kartice query order and ignores invalid keys', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?kartice=word:w2,word:w0,bad'
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
      route: '/uci/sesija?nastavi=1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-review-card"]').exists()).toBe(true)
    expect(wrapper!.text()).toContain('Odaberi točan odgovor')
    const question = buildLearnReviewQuestion(pool, 'word:w0')!
    await wrapper!.get(`[data-testid="game-option-${question.correct}"]`).trigger('click')
    // The round never advances by itself: feedback shows and Dalje (here the last one) moves on.
    await expect.poll(() => wrapper!.find('[data-testid="game-feedback"]').exists()).toBe(true)
    expect(wrapper!.find('[data-testid="learn-summary"]').exists()).toBe(false)
    expect(wrapper!.get('[data-testid="game-next"]').text()).toBe('Pogledaj rezultat')
    await wrapper!.get('[data-testid="game-next"]').trigger('click')
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
      route: '/uci/sesija?nastavi=1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-review-card"]').exists()).toBe(true)
    const question = buildLearnReviewQuestion(pool, 'word:w0')!
    const wrongIndex = question.options.findIndex((_, index) => index !== question.correct)
    await wrapper!.get(`[data-testid="game-option-${wrongIndex}"]`).trigger('click')
    await expect.poll(() => wrapper!.find('[data-testid="game-feedback"]').exists()).toBe(true)
    await expect.poll(() => {
      const stored = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!)
      return stored.current?.results?.['word:w0']
    }).toBe('missed')
  })

  it('shows Još ne znam and Znam only after the card is turned, with an explicit text position', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?teme=rijeci&n=5'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-counter"]').text()).toContain('Kartica 1 od 5 · Što znači?')
    expect(wrapper!.find('[data-testid="learn-known"]').exists()).toBe(false)
    expect(wrapper!.get('[data-testid="learn-reveal"]').text()).toBe('Pokaži značenje')
    expect(wrapper!.get('[data-testid="learn-card"]').attributes('data-flipped')).toBe('false')
    await wrapper!.get('[data-testid="learn-reveal"]').trigger('click')
    expect(wrapper!.get('[data-testid="learn-card"]').attributes('data-flipped')).toBe('true')
    expect(wrapper!.find('[data-testid="learn-reveal"]').exists()).toBe(false)
    expect(wrapper!.get('[data-testid="learn-known"]').text()).toBe('Znam')
    expect(wrapper!.get('[data-testid="learn-unknown"]').text()).toBe('Još ne znam')
    expect(wrapper!.findAll('[data-testid="word-suggest-correction"]')).toHaveLength(1)
  })

  it('asks Što znači? only above word cards', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?teme=mjesta&n=5'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-counter"]').text()).toContain('Kartica 1 od 1')
    expect(wrapper!.get('[data-testid="learn-counter"]').text()).not.toContain('Što znači?')
    expect(wrapper!.get('[data-testid="learn-reveal"]').text()).toBe('Pokaži odgovor')
    await wrapper!.get('[data-testid="learn-reveal"]').trigger('click')
    expect(wrapper!.findAll('[data-testid="learn-open-record"]')).toHaveLength(1)
  })

  it('lists the missed cards with a link and a count in the summary', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?kartice=word:w0,word:w1'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    await flipAndAnswer(wrapper!, true)
    await flipAndAnswer(wrapper!, false)
    // The missed card returns once in the queue; answering it correctly ends the session with it still marked missed.
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    await flipAndAnswer(wrapper!, false)
    await expect.poll(() => wrapper!.find('[data-testid="learn-summary"]').exists()).toBe(true)
    expect(wrapper!.get('[data-testid="learn-stat-known"]').text()).toContain('1')
    expect(wrapper!.get('[data-testid="learn-stat-review"]').text()).toContain('1')
    expect(wrapper!.findAll('[data-testid="learn-review-row"]')).toHaveLength(1)
    expect(wrapper!.text()).toContain('riječ1')
    expect(wrapper!.get('[data-testid="learn-summary-repeat"]').exists()).toBe(true)
  })

  it('keeps the mjesto query from the settlement page for the session', async () => {
    wrapper = await mountSuspended(LearnSession, {
      route: '/uci/sesija?teme=rijeci&n=5&mjesto=sopron'
    })
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    const stored = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!)
    expect(stored.current.place).toBe('sopron')
    // A word card offers "I kod nas se tako kaže" for that village once it is turned.
    await wrapper!.get('[data-testid="learn-card-front"]').trigger('click')
    expect(wrapper!.text()).toContain('I kod nas se tako kaže')
  })
})
