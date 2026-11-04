import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import { clearNuxtData, clearNuxtState, useNuxtApp } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import DailyWord from '../app/components/heritage/DailyWord.vue'
import Hub from '../app/pages/potkalnicko-prigorje/igre/index.vue'
import type { DailyWordPayload } from '../shared/utils/dailyWord'

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
let requests = 0
registerEndpoint('/api/heritage/daily', () => {
  requests++
  if (current === 'not-started') throw createError({ statusCode: 404, statusMessage: 'not-started' })
  return current
})
registerEndpoint('/api/heritage/words', () => ({ words: [], areas }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']

async function mountDaily(lang: 'hr' | 'en') {
  await useNuxtApp().$i18n.setLocale(lang)
  // The English interface follows the route, so mount under /en.
  wrapper = await mountSuspended(DailyWord, { route: lang === 'en' ? '/en' : '/potkalnicko-prigorje/igre' })
  return wrapper
}
const optionIds = (page: NonNullable<typeof wrapper>) => page.findAll('[data-option-id]').map(option => option.attributes('data-option-id'))
const stored = () => JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)!)
async function ready(page: NonNullable<typeof wrapper>) {
  await expect.poll(() => page.findAll('[data-option-id]').length + page.findAll('[data-testid="daily-reveal"]').length, { timeout: 5000 }).toBeGreaterThan(0)
}

beforeEach(() => {
  current = payload()
  requests = 0
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  clearNuxtData('heritage-daily-word')
})

const locales = [
  { lang: 'hr' as const, prompt: 'Što znači ova riječ?', title: 'Riječ dana #12', wrong: 'Netočno.', clue1: 'Trag: primjer rečenice', clue2: 'Trag: nešto u kući', miss: 'Ovaj put nije uspjelo.', solved1: 'Točno iz 1. pokušaja!', solved2: 'Točno iz 2. pokušaja!', tries3: 'Pokušaji: X/3', left: 'Preostala 2 pokušaja', sample: 'Uzorak', village: 'Riječ iz mjesta Selo A', next: 'Nova riječ za 5 h', meaning: 'kuća', fact: 'Zanimljivost: Dolazi od njemačke riječi.', saved: 'Rezultat se ne može spremiti na ovom uređaju.', replaced: 'Današnja riječ je u međuvremenu zamijenjena' },
  { lang: 'en' as const, prompt: 'What does this word mean?', title: 'Word of the day #12', wrong: 'Not quite.', clue1: 'Clue: an example sentence', clue2: 'Clue: something in the house', miss: 'Not this time.', solved1: 'Got it in 1!', solved2: 'Got it in 2!', tries3: 'Tries: X/3', left: '2 tries left', sample: 'Sample', village: 'This one\'s from Selo A', next: 'Next word in 5 h', meaning: 'house', fact: 'Did you know?: From a German word.', saved: 'Your result can\'t be saved on this device.', replaced: 'Today\'s word was replaced' }
]

