import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createClient } from '@supabase/supabase-js'
import { clearNuxtData, clearNuxtState, useNuxtApp } from '#imports'
import type { CardPool } from '../shared/utils/learn/types'
import { GAME_SCORES_KEY } from '../shared/utils/games/scores'
import { PROGRESS_STORAGE_KEY } from '../app/composables/useProgress'
import Quiz from '../app/pages/potkalnicko-prigorje/igre/kviz.vue'
import Cards from '../app/pages/potkalnicko-prigorje/igre/kartice.vue'
import sampleWords from './fixtures/heritage/words.json'
import sampleAreas from './fixtures/heritage/areas.json'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'

const fake = await startFakeSupabase()
const db = createClient(fake.url, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const seeds = sampleWords.slice(0, 4)
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let pending: Promise<void> | undefined
let release: (() => void) | undefined
let unavailable = false
let challengeBody: unknown

function storedWord(wordId: string) {
  const raw = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!)
  return raw.cards[`word:${wordId}`]
}

// Exercise the real useHeritage fetch
registerEndpoint('/api/heritage/words', async () => {
  await pending
  if (unavailable) throw new Error('Word service unavailable')
  const { data, error } = await db.from('heritage_words').select('entry').eq('active', true)
  if (error) throw error
  return { words: data!.map(row => row.entry), areas: sampleAreas }
})

// The quiz draws its questions from the card pool: build one from the same active words, as the pool API does.
registerEndpoint('/api/learn/pool', async () => {
  await pending
  if (unavailable) throw new Error('Pool unavailable')
  const { data, error } = await db.from('heritage_words').select('entry').eq('active', true)
  if (error) throw error
  const cards = data!.map(row => row.entry as typeof sampleWords[number]).map(entry => ({
    kind: 'word' as const,
    key: `word:${entry.id}` as const,
    id: entry.id,
    topics: ['rijeci'],
    headword: entry.headword,
    meaning: entry.meaning.hr,
    meaningEn: entry.meaning.en,
    partOfSpeech: entry.partOfSpeech,
    variants: [entry.headword],
    status: 'community' as const,
    transparency: 0,
    difficulty: 2 as const
  }))
  return { version: 1, generatedAt: '2026-11-04T00:00:00.000Z', cards, municipalities: [], settlements: [], topics: [] } satisfies CardPool
})
registerEndpoint('/api/challenges', { method: 'POST', handler: async (event) => {
  challengeBody = await (event as unknown as { web: { request: Request } }).web.request.json()
  return { code: 'quizproof1234567890' }
} })

beforeAll(async () => {
  for (const entry of sampleWords.slice(0, 5)) {
    const { error } = await db.from('heritage_words').insert({ id: entry.id, entry, areas: sampleAreas, active: false })
    expect(error).toBeNull()
  }
})
beforeEach(async () => {
  localStorage.clear()
  clearNuxtState(['heritage-progress', 'heritage-progress-loaded', 'pz-game-scores', 'pz-game-scores-loaded'])
  for (const entry of seeds) await db.from('heritage_words').update({ active: true }).eq('id', entry.id)
})
afterEach(() => {
  release?.()
  release = undefined
  pending = undefined
  unavailable = false
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData(['active-heritage-words', 'card-pool'])
})
afterAll(() => fake.stop())

async function mountQuiz(lang: 'hr' = 'hr') {
  await useNuxtApp().$i18n.setLocale(lang)
  wrapper = await mountSuspended(Quiz, { route: '/potkalnicko-prigorje/igre/kviz' })
  return wrapper
}

async function mountCards(lang: 'hr' = 'hr') {
  await useNuxtApp().$i18n.setLocale(lang)
  wrapper = await mountSuspended(Cards, { route: '/potkalnicko-prigorje/igre/kartice' })
  return wrapper
}

const OPTION = '[data-testid^="game-option-"]'
type Page = Awaited<ReturnType<typeof mountQuiz>>
const optionText = (option: { text: () => string }) => option.text().replace(/^\d+\.\s*/, '').replace(/(Točan odgovor\.|Tvoj odgovor\.)/g, '').trim()
const askedWord = (page: Page) => {
  const headword = page.get('[data-testid="game-prompt"]').text().match(/„(.*)”/)![1]!
  return seeds.find(word => word.headword === headword)!
}
/** Index of the option showing this word's meaning, or of any other option when `correct` is false. */
const pickIndex = (page: Page, correct: boolean) => {
  const entry = askedWord(page)
  const texts = page.findAll(OPTION).map(optionText)
  const right = texts.indexOf(entry.meaning.hr)
  return correct ? right : texts.findIndex((_, i) => i !== right)
}

