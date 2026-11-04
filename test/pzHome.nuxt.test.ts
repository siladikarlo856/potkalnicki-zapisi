import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { clearNuxtData, clearNuxtState } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import { PZ_HOME_STORAGE_KEY } from '../app/composables/usePzHome'
import { CHALLENGE_LIST_STORAGE_KEY } from '../shared/utils/challengeList'
import Home from '../app/pages/potkalnicko-prigorje/index.vue'
import DailyWord from '../app/components/heritage/DailyWord.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'
import type { ChallengeState } from '../shared/utils/challenge'
import { registerAtlasApiEndpoints } from './helpers/registerAtlasApi'

registerAtlasApiEndpoints()

const areas = [
  { id: 'county', name: 'Županija', kind: 'county' as const, parentId: null },
  { id: 'vil-a', name: 'Selo A', kind: 'settlement' as const, parentId: 'county' }
]

function payload(over: Partial<DailyWordPayload> = {}): DailyWordPayload {
  return {
    day: '2026-11-11', number: 12, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
    entry: {
      id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }], category: 'house',
      note: { hr: 'Dolazi od njemačke riječi.', en: 'From a German word.' },
      examples: [{ text: 'Idem v hižu.', translation: 'Idem u kuću.' }],
      variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [{ areaId: 'vil-a', confidence: 'reported' }] }]
    },
    areas, villageAreaId: null,
    options: [
      { id: 'a', text: { hr: 'pas', en: 'dog' } },
      { id: 'b', text: { hr: 'stol', en: 'table' } },
      { id: 'c', text: { hr: 'kuća', en: 'house' } },
      { id: 'd', text: { hr: 'mlijeko' } }
    ],
    correctOptionId: 'c',
    clues: [{ kind: 'example', text: 'Idem v hižu.' }, { kind: 'category', category: 'house' }],
    ...over
  }
}

let current: DailyWordPayload | 'not-started' = payload()
registerEndpoint('/api/heritage/daily', () => {
  if (current === 'not-started') throw createError({ statusCode: 404, statusMessage: 'not-started' })
  return current
})
registerEndpoint('/api/heritage/words', () => ({ words: [], areas }))

const dailyStateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']
const homeStateKeys = ['pz-home-loaded', 'pz-home-tab', 'pz-challenge-list', 'pz-challenge-list-loaded', 'pz-challenge-leaderboard-counts']

function sectionOrder(page: Awaited<ReturnType<typeof mountSuspended>>) {
  return page.findAll('[data-testid]').map(node => node.attributes('data-testid'))
}

