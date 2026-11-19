import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useNuxtData } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import { LEARN_STORAGE_KEY } from '../app/composables/useLearnState'
import { answerInSession, createSession } from '../shared/utils/learn/learnState'
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

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)

let current = payload()
registerEndpoint('/api/heritage/daily', () => current)
registerEndpoint('/api/learn/pool', () => ({ version: 1, generatedAt: '', cards: [], municipalities: [], settlements: [], topics: [] }))

const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable', 'heritage-progress', 'heritage-progress-loaded', 'pz-learn-state', 'pz-learn-loaded']
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const stored = () => JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)!).days['2026-11-15']

beforeEach(() => {
  current = payload()
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
    expect(page.text()).toContain('Šest slova. Možeš pisati i bez kvačica.')
    expect(page.html()).not.toContain('škrlak')
  })

  it('has a nonempty safe clue even when the multiple-choice round supplies none', async () => {
    current.clues = []
    current.entry.variants.push({ id: 'v2', form: 'klobuk', status: 'community', usages: [] })
    current.entry.examples = [{ text: 'Škrlak ili klobuk.' }]
    const page = await mountPage()
    expect(page.get('[data-testid="hint"]').text()).toContain('Znači: šešir')
    expect(page.text()).not.toContain('škrlak')
    expect(page.text()).not.toContain('klobuk')
  })

  it('labels sample content while playing and after revealing the answer', async () => {
    current.sample = true
    const page = await mountPage()
    expect(page.get('[data-testid="daily-sample"]').text()).toBe('Uzorak')
    await guess(page, 'škrlak')
    expect(page.get('[data-testid="daily-answer-card"]').text()).toContain('šešir')
    expect(page.get('[data-testid="daily-sample"]').text()).toBe('Uzorak')
  })

  it.each(['rollover', 'replacement'])('clears round-local notes and completion state on %s', async (change) => {
    const page = await mountPage()
    await guess(page, 'skrlak')
    expect(page.get('[data-testid="daily-near-note"]').text()).toContain('škrlak')
    const next = payload()
    if (change === 'rollover') next.day = '2026-11-16'
    next.entry = { ...next.entry, id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća' }, variants: [], examples: [] }
    useNuxtData<DailyWordPayload>('heritage-daily-word').data.value = next
    if (change === 'replacement') {
      await expect.poll(() => page.get('h1').text()).toBe('Današnja je riječ riješena')
      expect(page.find('[data-testid="daily-near-note"]').exists()).toBe(false)
      return
    }
    await expect.poll(() => page.find('[data-testid="daily-play"]').exists()).toBe(true)
    expect(page.get('[data-testid="free-text-input"]').element).toHaveProperty('value', '')
    expect(page.find('[data-testid="daily-near-note"]').exists()).toBe(false)
    await guess(page, 'hiža')
    expect(page.get('h1').text()).toBe('Točno, u prvom pokušaju')
    expect(page.find('[data-testid="daily-near-note"]').exists()).toBe(false)
  })

  it('clears input and announcements when an unfinished word is replaced', async () => {
    const page = await mountPage()
    await guess(page, 'klobuk')
    await page.get('[data-testid="free-text-input"]').setValue('pending guess')
    const next = payload()
    next.entry = { ...next.entry, id: 'hiza', headword: 'hiža', variants: [] }
    useNuxtData<DailyWordPayload>('heritage-daily-word').data.value = next
    await expect.poll(() => page.find('[data-testid="daily-guesses"]').exists()).toBe(false)
    expect(page.get('[data-testid="free-text-input"]').element).toHaveProperty('value', '')
    expect(page.get('[data-testid="daily-tries"]').text()).toBe('Pokušaj 1 od 5')
    expect(page.text()).not.toContain('Netočno.')
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

  it('does not promise the word for a failed round on a since replaced word', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'withdrawn', guesses: ['a1', 'b2', 'c3', 'd4', 'e5'], done: true, solved: false, tries: 5, maxTries: 5 } } }))
    wrapper = await mountSuspended(DailyPage, { route: '/rijec-dana/' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-result"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Danas nije išlo')
    expect(wrapper.text()).not.toContain('riješen')
  })

  it('does not count option picks saved by the old multiple-choice round as typed tries', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'skrlak', guesses: ['b'], done: false, solved: false, tries: 1, maxTries: 1 } } }))
    const page = await mountPage()
    expect(page.get('[data-testid="daily-tries"]').text()).toBe('Pokušaj 1 od 5')
    expect(page.find('[data-testid="daily-guesses"]').exists()).toBe(false)
    expect(page.findAll('[data-testid="hint"]')).toHaveLength(1)
    await guess(page, 'klobuk')
    expect(stored()).toMatchObject({ guesses: ['klobuk'], tries: 1, maxTries: 5 })
  })

  it('still shows a round finished in the old multiple-choice game as played', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'skrlak', guesses: ['a'], done: true, solved: true, tries: 1, maxTries: 1 } } }))
    wrapper = await mountSuspended(DailyPage, { route: '/rijec-dana/' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-result"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.find('[data-testid="daily-play"]').exists()).toBe(false)
  })
})