const locales = [
  { lang: 'hr' as const, loading: 'Učitavam pitanja…', empty: 'Trebamo još riječi', progress: 'Odgovorena pitanja', error: 'Pitanja trenutačno nisu dostupna.', retry: 'Pokušaj opet' }
]

describe.each(locales)('$lang multiple-choice page', ({ lang, loading, empty, progress, error, retry }) => {
  it('loads active words into a playable question with four options and progress', async () => {
    const page = await mountQuiz(lang)
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    const entry = askedWord(page)
    expect(page.get('[data-testid="game-prompt"]').text()).toBe(`Što znači riječ „${entry.headword}”?`)
    expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe(progress)
    expect(page.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    expect(page.findAll(OPTION).map(optionText).sort()).toEqual(seeds.map(word => word.meaning[lang]).sort())
    expect(page.text()).not.toContain(loading)
    expect(page.text()).not.toContain(empty)
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 4')
    // The pool also drives answer handling, feedback and moving to the next question.
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    await page.get(`[data-testid="game-option-${pickIndex(page, true)}"]`).trigger('click')
    expect(page.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    expect(storedWord(entry.id).known).toBe(1)
    expect(page.text()).toContain('Odgovoreno ukupno: 1')
    expect(page.get('[data-testid="game-score"]').text()).toBe('Bodovi: 1')
    expect(page.get('[data-testid="game-feedback"]').text()).toContain(`Točan odgovor: ${entry.meaning.hr}`)
    // Focus moves to the feedback after an answer, and the options are locked.
    expect(focus.mock.contexts.some(element => (element as HTMLElement).dataset.testid === 'game-feedback')).toBe(true)
    expect(page.findAll(OPTION).every(option => option.attributes('disabled') !== undefined)).toBe(true)
    await page.get('[data-testid="game-next"]').trigger('click')
    expect(askedWord(page).id).not.toBe(entry.id)
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 2 od 4')
    focus.mockRestore()
  })

  it('answers with the keys 1 to 4', async () => {
    const page = await mountQuiz(lang)
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    const entry = askedWord(page)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: String(pickIndex(page, true) + 1) }))
    await expect.poll(() => page.find('[data-testid="game-feedback"]').exists()).toBe(true)
    expect(storedWord(entry.id).known).toBe(1)
  })

  it('shows loading rather than too few words until the pool request finishes', async () => {
    pending = new Promise((resolve) => {
      release = resolve
    })
    const page = await mountQuiz(lang)
    expect(page.text()).toContain(loading)
    expect(page.text()).not.toContain(empty)
    expect(page.find(OPTION).exists()).toBe(false)
    release!()
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    expect(page.text()).not.toContain(loading)
  })

  it('shows a localized error and retries the pool request', async () => {
    unavailable = true
    const page = await mountQuiz(lang)
    await expect.poll(() => page.text()).toContain(error)
    expect(page.text()).not.toContain(empty)
    expect(page.find(OPTION).exists()).toBe(false)
    const button = page.findAll('button').find(button => button.text() === retry)!
    expect(button).toBeDefined()
    unavailable = false
    await button.trigger('click')
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    expect(page.text()).not.toContain(error)
  })
})

describe.each([
  { lang: 'hr' as const, counter: 'Kartica 1 od 4', flip: 'Okreni karticu', unknown: 'Ne znam', next: 'Kartica 2 od 4' }
])('$lang flip-card page', ({ lang, counter, flip, unknown, next }) => {
  it('localizes controls and announces flips and the next card', async () => {
    const page = await mountCards(lang)
    await expect.poll(() => page.text()).toContain(counter)
    const flipButton = page.findAll('button').find(button => button.text() === flip)!
    await flipButton.trigger('click')
    const spoken = page.findAll('[aria-live="polite"]').map(region => region.text()).find(Boolean)!
    const current = seeds.find(word => spoken.includes(`${word.headword}: ${word.meaning.hr}`))
    expect(current).toBeDefined()
    expect(storedWord(current!.id).seen).toBe(1)

    // Flipping back and revealing again is still the same card visit.
    await flipButton.trigger('click')
    await flipButton.trigger('click')
    expect(storedWord(current!.id).seen).toBe(1)
    const unknownButton = page.findAll('button').find(button => button.text().includes(unknown))!
    await unknownButton.trigger('click')
    expect(page.findAll('[aria-live="polite"]').some(region => region.text().includes(next))).toBe(true)
    expect(storedWord(current!.id).missed).toBe(1)
  })
})

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

