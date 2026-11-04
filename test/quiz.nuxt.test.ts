import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createClient } from '@supabase/supabase-js'
import { clearNuxtData, clearNuxtState, useNuxtApp } from '#imports'
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

beforeAll(async () => {
  for (const entry of sampleWords.slice(0, 5)) {
    const { error } = await db.from('heritage_words').insert({ id: entry.id, entry, areas: sampleAreas, active: false })
    expect(error).toBeNull()
  }
})
beforeEach(async () => {
  localStorage.clear()
  clearNuxtState(['heritage-progress', 'heritage-progress-loaded'])
  for (const entry of seeds) await db.from('heritage_words').update({ active: true }).eq('id', entry.id)
})
afterEach(() => {
  release?.()
  release = undefined
  pending = undefined
  unavailable = false
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('active-heritage-words')
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

const locales = [
  { lang: 'hr' as const, loading: 'Učitavam pitanja…', empty: 'Trebamo još riječi', prompt: 'Što znači ova riječ?', progress: 'Odgovorena pitanja', error: 'Pitanja trenutačno nisu dostupna.', retry: 'Pokušaj opet' }
]

describe.each(locales)('$lang multiple-choice page', ({ lang, loading, empty, prompt, progress, error, retry }) => {
  it('loads active words into a playable question with four localized options and progress', async () => {
    const page = await mountQuiz(lang)
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    const headword = page.get('#question-word').text()
    expect(seeds.map(word => word.headword)).toContain(headword)
    expect(page.get('legend').text()).toBe(prompt)
    expect(page.text()).toContain(lang === 'hr' ? 'Uzorak — riječi još nisu provjerene' : 'Sample — these words are not yet verified')
    expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe(progress)
    expect(page.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    expect(page.findAll('[data-option-id]').map(option => option.attributes('data-option-id')).sort()).toEqual(seeds.map(word => word.id).sort())
    for (const option of page.findAll('[data-option-id]')) {
      const entry = seeds.find(word => word.id === option.attributes('data-option-id'))!
      expect(option.text()).toContain(entry.meaning[lang])
    }
    expect(page.text()).not.toContain(loading)
    expect(page.text()).not.toContain(empty)
    // The fetched list also drives answer handling and moving to the next question.
    const correctId = seeds.find(word => word.headword === headword)!.id
    await page.get(`[data-option-id="${correctId}"]`).trigger('click')
    expect(page.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    expect(storedWord(correctId).known).toBe(1)
    expect(page.text()).toContain('Odgovoreno ukupno: 1')
    expect(page.text()).toContain(lang === 'hr' ? 'Bodovi: 1 / 4' : 'Score: 1 / 4')
    expect(page.get('[aria-live="polite"]').text()).toContain(lang === 'hr' ? 'Točno značenje:' : 'Correct meaning:')
    const next = page.findAll('button').find(button => button.text() === (lang === 'hr' ? 'Sljedeća riječ' : 'Next word'))!
    await next.trigger('click')
    expect(page.get('#question-word').text()).not.toBe(headword)
    expect(page.text()).toContain(lang === 'hr' ? 'Pitanje 2 / 4' : 'Question 2 / 4')
  })

  it('shows loading rather than too few words until the active-word request finishes', async () => {
    pending = new Promise((resolve) => {
      release = resolve
    })
    const page = await mountQuiz(lang)
    expect(page.text()).toContain(loading)
    expect(page.text()).not.toContain(empty)
    expect(page.find('[data-option-id]').exists()).toBe(false)
    release!()
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    expect(page.text()).not.toContain(loading)
  })

  it('shows a localized error and retries the active-word request', async () => {
    unavailable = true
    const page = await mountQuiz(lang)
    await expect.poll(() => page.text()).toContain(error)
    expect(page.text()).not.toContain(empty)
    expect(page.find('[data-option-id]').exists()).toBe(false)
    const button = page.findAll('button').find(button => button.text() === retry)!
    expect(button).toBeDefined()
    unavailable = false
    await button.trigger('click')
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
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
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    const headword = page.get('#question-word').text()
    const entry = seeds.find(word => word.headword === headword)!
    // Not before answering, and no generic link to the home page's contribution form either.
    expect(page.find('[data-testid="quiz-differently"]').exists()).toBe(false)
    expect(page.findAll('button, a').some(item => item.text() === 'Kod nas se kaže drugačije')).toBe(false)
    expect(page.find('a[href*="doprinos"]').exists()).toBe(false)

    await page.get(`[data-option-id="${entry.id}"]`).trigger('click')
    const trigger = page.get('[data-testid="quiz-differently"]')
    expect(trigger.text()).toBe('Kod nas se kaže drugačije')
    expect(dialog()).toBeNull()
    await trigger.trigger('click')
    await vi.waitFor(() => expect(dialog()).not.toBeNull())
    expect(dialog()!.querySelector('[data-testid="variant-dialog-word"]')!.textContent).toContain(entry.headword)

    // Closing it keeps the answered question; the next question hides the button again.
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(dialog()).toBeNull())
    expect(page.get('#question-word').text()).toBe(headword)
    await page.findAll('button').find(button => button.text() === 'Sljedeća riječ')!.trigger('click')
    expect(page.find('[data-testid="quiz-differently"]').exists()).toBe(false)
  })
})

describe('limited active words', () => {
  it.each([0, 1, 2, 3])('handles %i active words after loading completes', async (count) => {
    for (const entry of seeds.slice(count)) await db.from('heritage_words').update({ active: false }).eq('id', entry.id)
    const page = await mountQuiz()
    if (count < 2) {
      await expect.poll(() => page.text()).toContain('Trebamo još riječi')
      expect(page.text()).toContain('barem dva različita značenja')
      expect(page.find('[data-option-id]').exists()).toBe(false)
    } else {
      await expect.poll(() => page.findAll('[data-option-id]').length).toBe(count)
      expect(page.text()).toContain(`Za ovu riječ imamo ${count} različita ponuđena značenja.`)
      expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe('Odgovorena pitanja')
    }
  })
})

describe.each([
  { lang: 'hr' as const, next: 'Sljedeća riječ', results: 'Pogledaj rezultat', review: 'Riječi za ponavljanje', summary: 'Kaj to znači? 3/4', replay: 'Ponovi pogrešne (1)', noMisses: 'Bez pogreške', counter: 'Pitanje 1 / 1', copy: 'Kopiraj rezultat', copied: 'Kopirano!', path: '/potkalnicko-prigorje/igre/kviz' }
])('$lang quiz result', ({ lang, next, results, review, summary, replay, noMisses, counter, copy, copied, path }) => {
  async function answerCurrent(page: Awaited<ReturnType<typeof mountQuiz>>, correct: boolean) {
    const headword = page.get('#question-word').text()
    const entry = seeds.find(word => word.headword === headword)!
    const pick = correct ? entry.id : seeds.find(word => word.id !== entry.id)!.id
    await page.get(`[data-option-id="${pick}"]`).trigger('click')
    await page.findAll('button').find(button => [next, results].includes(button.text()))!.trigger('click')
    return headword
  }

  it('reviews the missed word, replays only it, and shares a spoiler-free result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const page = await mountQuiz(lang)
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    const missedWord = await answerCurrent(page, false)
    const missedId = seeds.find(word => word.headword === missedWord)!.id
    expect(storedWord(missedId).missed).toBe(1)
    for (let i = 0; i < 3; i++) await answerCurrent(page, true)

    await expect.poll(() => page.find('[data-testid="quiz-review"]').exists()).toBe(true)
    const reviewBox = page.get('[data-testid="quiz-review"]')
    expect(reviewBox.text()).toContain(review)
    const rows = reviewBox.findAll('li')
    expect(rows).toHaveLength(1)
    const entry = seeds.find(word => word.headword === missedWord)!
    expect(rows[0]!.text()).toContain(missedWord)
    expect(rows[0]!.text()).toContain(entry.meaning[lang])

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
    expect(copy).not.toBe(copied)
    expect(page.find('[data-testid="challenge-create"]').exists()).toBe(true)
    const resultHtml = page.html()
    expect(resultHtml.indexOf('data-testid="challenge-create"')).toBeLessThan(resultHtml.indexOf('data-testid="quiz-share"'))

    // Replaying the misses asks only that word, and a practice round is not shared.
    const replayButton = page.get('[data-testid="quiz-replay-missed"]')
    expect(replayButton.text()).toBe(replay)
    await replayButton.trigger('click')
    expect(page.text()).toContain(counter)
    expect(page.get('#question-word').text()).toBe(missedWord)
    await answerCurrent(page, true)
    await expect.poll(() => page.find('[data-testid="quiz-review"]').exists()).toBe(true)
    expect(page.get('[data-testid="quiz-review"]').text()).toContain(noMisses)
    expect(page.find('[data-testid="quiz-replay-missed"]').exists()).toBe(false)
    expect(page.find('[data-testid="quiz-share"]').exists()).toBe(false)
    expect(page.find('[data-testid="challenge-create"]').exists()).toBe(false)
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
      const page = await mountQuiz(lang)
      await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
      // 13 active words, one round of ten.
      expect(page.text()).toContain(lang === 'hr' ? 'Pitanje 1 / 10' : 'Question 1 / 10')
      expect(page.text()).toContain(lang === 'hr' ? 'Bodovi: 0 / 10' : 'Score: 0 / 10')
    } finally {
      for (const entry of extras) await db.from('heritage_words').delete().eq('id', entry.id)
    }
  })
})
