import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useNuxtData } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import { LEARN_STORAGE_KEY } from '../app/composables/useLearnState'
import { PROGRESS_STORAGE_KEY } from '../app/composables/useProgress'
import type { CardPool } from '../shared/utils/learn/types'
import type { CardProgress } from '../shared/utils/learn/leitner'
import type { DailyWordPayload } from '../shared/utils/dailyWord'
import { createSession } from '../shared/utils/learn/learnState'
import LearnSetup from '../app/pages/uci/index.vue'
import LearnSession from '../app/pages/uci/sesija.vue'
import PlayHub from '../app/pages/igraj/index.vue'
import DailyPage from '../app/pages/rijec-dana/index.vue'
import LearnHomePanel from '../app/components/learn/HomePanel.vue'

const pool: CardPool = {
  version: 1, generatedAt: '', municipalities: [],
  settlements: [
    { id: 's1', slug: 'first', name: 'Prvo', municipalityId: 'm1' },
    { id: 's2', slug: 'second', name: 'Drugo', municipalityId: 'm2' }
  ],
  cards: [
    { kind: 'word', key: 'word:fresh', id: 'fresh', topics: ['rijeci'], headword: 'hiža', meaning: 'kuća', variants: [], status: 'verified', transparency: 0.5, difficulty: 2 },
    { kind: 'item', key: 'item:church', id: 'church', topics: ['bastina'], name: 'Crkva', path: '/bastina/crkva/', categoryKey: 'church', categoryLabel: 'Crkva', settlementId: 's1', municipalityId: 'm1', verification: 'verified', difficulty: 1 },
    { kind: 'person', key: 'person:soon', id: 'soon', topics: ['osobe'], name: 'Osoba', slug: 'osoba', years: '', clue: '', role: '', areaIds: ['s1'], verification: 'verified' }
  ],
  topics: [
    { id: 'rijeci', label: 'Riječi', status: 'live', count: 1 },
    { id: 'bastina', label: 'Baština', status: 'live', count: 1 },
    { id: 'osobe', label: 'Osobe', status: 'soon', count: 1 }
  ]
}

const daily: DailyWordPayload = {
  day: '2026-11-19', number: 18, nextAt: '2026-11-20T23:00:00.000Z', sample: false,
  entry: { id: 'fresh', headword: 'hiža', meaning: { hr: 'kuća' }, status: 'verified', sources: [], variants: [] },
  areas: [], villageAreaId: null, options: [], correctOptionId: '', clues: []
}
registerEndpoint('/api/learn/pool', () => pool)
registerEndpoint('/api/heritage/daily', () => daily)

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const card = (due = '2026-11-18'): CardProgress => ({ box: 2, due, seen: 1, known: 1, missed: 0, lastPlayed: '2026-11-18' })

function saveProgress(cards: Record<string, CardProgress>) {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, cards, lastPlayed: '2026-11-18', streak: 1 }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-19T12:00:00'))
  localStorage.clear()
  clearNuxtState(['heritage-progress', 'heritage-progress-loaded', 'pz-learn-state', 'pz-learn-loaded', 'heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable'])
  clearNuxtData('card-pool')
  clearNuxtData('heritage-daily-word')
  saveProgress({ 'item:church': card(), 'word:removed': card(), 'person:soon': card() })
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-19': { wordId: 'fresh', guesses: ['hiža'], done: true, solved: true, tries: 1, maxTries: 5 } } }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

function rememberPlace(place: string) {
  localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({ version: 1, current: null, lastTopics: ['rijeci'], lastN: 10, place }))
}

