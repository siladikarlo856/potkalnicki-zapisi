import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import DailyPage from '../app/pages/rijec-dana/index.vue'
import PlayHub from '../app/pages/igraj/index.vue'
import DailyWordCard from '../app/components/DailyWordCard.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

function payload(): DailyWordPayload {
  return {
    day: '2026-11-15', number: 14, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
    entry: {
      id: 'skrlak', headword: 'škrlak', meaning: { hr: 'šešir' }, partOfSpeech: 'imenica', status: 'community',
      sources: [{ id: 'editor', kind: 'editor' }], category: 'clothing',
      examples: [{ text: 'V nedelju si je del novi škrlak.', translation: 'U nedjelju je stavio novi šešir.' }],
      variants: [{ id: 'v1', form: 'škrlak', status: 'community', usages: [] }]
    },
    areas: [], villageAreaId: null,
    options: [{ id: 'a', text: { hr: 'šešir' } }, { id: 'b', text: { hr: 'pas' } }],
    correctOptionId: 'a',
    clues: [{ kind: 'example', text: 'Nosi se na glavi.' }, { kind: 'category', category: 'clothing' }, { kind: 'partOfSpeech', text: 'imenica' }]
  }
}

registerEndpoint('/api/heritage/daily', () => payload())
registerEndpoint('/api/learn/pool', () => ({ version: 1, generatedAt: '', cards: [], municipalities: [], settlements: [], topics: [] }))

const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable', 'heritage-progress', 'heritage-progress-loaded']
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const stored = () => JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)!).days['2026-11-15']

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

async function mountPage() {
  wrapper = await mountSuspended(DailyPage, { route: '/rijec-dana/' })
  await expect.poll(() => wrapper!.find('[data-testid="daily-play"]').exists(), { timeout: 5000 }).toBe(true)
  return wrapper
}

async function guess(page: NonNullable<typeof wrapper>, text: string) {
  await page.get('[data-testid="free-text-input"]').setValue(text)
  await page.get('form').trigger('submit')
}

describe('Riječ dana page', () => {
  it('starts on try 1 with the first clue, the first letter and Provjeri disabled', async () => {
    const page = await mountPage()
    expect(page.get('h1').text()).toBe('Koja je ovo riječ?')
    expect(page.get('[data-testid="daily-tries"]').text()).toBe('Pokušaj 1 od 5')
    expect(page.findAll('[data-testid="hint"]')).toHaveLength(1)
    expect(page.get('[data-testid="hint"]').text()).toContain('Trag 1 od 3')
    expect(page.get('[role="img"]').attributes('aria-label')).toBe('Riječ od šest slova, prvo slovo š')
    expect(page.get('[data-testid="daily-check"]').attributes('disabled')).toBeDefined()
    expect(page.text()).toContain('6 slova. Možeš pisati i bez kvačica.')
    expect(page.html()).not.toContain('škrlak')
  })

  it('lists a wrong guess and reveals the next clue and letter', async () => {
    const page = await mountPage()
    await guess(page, 'klobuk')
    expect(page.get('[data-testid="daily-tries"]').text()).toBe('Pokušaj 2 od 5')
    expect(page.get('[data-testid="daily-guesses"]').text()).toContain('klobuk')
    expect(page.get('[data-testid="daily-guesses"]').text()).toContain('Netočno')
    expect(page.findAll('[data-testid="hint"]')).toHaveLength(2)
    expect(page.get('[data-testid="hint"]:last-child').text()).toContain('novo')
    expect(page.get('[role="img"]').attributes('aria-label')).toContain('otkrivena slova: š, k')
    expect(stored().guesses).toEqual(['klobuk'])
  })

  it('shows the word, meaning and streak after a right guess without diacritics', async () => {
    const page = await mountPage()
    await guess(page, 'klobuk')
    await guess(page, 'skrlak')
    await expect.poll(() => page.find('[data-testid="daily-result"]').exists()).toBe(true)
    expect(page.get('h1').text()).toBe('Točno, u drugom pokušaju')
    const card = page.get('[data-testid="daily-answer-card"]').text()
    expect(card).toContain('škrlak')
    expect(card).toContain('znači šešir')
    expect(page.get('[data-testid="streak-counter"]').text()).toBe('Niz: 1 dan')
    expect(page.get('[data-testid="daily-near-note"]').text()).toContain('Piše se: škrlak')
    expect(page.get('[data-testid="daily-countdown"]').text()).toContain('Nova riječ za')
    expect(stored()).toMatchObject({ done: true, solved: true, tries: 2, maxTries: 5 })
  })

  it('ends after five wrong guesses with the word and no streak shame', async () => {
    const page = await mountPage()
    for (const word of ['a1', 'b2', 'c3', 'd4', 'e5']) await guess(page, word)
    await expect.poll(() => page.find('[data-testid="daily-result"]').exists()).toBe(true)
    expect(page.get('h1').text()).toBe('Danas nije išlo. Riječ je bila:')
    expect(page.get('[data-testid="daily-answer-card"]').text()).toContain('škrlak')
    expect(stored()).toMatchObject({ done: true, solved: false, tries: 5 })
  })

  it('shows the result for a word already played today', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'skrlak', guesses: ['škrlak'], done: true, solved: true, tries: 1, maxTries: 5 } } }))
    wrapper = await mountSuspended(DailyPage, { route: '/rijec-dana/' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-result"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Današnja je riječ riješena')
  })
})

describe('DailyWordCard', () => {
  it('shows the first clue and first letter, then the solved word', async () => {
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.find('[data-testid="daily-card"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('h2').text()).toBe('„Nosi se na glavi.“')
    expect(wrapper.get('[data-testid="daily-card-play"]').attributes('href')).toBe('/rijec-dana/')
    expect(wrapper.html()).not.toContain('škrlak')
    wrapper.unmount()
    clearNuxtState(stateKeys)
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'skrlak', guesses: ['škrlak'], done: true, solved: true, tries: 1, maxTries: 5 } } }))
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.text(), { timeout: 5000 }).toContain('škrlak')
    expect(wrapper.text()).toContain('(šešir)')
    expect(wrapper.text()).toContain('Niz: 1 dan')
  })
})

describe('Igraj i uči hub', () => {
  it('lists daily word, Uči, three games with a link to all and challenges with the code field', async () => {
    wrapper = await mountSuspended(PlayHub, { route: '/igraj/' })
    expect(wrapper.get('h1').text()).toBe('Igraj i uči')
    await expect.poll(() => wrapper!.find('[data-testid="daily-card"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('[data-testid="hub-learn-first"]').text()).toContain('Odaberi prve riječi')
    expect(wrapper.findAll('[data-testid="pz-game-card"]')).toHaveLength(3)
    expect(wrapper.get('[data-testid="hub-games"] a[href="/igre/"]').text()).toBe('Svih 13')
    expect(wrapper.get('#hub-code').exists()).toBe(true)
    expect(wrapper.get('[data-testid="hub-challenge-new"]').attributes('href')).toBe('/izazov/novi/')
  })
})
