import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createClient } from '@supabase/supabase-js'
import { clearNuxtData, useNuxtApp } from '#imports'
import Quiz from '../app/pages/heritage/kviz.vue'
import Cards from '../app/pages/heritage/kartice.vue'
import sampleWords from '../content/heritage/words.json'
import sampleAreas from '../content/heritage/areas.json'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'

const fake = await startFakeSupabase()
const db = createClient(fake.url, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const seeds = sampleWords.slice(0, 4)
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let pending: Promise<void> | undefined
let release: (() => void) | undefined
let unavailable = false

// Exercise the real useHeritage fetch and its reactive updates, with active rows from the
// same fake Supabase REST server as the API suite. Production API filtering is covered there.
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

async function mountQuiz(lang: 'hr' | 'en') {
  await useNuxtApp().$i18n.setLocale(lang)
  wrapper = await mountSuspended(Quiz, { route: `${lang === 'en' ? '/en' : ''}/heritage/kviz` })
  return wrapper
}

async function mountCards(lang: 'hr' | 'en') {
  await useNuxtApp().$i18n.setLocale(lang)
  wrapper = await mountSuspended(Cards, { route: `${lang === 'en' ? '/en' : ''}/heritage/kartice` })
  return wrapper
}

const locales = [
  { lang: 'hr' as const, loading: 'Učitavam pitanja…', empty: 'Trebamo još riječi', prompt: 'Što znači ova riječ?', progress: 'Odgovorena pitanja', error: 'Pitanja trenutačno nisu dostupna.', retry: 'Pokušaj opet' },
  { lang: 'en' as const, loading: 'Loading questions…', empty: 'We need a few more words', prompt: 'What does this word mean?', progress: 'Questions answered', error: 'Questions are currently unavailable.', retry: 'Try again' }
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
  { lang: 'hr' as const, counter: 'Kartica 1 od 4', flip: 'Okreni karticu', unknown: 'Ne znam', next: 'Kartica 2 od 4' },
  { lang: 'en' as const, counter: 'Card 1 of 4', flip: 'Flip the card', unknown: 'I don’t know', next: 'Card 2 of 4' }
])('$lang flip-card page', ({ lang, counter, flip, unknown, next }) => {
  it('localizes controls and announces flips and the next card', async () => {
    const page = await mountCards(lang)
    await expect.poll(() => page.text()).toContain(counter)
    const flipButton = page.findAll('button').find(button => button.text() === flip)!
    await flipButton.trigger('click')
    const spoken = page.findAll('[aria-live="polite"]').map(region => region.text()).find(Boolean)!
    const current = seeds.find(word => spoken.includes(`${word.headword}: ${word.meaning.hr}`))
    expect(current).toBeDefined()
    if (lang === 'en') expect(spoken).toContain(`(${current!.meaning.en})`)

    const unknownButton = page.findAll('button').find(button => button.text().includes(unknown))!
    await unknownButton.trigger('click')
    expect(page.findAll('[aria-live="polite"]').some(region => region.text().includes(next))).toBe(true)
  })
})

describe.each([
  { lang: 'hr' as const, differently: 'Kod nas se kaže drugačije', close: 'Zatvori', prefill: 'Umjesto „{word}“ kod nas se kaže: ' },
  { lang: 'en' as const, differently: 'Where I’m from, we say it differently', close: 'Close', prefill: 'Instead of “{word}”, where I’m from we say: ' }
])('$lang card contribution form', ({ lang, differently, close, prefill }) => {
  it('opens the prefilled variant form inline without leaving the cards', async () => {
    const page = await mountCards(lang)
    await expect.poll(() => page.text()).toContain(lang === 'hr' ? 'Kartica 1 od 4' : 'Card 1 of 4')
    const headword = page.findAll('p').find(paragraph => paragraph.classes().includes('text-4xl'))!.text()
    expect(seeds.map(word => word.headword)).toContain(headword)
    const flip = page.findAll('button').find(button => button.text() === (lang === 'hr' ? 'Okreni karticu' : 'Flip the card'))!
    await flip.trigger('click')
    // The first matching control is the one on the card back, the second the page-level trigger.
    const trigger = page.findAll('button').find(button => button.text() === differently)!
    await trigger.trigger('click')
    const textarea = page.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe(prefill.replace('{word}', headword))
    // Still on the card: its counter is visible and the form was not a navigation.
    expect(page.text()).toContain(lang === 'hr' ? 'Kartica 1 od 4' : 'Card 1 of 4')
    const closeButton = page.findAll('button').find(button => button.text() === close)!
    await closeButton.trigger('click')
    expect(page.find('textarea').exists()).toBe(false)
  })
})

describe('limited active words', () => {
  it.each([0, 1, 2, 3])('handles %i active words after loading completes', async (count) => {
    for (const entry of seeds.slice(count)) await db.from('heritage_words').update({ active: false }).eq('id', entry.id)
    const page = await mountQuiz('en')
    if (count < 2) {
      await expect.poll(() => page.text()).toContain('We need a few more words')
      expect(page.text()).toContain('at least two distinct meanings')
      expect(page.find('[data-option-id]').exists()).toBe(false)
    } else {
      await expect.poll(() => page.findAll('[data-option-id]').length).toBe(count)
      expect(page.text()).toContain(`This word has ${count} distinct answer choices available.`)
      expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe('Questions answered')
    }
  })
})

describe.each([
  { lang: 'hr' as const, next: 'Sljedeća riječ', results: 'Pogledaj rezultat', review: 'Riječi za ponavljanje', summary: 'Kaj to znači? 3/4', replay: 'Ponovi pogrešne (1)', noMisses: 'Bez pogreške', counter: 'Pitanje 1 / 1', copy: 'Kopiraj rezultat', copied: 'Kopirano!', path: '/heritage/kviz' },
  { lang: 'en' as const, next: 'Next word', results: 'See your score', review: 'Words to review', summary: 'Kaj to znači? 3/4', replay: 'Replay missed (1)', noMisses: 'No misses', counter: 'Question 1 / 1', copy: 'Copy result', copied: 'Copied!', path: '/en/heritage/kviz' }
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