describe('review eligibility across learning surfaces', () => {
  it.each(['first', 'second', 'unknown'])('uses the selected place %s for hub counts, review visibility and the daily count', async (place) => {
    rememberPlace(place)
    const due = place === 'first' ? 1 : 0
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-hub"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="learn-today"] dd').text()).toBe(String(due))
    expect(wrapper.find('[data-testid="learn-home-review"]').exists()).toBe(due > 0)
    expect(wrapper.find('[data-testid="learn-home-new-lesson"]').exists()).toBe(due === 0)
    for (const link of wrapper.findAll('[data-testid="learn-topic-row"], [data-testid="learn-home-review"], [data-testid="learn-home-new-lesson"]')) {
      expect(new URL(link.attributes('href')!, 'https://example.test').searchParams.get('mjesto')).toBe(place)
    }
    wrapper.unmount()

    wrapper = await mountSuspended(PlayHub, { route: '/igraj/' })
    await expect.poll(() => wrapper!.get('[data-testid="hub-learn"]').text()).toContain(`${due} ${due === 1 ? 'riječ čeka' : 'riječi čeka'} ponavljanje`)
    expect(wrapper.get('[data-testid="hub-learn-continue"]').attributes('href')).toBe(due ? '/uci/sesija/?ponovi=1' : '/uci/')
    wrapper.unmount()

    wrapper = await mountSuspended(LearnHomePanel, { props: { pool } })
    expect(wrapper.find('[data-testid="learn-home-review"]').exists()).toBe(due > 0)
    expect(wrapper.find('[data-testid="learn-home-new-lesson"]').exists()).toBe(true)
    wrapper.unmount()

    wrapper = await mountSuspended(DailyPage, { route: '/rijec-dana/' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-result"]').exists()).toBe(true)
    expect(wrapper.text()).toContain(due ? '1 riječi čeka ponavljanje' : 'Kartice s riječima domaćega govora')
    expect(wrapper.text()).not.toContain('3 riječi čeka ponavljanje')
  })

  it.each(['review', 'topic', 'new', 'first', 'continue'])('carries a query-place override through the %s action into the runner', async (action) => {
    rememberPlace('second')
    if (action === 'new') saveProgress({ 'word:fresh': card('2026-11-22') })
    if (action === 'first') localStorage.removeItem(PROGRESS_STORAGE_KEY)
    if (action === 'continue') {
      const state = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!)
      state.current = createSession(['bastina'], 5, ['item:church'], 'new', 'first')
      localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(state))
    }
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/?mjesto=first&teme=bastina' })
    const selector = action === 'first'
      ? '[data-testid="learn-setup-start"]'
      : action === 'new'
        ? '[data-testid="learn-home-new-lesson"]'
        : action === 'continue'
          ? '[data-testid="learn-home-continue"]'
          : action === 'topic' ? '[data-testid="learn-topic-row"]' : '[data-testid="learn-home-review"]'
    await expect.poll(() => wrapper!.find(selector).exists()).toBe(true)
    const link = action === 'topic'
      ? wrapper.findAll(selector).find(link => new URL(link.attributes('href')!, 'https://example.test').searchParams.get('teme') === 'bastina')!
      : wrapper.get(selector)
    const href = link.attributes('href')!
    expect(new URL(href, 'https://example.test').searchParams.get('mjesto')).toBe('first')
    wrapper.unmount()
    wrapper = await mountSuspended(LearnSession, { route: href })
    await expect.poll(() => JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!).current?.queue).toEqual(['item:church'])
    expect(JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!).current.place).toBe('first')
  })

  it('updates an unavailable review when the place filter is cleared', async () => {
    rememberPlace('second')
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-hub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="learn-home-review"]').exists()).toBe(false)
    await wrapper.get('[data-testid="learn-place"] button').trigger('click')
    expect(wrapper.get('[data-testid="learn-today"] dd').text()).toBe('1')
    expect(wrapper.find('[data-testid="learn-home-review"]').exists()).toBe(true)
    for (const link of wrapper.findAll('[data-testid="learn-topic-row"], [data-testid="learn-home-review"]')) {
      expect(new URL(link.attributes('href')!, 'https://example.test').searchParams.has('mjesto')).toBe(false)
    }
  })

  it.each(['more', 'more-desktop', 'repeat'])('keeps the session settlement through the %s restart and the next summary', async (action) => {
    rememberPlace('second')
    saveProgress({ 'word:fresh': card('2026-11-22') })
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/?mjesto=first&teme=bastina' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-new-lesson"]').exists()).toBe(true)
    const href = wrapper.get('[data-testid="learn-home-new-lesson"]').attributes('href')!
    wrapper.unmount()
    wrapper = await mountSuspended(LearnSession, { route: href })

    async function finishRound() {
      await expect.poll(() => wrapper!.find('[data-testid="learn-card-front"]').exists()).toBe(true)
      await wrapper!.get('[data-testid="learn-card-front"]').trigger('click')
      await wrapper!.get('[data-testid="learn-unknown"]').trigger('click')
      await wrapper!.get('[data-testid="learn-card-front"]').trigger('click')
      await wrapper!.get('[data-testid="learn-known"]').trigger('click')
      await expect.poll(() => wrapper!.find('[data-testid="learn-summary"]').exists()).toBe(true)
    }

    await finishRound()
    await wrapper.get(`[data-testid="learn-summary-${action}"]`).trigger('click')
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    const restarted = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!).current
    expect(restarted.place).toBe('first')
    expect(restarted.queue).toEqual(['item:church'])
    expect(restarted.mode).toBe(action === 'repeat' ? 'list' : 'new')

    await finishRound()
    await wrapper.get('[data-testid="learn-summary-more"]').trigger('click')
    await expect.poll(() => wrapper!.find('[data-testid="learn-runner"]').exists()).toBe(true)
    const next = JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!).current
    expect(next.place).toBe('first')
    expect(next.queue).toEqual(action === 'repeat' ? ['word:fresh'] : ['item:church'])
  })

  it('forecasts only eligible future cards and keeps a new lesson available', async () => {
    rememberPlace('second')
    saveProgress({
      'item:church': card('2026-11-20'), 'word:removed': card('2026-11-20'),
      'person:soon': card('2026-11-20'), 'word:fresh': card('2026-11-22')
    })
    wrapper = await mountSuspended(LearnSetup, { route: '/uci/' })
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-next-review"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="learn-home-next-review"]').text()).toBe('Sljedeće ponavljanje: za 3 dana, 1 karticu.')
    expect(wrapper.find('[data-testid="learn-home-new-lesson"]').exists()).toBe(true)
    useNuxtData<CardPool>('card-pool').data.value = { ...pool, cards: [] }
    await expect.poll(() => wrapper!.find('[data-testid="learn-home-next-review"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="learn-home-new-lesson"]').exists()).toBe(true)
  })
})