describe('DailyWordCard', () => {
  it('shows the first clue and first letter, then the solved word', async () => {
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.find('[data-testid="daily-card"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Znači: šešir')
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

  it('labels sample clues and the completed sample word', async () => {
    current.sample = true
    current.clues = [{ kind: 'variants', forms: ['škrlak'] }]
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.find('[data-testid="daily-card"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('[data-testid="daily-sample"]').text()).toBe('Uzorak')
    expect(wrapper.get('h2').text()).toBe('Znači: šešir')
    expect(wrapper.text()).not.toContain('škrlak')
    wrapper.unmount()
    clearNuxtState(stateKeys)
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'skrlak', guesses: ['škrlak'], done: true, solved: true, tries: 1, maxTries: 5 } } }))
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.text()).toContain('škrlak')
    expect(wrapper.get('[data-testid="daily-sample"]').text()).toBe('Uzorak')
  })

  it('stays playable when an unfinished word was replaced today', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': { wordId: 'withdrawn', guesses: ['klobuk'], done: false, solved: false, tries: 1, maxTries: 5 } } }))
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.find('[data-testid="daily-card-play"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.text()).not.toContain('riješen')
  })

  it('names the run a miss ended, not one an earlier missed day had ended', async () => {
    const win = { wordId: 'w', guesses: ['x'], done: true, solved: true, tries: 1, maxTries: 5 }
    const miss = { wordId: 'skrlak', guesses: ['a1', 'b2', 'c3', 'd4', 'e5'], done: true, solved: false, tries: 5, maxTries: 5 }
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-12': win, '2026-11-13': win, '2026-11-15': miss } }))
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.text(), { timeout: 5000 }).toContain('Danas nije išlo')
    expect(wrapper.text()).not.toContain('je prekinut')
    expect(wrapper.text()).not.toContain('riješen')
  })

  it('never calls a failed round on a since replaced word solved', async () => {
    const miss = { wordId: 'withdrawn', guesses: ['a1', 'b2', 'c3', 'd4', 'e5'], done: true, solved: false, tries: 5, maxTries: 5 }
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-15': miss } }))
    wrapper = await mountSuspended(DailyWordCard)
    await expect.poll(() => wrapper!.find('h2').exists() && wrapper!.get('h2').text(), { timeout: 5000 }).toBe('Danas nije išlo')
    expect(wrapper.text()).not.toContain('riješen')
  })
})

describe('Igraj i uči hub', () => {
  it.each([true, false])('offers the appropriate learning path without a saved session when cards are due: %s', async (hasDue) => {
    localStorage.setItem('pz-progress/v2', JSON.stringify({
      version: 2, lastPlayed: '2020-01-01', streak: 1,
      cards: { 'word:a': { box: 1, due: hasDue ? '2020-01-01' : '2999-01-01', seen: 1, known: 0, missed: 1, lastPlayed: '2020-01-01' } }
    }))
    wrapper = await mountSuspended(PlayHub, { route: '/igraj/' })
    await expect.poll(() => wrapper!.find('[data-testid="hub-learn-continue"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="hub-learn-continue"]').attributes('href')).toBe(hasDue ? '/uci/sesija/?ponovi=1' : '/uci/')
  })

  it.each([true, false])('resumes an unfinished session when due cards exist: %s', async (hasDue) => {
    const session = answerInSession(createSession(['rijeci'], 5, ['word:a', 'word:b'], 'new'), false)
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify({ version: 1, current: session, lastTopics: ['rijeci'], lastN: 5 }))
    if (hasDue) localStorage.setItem('pz-progress/v2', JSON.stringify({
      version: 2, lastPlayed: '2020-01-01', streak: 1,
      cards: { 'word:a': { box: 1, due: '2020-01-01', seen: 1, known: 0, missed: 1, lastPlayed: '2020-01-01' } }
    }))
    wrapper = await mountSuspended(PlayHub, { route: '/igraj/' })
    await expect.poll(() => wrapper!.find('[data-testid="hub-learn-continue"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="hub-learn-continue"]').attributes('href')).toBe('/uci/sesija/?nastavi=1')
    expect(JSON.parse(localStorage.getItem(LEARN_STORAGE_KEY)!).current).toEqual(session)
  })

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

  it('opens a shared challenge code exactly as the server issued it', async () => {
    navigateToMock.mockClear()
    wrapper = await mountSuspended(PlayHub, { route: '/igraj/' })
    await wrapper.get('#hub-code').setValue('  aB3_x9Kq-Lm2Zp0w ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('#hub-code-error').exists()).toBe(false)
    expect(navigateToMock).toHaveBeenCalledWith('/izazov/aB3_x9Kq-Lm2Zp0w/')
  })

  it('rejects a code too short to be a challenge code', async () => {
    navigateToMock.mockClear()
    wrapper = await mountSuspended(PlayHub, { route: '/igraj/' })
    await wrapper.get('#hub-code').setValue('KALNIK7')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('#hub-code-error').exists()).toBe(true)
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