beforeEach(() => {
  current = payload()
  localStorage.clear()
  clearNuxtState([...dailyStateKeys, ...homeStateKeys])
  clearNuxtData('heritage-daily-word')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Potkalnički zapisi home (WP1)', () => {
  it('orders main sections for SSR and drops the hero buttons', async () => {
    const page = await mountSuspended(Home, { route: '/potkalnicko-prigorje' })
    const ids = sectionOrder(page)
    const daily = ids.indexOf('daily-word')
    const learnPlay = ids.indexOf('learn-play-switch')
    const friend = ids.indexOf('friend-challenge')
    const regions = ids.indexOf('pet-podrucja')
    const doprinos = ids.indexOf('doprinos')
    expect(daily).toBeGreaterThan(-1)
    expect(learnPlay).toBeGreaterThan(daily)
    expect(friend).toBeGreaterThan(learnPlay)
    expect(regions).toBeGreaterThan(friend)
    expect(doprinos).toBeGreaterThan(regions)
    expect(page.text()).toContain('Uči riječi iz našeg kraja')
    expect(page.text()).not.toContain('Igraj s riječima')
    expect(page.findComponent({ name: 'UPageHero' }).exists()).toBe(false)
    page.unmount()
  })

  it('shows the Igraj panel after mount when pz-home/v1 prefers igraj', async () => {
    localStorage.setItem(PZ_HOME_STORAGE_KEY, JSON.stringify({ version: 1, tab: 'igraj' }))
    const page = await mountSuspended(Home, { route: '/potkalnicko-prigorje' })
    expect(page.find('[data-testid="learn-play-panel-uci"]').exists()).toBe(true)
    await vi.waitFor(() => expect(page.find('[data-testid="learn-play-panel-igraj"]').isVisible()).toBe(true))
    expect(page.find('[data-testid="learn-play-panel-uci"]').isVisible()).toBe(false)
    page.unmount()
  })

  it('keeps the remembered tab when the home page is mounted again in the same session', async () => {
    localStorage.setItem(PZ_HOME_STORAGE_KEY, JSON.stringify({ version: 1, tab: 'igraj' }))
    const first = await mountSuspended(Home, { route: '/potkalnicko-prigorje' })
    await vi.waitFor(() => expect(first.find('[data-testid="learn-play-panel-igraj"]').isVisible()).toBe(true))
    first.unmount()
    const second = await mountSuspended(Home, { route: '/potkalnicko-prigorje' })
    await vi.waitFor(() => expect(second.find('[data-testid="learn-play-panel-igraj"]').isVisible()).toBe(true))
    expect(second.find('[data-testid="learn-play-panel-uci"]').isVisible()).toBe(false)
  })

  it('falls back to the Uči panel when home storage is malformed', async () => {
    localStorage.setItem(PZ_HOME_STORAGE_KEY, '{not-json')
    const page = await mountSuspended(Home, { route: '/potkalnicko-prigorje' })
    await vi.waitFor(() => expect(page.find('[data-testid="learn-play-panel-uci"]').isVisible()).toBe(true))
    expect(page.find('[data-testid="learn-play-panel-igraj"]').isVisible()).toBe(false)
  })

  it('shows a challenge resume card for a stored in-progress item', async () => {
    localStorage.setItem(CHALLENGE_LIST_STORAGE_KEY, JSON.stringify({
      version: 1,
      items: [{
        code: 'play1',
        title: 'Ana te izaziva',
        role: 'player',
        addedAt: '2026-11-01T10:00:00.000Z',
        closesAt: '2026-11-08T10:00:00.000Z',
        last: { phase: 'question', index: 3, total: 10, questionCount: 10, completedAt: null, closed: false }
      }]
    }))
    registerEndpoint('/api/challenges/play1', () => ({
      code: 'play1',
      title: { hr: 'Ana te izaziva', en: 'Ana' },
      sample: false,
      createdAt: '2026-11-01T10:00:00.000Z',
      closesAt: '2026-11-08T10:00:00.000Z',
      closed: false,
      questionCount: 10,
      maxScore: 1000,
      targetScore: null,
      rounds: [{ topic: { hr: 'Riječi', en: 'Words' }, count: 10 }],
      participant: { nickname: 'Ti', phase: 'question', index: 3, total: 10, completedAt: null, rounds: [] },
      question: null,
      feedback: null
    } satisfies ChallengeState))
    const page = await mountSuspended(Home, { route: '/potkalnicko-prigorje' })
    await vi.waitFor(() => expect(page.find('[data-testid="challenge-resume-card"]').exists()).toBe(true))
    expect(page.text()).toContain('pitanje 4 od 10')
    expect(page.text()).toContain('Nastavi izazov')
    page.unmount()
  })

  it('shows the compact daily row only with a finished result on the home page', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({
      version: 1,
      days: { '2026-11-11': { wordId: 'hiza', guesses: ['c'], done: true, solved: true, tries: 1, maxTries: 3 } }
    }))
    const page = await mountSuspended(DailyWord, {
      route: '/potkalnicko-prigorje',
      props: { compactWhenPlayed: true }
    })
    await expect.poll(() => page.find('[data-testid="daily-compact-row"]').exists(), { timeout: 5000 }).toBe(true)
    expect(page.text()).toContain('Riječ dana #12')
    expect(page.text()).toContain('niz')
    expect(page.find('[data-option-id]').exists()).toBe(false)
  })
})