describe('card variant dialog', () => {
  it('opens the report dialog for the current card from both triggers without leaving the cards', async () => {
    const page = await mountCards()
    await expect.poll(() => page.text()).toContain('Kartica 1 od 4')
    const headword = page.findAll('p').find(paragraph => paragraph.classes().includes('text-4xl'))!.text()
    const word = seeds.find(entry => entry.headword === headword)!
    expect(dialog()).toBeNull()
    // The page-level trigger works before the card is flipped.
    const pageTrigger = page.findAll('button').find(button => button.text() === 'Kod nas se kaže drugačije')!
    await pageTrigger.trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    // The inline contribution form is gone: this is a dialog about this card's word.
    expect(page.find('textarea').exists()).toBe(false)
    expect(dialog()!.querySelector('[data-testid="variant-dialog-word"]')!.textContent).toContain(word.headword)
    expect(dialog()!.querySelector('[data-testid="variant-dialog-word"]')!.textContent).toContain(word.meaning.hr)
    expect(page.text()).toContain('Kartica 1 od 4')
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(dialog()).toBeNull())

    // The control on the card back opens the same dialog without flipping the card again.
    await page.findAll('button').find(button => button.text() === 'Okreni karticu')!.trigger('click')
    const backTrigger = page.findAll('button').filter(button => button.text() === 'Kod nas se kaže drugačije')[0]!
    await backTrigger.trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    expect(dialog()!.querySelector('[data-testid="variant-dialog-word"]')!.textContent).toContain(word.headword)
  })
})

describe('quiz variant dialog', () => {
  it('shows the report button only after an answer and reports that question\'s word', async () => {
    const page = await mountQuiz()
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    const entry = askedWord(page)
    // Not before answering, and no generic link to the home page's contribution form either.
    expect(page.find('[data-testid="quiz-differently"]').exists()).toBe(false)
    expect(page.findAll('button, a').some(item => item.text() === 'Kod nas se kaže drugačije')).toBe(false)
    expect(page.find('a[href*="doprinos"]').exists()).toBe(false)

    await page.get(`[data-testid="game-option-${pickIndex(page, true)}"]`).trigger('click')
    const trigger = page.get('[data-testid="quiz-differently"]')
    expect(trigger.text()).toBe('Kod nas se kaže drugačije')
    expect(dialog()).toBeNull()
    await trigger.trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    expect(dialog()!.querySelector('[data-testid="variant-dialog-word"]')!.textContent).toContain(entry.headword)

    // Closing it keeps the answered question; the next question hides the button again.
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(askedWord(page).id).toBe(entry.id)
    await page.get('[data-testid="game-next"]').trigger('click')
    expect(page.find('[data-testid="quiz-differently"]').exists()).toBe(false)
  })

  it('offers "Predloži ispravak" for the word in the feedback', async () => {
    const page = await mountQuiz()
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    expect(page.find('[data-testid="game-suggest"]').exists()).toBe(false)
    await page.get(`[data-testid="game-option-${pickIndex(page, false)}"]`).trigger('click')
    const entry = askedWord(page)
    await page.get('[data-testid="game-suggest"]').trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    expect(dialog()!.textContent).toContain(entry.headword)
  })
})

describe('limited active words', () => {
  it.each([0, 1, 2])('shows the empty state with %i active words', async (count) => {
    for (const entry of seeds.slice(count)) await db.from('heritage_words').update({ active: false }).eq('id', entry.id)
    const page = await mountQuiz()
    await expect.poll(() => page.text()).toContain('Trebamo još riječi')
    expect(page.text()).toContain('barem dva različita značenja')
    expect(page.find(OPTION).exists()).toBe(false)
  })

  it('asks with three options when only three words are active', async () => {
    await db.from('heritage_words').update({ active: false }).eq('id', seeds[3]!.id)
    const page = await mountQuiz()
    await expect.poll(() => page.findAll(OPTION).length).toBe(3)
    expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe('Odgovorena pitanja')
  })
})