describe.each(locales)('$lang daily word', (c) => {
  it('shows the word with four options, the prompt, number and the first-section anchor', async () => {
    const page = await mountDaily(c.lang)
    await ready(page)
    expect(page.get('section#rijec-dana').exists()).toBe(true)
    expect(page.text()).toContain(c.title)
    expect(page.get('h2').text()).toBe('hiža')
    expect(page.get('legend').text()).toBe(c.prompt)
    expect(optionIds(page)).toEqual(['a', 'b', 'c', 'd'])
    expect(page.find('[data-testid="daily-clues"]').exists()).toBe(false)
    expect(page.text()).not.toContain(c.sample)
    const meaningLang = c.lang === 'en' ? 'en' : 'hr'
    expect(page.get('[data-option-id="a"]').attributes('lang')).toBe(meaningLang)
    // No English meaning for this option: it falls back to Croatian and says so.
    expect(page.get('[data-option-id="d"]').attributes('lang')).toBe('hr')
  })

  it('removes a wrong option, then reveals the example and the category and finally the answer', async () => {
    const page = await mountDaily(c.lang)
    await ready(page)
    await page.get('[data-option-id="a"]').trigger('click')
    expect(optionIds(page)).toEqual(['b', 'c', 'd'])
    expect(page.get('[data-testid="daily-clues"]').text()).toContain(c.clue1)
    expect(page.get('[data-testid="daily-clues"]').text()).toContain('„Idem v hižu.“')
    expect(page.get('[role="status"]').text()).toContain(c.wrong)
    expect(page.get('[role="status"]').text()).toContain(c.left)
    expect(page.text()).not.toContain('Idem u kuću')
    await page.get('[data-option-id="b"]').trigger('click')
    expect(optionIds(page)).toEqual(['c', 'd'])
    expect(page.get('[data-testid="daily-clues"]').text()).toContain(c.clue2)
    await page.get('[data-option-id="d"]').trigger('click')
    expect(page.findAll('[data-option-id]')).toHaveLength(0)
    const reveal = page.get('[data-testid="daily-reveal"]')
    expect(reveal.text()).toContain(c.miss)
    expect(reveal.text()).toContain(c.tries3)
    expect(reveal.text()).toContain(c.meaning)
    expect(reveal.text()).toContain(c.fact)
    expect(reveal.text()).toContain('Idem u kuću')
    expect(page.get('[data-testid="daily-countdown"]').text()).toContain(c.next)
    expect(stored().days['2026-11-11']).toMatchObject({ wordId: 'hiza', guesses: ['a', 'b', 'd'], done: true, solved: false, tries: 3, maxTries: 3 })
  })

  it('solves on the first try and on the second try and saves each result', async () => {
    let page = await mountDaily(c.lang)
    await ready(page)
    await page.get('[data-option-id="c"]').trigger('click')
    expect(page.get('[data-testid="daily-reveal"]').text()).toContain(c.solved1)
    expect(stored().days['2026-11-11']).toMatchObject({ guesses: ['c'], done: true, solved: true, tries: 1, maxTries: 3 })
    page.unmount()
    localStorage.clear()
    clearNuxtState(stateKeys)
    page = await mountDaily(c.lang)
    await ready(page)
    await page.get('[data-option-id="b"]').trigger('click')
    await page.get('[data-option-id="c"]').trigger('click')
    expect(page.get('[data-testid="daily-reveal"]').text()).toContain(c.solved2)
    expect(stored().days['2026-11-11']).toMatchObject({ guesses: ['b', 'c'], solved: true, tries: 2 })
  })

  it('resumes after a reload with the same options removed and cannot be retried', async () => {
    let page = await mountDaily(c.lang)
    await ready(page)
    await page.get('[data-option-id="a"]').trigger('click')
    page.unmount()
    clearNuxtState(stateKeys)
    clearNuxtData('heritage-daily-word')
    page = await mountDaily(c.lang)
    await ready(page)
    expect(optionIds(page)).toEqual(['b', 'c', 'd'])
    expect(page.get('[data-testid="daily-clues"]').text()).toContain(c.clue1)
    await page.get('[data-option-id="c"]').trigger('click')
    page.unmount()
    clearNuxtState(stateKeys)
    clearNuxtData('heritage-daily-word')
    page = await mountDaily(c.lang)
    await ready(page)
    expect(page.findAll('[data-option-id]')).toHaveLength(0)
    expect(page.get('[data-testid="daily-reveal"]').text()).toContain(c.solved2)
    expect(page.get('[data-testid="daily-countdown"]').exists()).toBe(true)
  })

  it('keeps playing in memory and says so when device storage is unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      }
    })
    const page = await mountDaily(c.lang)
    await ready(page)
    await page.get('[data-option-id="a"]').trigger('click')
    expect(optionIds(page)).toEqual(['b', 'c', 'd'])
    expect(page.get('[data-testid="daily-storage-note"]').text()).toBe(c.saved)
  })

  it('shows the stored result when today\'s word was replaced after the visitor played', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({
      version: 1, days: { '2026-11-11': { wordId: 'old', guesses: ['b', 'a'], done: true, solved: true, tries: 2, maxTries: 3 } }
    }))
    const page = await mountDaily(c.lang)
    await expect.poll(() => page.find('[data-testid="daily-replaced"]').exists(), { timeout: 5000 }).toBe(true)
    expect(page.get('[data-testid="daily-replaced"]').text()).toContain(c.replaced)
    expect(page.get('[data-testid="daily-replaced"]').text()).toContain(c.lang === 'hr' ? 'Pokušaji: 2/3' : 'Tries: 2/3')
    expect(page.findAll('[data-option-id]')).toHaveLength(0)
    expect(page.text()).not.toContain('hiža')
    expect(stored().days['2026-11-11'].wordId).toBe('old')
  })

  it('labels sample words and names the village for village words', async () => {
    current = payload({ sample: true, villageAreaId: 'vil-a' })
    const page = await mountDaily(c.lang)
    await ready(page)
    expect(page.text()).toContain(c.sample)
    expect(page.text()).toContain(c.village)
  })

  it('refetches when the countdown reaches the next Zagreb midnight', async () => {
    current = payload({ nextAt: new Date(Date.now() + 700).toISOString() })
    const page = await mountDaily(c.lang)
    await ready(page)
    const before = requests
    current = payload({ day: '2026-11-12', number: 13, entry: { ...payload().entry, id: 'vura', headword: 'vura' } })
    await expect.poll(() => page.find('h2')?.text(), { timeout: 5000 }).toBe('vura')
    expect(requests).toBeGreaterThan(before)
    expect(optionIds(page)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('stays hidden before launch when the API answers not-started', async () => {
    current = 'not-started'
    const page = await mountDaily(c.lang)
    await expect.poll(() => requests, { timeout: 5000 }).toBeGreaterThan(0)
    await expect.poll(() => page.find('section#rijec-dana').exists(), { timeout: 5000 }).toBe(false)
    expect(page.text()).toBe('')
  })
})

describe('daily word device storage', () => {
  it('ignores corrupt or malformed saved days instead of trusting them', async () => {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({
      version: 1,
      days: {
        '2026-11-10': { wordId: 'x', guesses: ['a'], done: true, solved: false, tries: 1, maxTries: 3 },
        '2026-11-09': { wordId: 'x', guesses: 'a', done: true },
        'not-a-day': { wordId: 'x', guesses: [], done: false, solved: false, tries: 0, maxTries: 3 }
      }
    }))
    const page = await mountDaily('hr')
    await ready(page)
    expect(optionIds(page)).toEqual(['a', 'b', 'c', 'd'])
    page.unmount()
    clearNuxtState(stateKeys)
    localStorage.setItem(DAILY_STORAGE_KEY, '{not json')
    const fresh = await mountDaily('hr')
    await ready(fresh)
    expect(optionIds(fresh)).toEqual(['a', 'b', 'c', 'd'])
    expect(fresh.get('[data-testid="daily-storage-note"]').exists()).toBe(true)
  })
})

describe('daily word placement', () => {
  it('is the first section of the games hub, ahead of the play catalogue', async () => {
    const page = await mountSuspended(Hub, { route: '/potkalnicko-prigorje/igre' })
    const daily = page.element.querySelector('#rijec-dana')!
    const catalog = page.element.querySelector('[data-testid="play-catalog"]')!
    expect(daily).not.toBeNull()
    expect(catalog).not.toBeNull()
    expect(daily.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    page.unmount()
  })

  it('lists the daily word in the catalogue with a link to the section', async () => {
    const page = await mountSuspended(Hub, { route: '/potkalnicko-prigorje/igre' })
    const tile = page.get('[data-testid="game-tile-rijec-dana"]')
    expect(tile.exists()).toBe(true)
    expect(tile.attributes('href')).toContain('#rijec-dana')
    page.unmount()
  })
})