describe.each([
  { lang: 'hr' as const, summary: 'Kaj to znači? 3/4', replay: 'Ponovi pogrešne (1)', noMisses: 'Bez pogreške', counter: 'Pitanje 1 od 1', copied: 'Kopirano!', path: '/potkalnicko-prigorje/igre/kviz' }
])('$lang quiz result', ({ summary, replay, noMisses, counter, copied, path }) => {
  async function answerCurrent(page: Page, correct: boolean) {
    const entry = askedWord(page)
    await page.get(`[data-testid="game-option-${pickIndex(page, correct)}"]`).trigger('click')
    await page.get('[data-testid="game-next"]').trigger('click')
    return entry
  }

  it('reviews the missed word, replays only it, saves the best score and shares a spoiler-free result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const page = await mountQuiz()
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    const missedEntry = await answerCurrent(page, false)
    expect(storedWord(missedEntry.id).missed).toBe(1)
    for (let i = 0; i < 3; i++) await answerCurrent(page, true)

    await expect.poll(() => page.find('[data-testid="game-misses"]').exists()).toBe(true)
    expect(page.get('[data-testid="game-result-score"]').text()).toBe('3 od 4')
    expect(JSON.parse(localStorage.getItem(GAME_SCORES_KEY)!)).toMatchObject({ version: 1, best: { znacenje: { score: 3, max: 4 } } })
    const rows = page.findAll('[data-testid="game-miss"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain(missedEntry.headword)
    expect(rows[0]!.text()).toContain(`Točan odgovor: ${missedEntry.meaning.hr}`)
    expect(rows[0]!.find('[data-testid="game-suggest"]').exists()).toBe(true)

    // The shared text shows the score and one square per question, never a word.
    await page.get('[data-testid="quiz-share-toggle"]').trigger('click')
    const shared = page.get('[data-testid="quiz-share-text"]').text()
    expect(shared).toContain(summary)
    expect(shared).toContain('🟥🟩🟩🟩')
    for (const word of seeds) expect(shared).not.toContain(word.headword)
    await page.get('[data-testid="quiz-copy"]').trigger('click')
    await expect.poll(() => writeText.mock.calls.length).toBe(1)
    const copiedText = writeText.mock.calls[0]![0] as string
    expect(copiedText).toContain(`${summary}\n🟥🟩🟩🟩\n`)
    expect(copiedText.endsWith(path)).toBe(true)
    await expect.poll(() => page.get('[data-testid="quiz-copy"]').text()).toBe(copied)
    expect(page.find('[data-testid="challenge-create"]').exists()).toBe(true)
    const resultHtml = page.html()
    expect(resultHtml.indexOf('data-testid="challenge-create"')).toBeLessThan(resultHtml.indexOf('data-testid="quiz-share"'))

    // Replaying the misses asks only that word, and a practice round is not shared.
    const replayButton = page.get('[data-testid="game-replay-missed"]')
    expect(replayButton.text()).toBe(replay)
    await replayButton.trigger('click')
    expect(page.get('[data-testid="game-progress"]').text()).toBe(counter)
    expect(askedWord(page).id).toBe(missedEntry.id)
    await answerCurrent(page, true)
    await expect.poll(() => page.find('[data-testid="game-misses"]').exists()).toBe(true)
    expect(page.get('[data-testid="game-misses"]').text()).toContain(noMisses)
    expect(page.find('[data-testid="game-replay-missed"]').exists()).toBe(false)
    expect(page.find('[data-testid="quiz-share"]').exists()).toBe(false)
    expect(page.find('[data-testid="challenge-create"]').exists()).toBe(false)
    // A practice round never touches the best score.
    expect(JSON.parse(localStorage.getItem(GAME_SCORES_KEY)!).best.znacenje).toMatchObject({ score: 3, max: 4 })
  })

  it('creates a challenge that keeps the creator\'s own round as word ids', async () => {
    challengeBody = undefined
    const page = await mountQuiz()
    await expect.poll(() => page.findAll(OPTION).length).toBe(4)
    const asked: { id: string, optionIds: string[] }[] = []
    for (let i = 0; i < 4; i++) {
      const entry = askedWord(page)
      const ids = page.findAll(OPTION).map(optionText).map(text => seeds.find(word => word.meaning.hr === text)!.id)
      asked.push({ id: entry.id, optionIds: ids })
      await page.get(`[data-testid="game-option-${pickIndex(page, i !== 0)}"]`).trigger('click')
      await page.get('[data-testid="game-next"]').trigger('click')
    }
    await expect.poll(() => page.find('[data-testid="challenge-create"]').exists()).toBe(true)
    await page.get('[data-testid="challenge-create"] input[name="nickname"]').setValue('Ana')
    await page.get('[data-testid="challenge-create"] form').trigger('submit')
    await expect.poll(() => challengeBody).toBeDefined()
    expect(challengeBody).toEqual({ nickname: 'Ana', quiz: { questions: asked, results: [false, true, true, true] } })
  })

  it('caps a round at ten questions however many words are active', async () => {
    const extras = Array.from({ length: 9 }, (_, index) => ({
      ...seeds[0]!, id: `extra-${index}`, headword: `extra-${index}`, meaning: { hr: `značenje ${index}`, en: `meaning ${index}` }, partOfSpeech: 'imenica', variants: []
    }))
    for (const entry of extras) {
      const { error } = await db.from('heritage_words').insert({ id: entry.id, entry, areas: sampleAreas, active: true })
      expect(error).toBeNull()
    }
    try {
      const page = await mountQuiz()
      await expect.poll(() => page.findAll(OPTION).length).toBe(4)
      // 13 active words, one round of ten.
      expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 10')
    } finally {
      for (const entry of extras) await db.from('heritage_words').delete().eq('id', entry.id)
    }
  })
})
