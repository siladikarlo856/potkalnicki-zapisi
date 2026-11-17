import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import Shell from '../app/components/games/Shell.vue'
import KakSeVeli from '../app/pages/igre/kak-se-veli.vue'
import { GAME_SCORES_KEY } from '../shared/utils/games/scores'
import type { GameQuestion } from '../shared/utils/games/types'
import { PROGRESS_STORAGE_KEY } from '../app/composables/useProgress'
import { usePzTabBar } from '../app/composables/usePzTabBar'

const words = ['krumper', 'avijon', 'afinger', 'srednja', 'zdenec'].map((headword, i) => ({
  kind: 'word' as const,
  key: `word:w${i}` as const,
  id: `w${i}`,
  topics: ['rijeci'],
  headword,
  meaning: `značenje ${i}`,
  variants: [headword],
  status: 'community' as const,
  transparency: 0,
  difficulty: 2 as const,
  partOfSpeech: 'imenica'
}))
registerEndpoint('/api/learn/pool', () => ({
  version: 1, generatedAt: '2026-11-04T00:00:00.000Z', cards: words, municipalities: [], settlements: [], topics: []
}))

const question = (n: number, withPath = false): GameQuestion => ({
  id: `rijec_word_w${n}`,
  gameId: 'rijec',
  card: `word:w${n}`,
  prompt: { hr: `Pitanje ${n}?`, en: `Question ${n}?` },
  options: [{ hr: 'A', en: 'A' }, { hr: 'B', en: 'B' }, { hr: 'C', en: 'C' }],
  correct: n % 3,
  explanation: { hr: `Objašnjenje ${n}.`, en: `Explanation ${n}.` },
  ...(withPath ? { archivePath: '/naselja/apatovec' } : {})
})
const questions = [question(0, true), question(1), question(2)]
const OPTION = '[data-testid^="game-option-"]'
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined

beforeEach(() => {
  localStorage.clear()
  clearNuxtState(['heritage-progress', 'heritage-progress-loaded', 'pz-game-scores', 'pz-game-scores-loaded'])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('card-pool')
  vi.restoreAllMocks()
})

async function mountShell() {
  wrapper = await mountSuspended(Shell, { props: { gameId: 'rijec', title: 'Kak se to veli?', questions } })
  return wrapper
}

const wrongIndex = (q: GameQuestion) => (q.correct + 1) % q.options.length

describe('GameShell', () => {
  it('holds the tab bar down while a round is in play and releases it for the result and on leaving', async () => {
    const { hidden, holds } = usePzTabBar()
    const shell = await mountShell()
    expect(holds.value).toEqual(['game'])
    expect(hidden.value).toBe(true)
    for (const q of questions) {
      await shell.get(`[data-testid="game-option-${q.correct}"]`).trigger('click')
      await shell.get('[data-testid="game-next"]').trigger('click')
    }
    expect(hidden.value).toBe(false)
    shell.unmount()
    wrapper = undefined
    expect(hidden.value).toBe(false)
  })

  it('shows the header, the options and the score', async () => {
    const page = await mountShell()
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 3')
    expect(page.get('[data-testid="game-score"]').text()).toBe('Bodovi: 0')
    expect(page.get('[data-testid="game-prompt"]').text()).toBe('Pitanje 0?')
    expect(page.findAll(OPTION)).toHaveLength(3)
    expect(page.find('[data-testid="game-feedback"]').exists()).toBe(false)
    expect(page.find('[data-testid="game-next"]').exists()).toBe(false)
  })

  it('answers, moves focus to the feedback heading, marks options with text and records word progress', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const page = await mountShell()
    await page.get(`[data-testid="game-option-${wrongIndex(questions[0]!)}"]`).trigger('click')
    const feedback = page.get('[data-testid="game-feedback"]')
    expect(feedback.attributes('aria-live')).toBe('polite')
    expect(feedback.text()).toContain('Nije točno.')
    expect(feedback.text()).toContain('Točan odgovor: A')
    expect(feedback.text()).toContain('Objašnjenje 0.')
    expect(focus.mock.contexts.some(element => (element as HTMLElement).dataset.testid === 'game-feedback-heading')).toBe(true)
    // ✓ and ✗ are text for assistive tech as well as icons.
    expect(page.get('[data-testid="game-option-0"]').text()).toContain('Točan odgovor')
    expect(page.get(`[data-testid="game-option-${wrongIndex(questions[0]!)}"]`).text()).toContain('Tvoj odgovor')
    expect(page.findAll(OPTION).every(option => option.attributes('aria-disabled') === 'true')).toBe(true)
    expect(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!).cards['word:w0'].missed).toBe(1)
    // A second click on a locked option changes nothing.
    await page.get('[data-testid="game-option-0"]').trigger('click')
    expect(page.get('[data-testid="game-score"]').text()).toBe('Bodovi: 0')
    // The record link and the correction dialog belong to the question's card.
    expect(page.get('[data-testid="game-open-record"]').attributes('href')).toContain('/naselja/apatovec')
    expect(page.find('[data-testid="game-suggest"]').exists()).toBe(true)
  })

  it('moves to the next question with Dalje and focuses its prompt', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const page = await mountShell()
    await page.get(`[data-testid="game-option-${questions[0]!.correct}"]`).trigger('click')
    expect(page.get('[data-testid="game-score"]').text()).toBe('Bodovi: 1')
    expect(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!).cards['word:w0'].known).toBe(1)
    focus.mockClear()
    await page.get('[data-testid="game-next"]').trigger('click')
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 2 od 3')
    expect(page.get('[data-testid="game-prompt"]').text()).toBe('Pitanje 1?')
    expect(page.find('[data-testid="game-feedback"]').exists()).toBe(false)
    expect(focus.mock.contexts.some(element => (element as HTMLElement).id === 'game-question')).toBe(true)
  })

  it('selects with the keys 1 to 3 and ignores 4 when there are only three options', async () => {
    const page = await mountShell()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }))
    expect(page.find('[data-testid="game-feedback"]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: String(questions[0]!.correct + 1) }))
    await vi.waitFor(() => expect(page.find('[data-testid="game-feedback"]').exists()).toBe(true))
    expect(page.get('[data-testid="game-score"]').text()).toBe('Bodovi: 1')
  })

  it('ends with the score, the misses and the best score saved on the device', async () => {
    const page = await mountShell()
    for (const [i, q] of questions.entries()) {
      await page.get(`[data-testid="game-option-${i === 1 ? wrongIndex(q) : q.correct}"]`).trigger('click')
      await page.get('[data-testid="game-next"]').trigger('click')
    }
    expect(page.get('[data-testid="game-result-score"]').text()).toBe('2 / 3')
    expect(page.get('[data-testid="pz-squares"]').attributes('aria-label')).toBe('2 točno, 1 netočno')
    expect(page.findAll('[data-testid="game-miss"]')).toHaveLength(1)
    expect(page.get('[data-testid="game-miss"]').text()).toContain('Pitanje 1?')
    expect(page.get('[data-testid="game-miss"]').text()).toContain('Točan odgovor: B')
    expect(JSON.parse(localStorage.getItem(GAME_SCORES_KEY)!)).toMatchObject({ version: 1, best: { rijec: { score: 2, max: 3 } } })
    // Rijec has no creator round: it links to the challenge page instead of making one in place.
    // The primary action of the result is the challenge, ahead of the share and the replay buttons.
    const primary = page.get('[data-testid="game-make-challenge"]')
    expect(primary.text()).toBe('Izazovi prijatelje s ovom rundom')
    expect(primary.attributes('href')).toContain('/izazov')
    expect(page.find('[data-testid="challenge-create"]').exists()).toBe(false)
    const buttons = page.findAll('a[data-testid], button[data-testid]').map(button => button.attributes('data-testid'))
    expect(buttons.indexOf('game-make-challenge')).toBeLessThan(buttons.indexOf('result-share-open'))
    expect(buttons.indexOf('result-share-open')).toBeLessThan(buttons.indexOf('game-replay'))
    expect(page.get('[data-testid="result-share-open"]').text()).toBe('Podijeli rezultat')
    await page.get('[data-testid="result-share-open"]').trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="pz-share-text"]')).not.toBeNull())
    expect(document.body.querySelector('[data-testid="pz-share-text"]')!.textContent).toContain('Kak se to veli? · 2/3\n🟩🟥🟩\n')
  })

  it('keeps a better stored score and emits restart from "Igraj opet"', async () => {
    localStorage.setItem(GAME_SCORES_KEY, JSON.stringify({ version: 1, best: { rijec: { score: 3, max: 3, at: '2026-11-01T00:00:00.000Z' } } }))
    const page = await mountShell()
    for (const q of questions) {
      await page.get(`[data-testid="game-option-${wrongIndex(q)}"]`).trigger('click')
      await page.get('[data-testid="game-next"]').trigger('click')
    }
    expect(JSON.parse(localStorage.getItem(GAME_SCORES_KEY)!).best.rijec).toMatchObject({ score: 3, max: 3 })
    await page.get('[data-testid="game-replay"]').trigger('click')
    expect(page.emitted('restart')).toHaveLength(1)
  })

  it('shows the question again as practice that is not shared or saved', async () => {
    const page = await mountShell()
    for (const q of questions) {
      await page.get(`[data-testid="game-option-${wrongIndex(q)}"]`).trigger('click')
      await page.get('[data-testid="game-next"]').trigger('click')
    }
    await page.get('[data-testid="game-replay-missed"]').trigger('click')
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 3')
    for (let i = 0; i < 3; i++) {
      // Options are reshuffled, so find the correct one from the prompt's question.
      const n = Number(page.get('[data-testid="game-prompt"]').text().match(/\d/)![0])
      const texts = page.findAll(OPTION).map(option => option.text().replace(/^\d+\.?\s*/, ''))
      await page.get(`[data-testid="game-option-${texts.indexOf(['A', 'B', 'C'][questions[n]!.correct]!)}"]`).trigger('click')
      await page.get('[data-testid="game-next"]').trigger('click')
    }
    expect(page.get('[data-testid="game-result-score"]').text()).toBe('3 / 3')
    expect(page.find('[data-testid="result-share-open"]').exists()).toBe(false)
    expect(page.find('[data-testid="game-make-challenge"]').exists()).toBe(false)
    // The 0/3 first round saved nothing, and the 3/3 practice round saves nothing either.
    expect(localStorage.getItem(GAME_SCORES_KEY)).toBeNull()
  })

  it('resets to the first question when new questions arrive', async () => {
    const page = await mountShell()
    await page.get(`[data-testid="game-option-${questions[0]!.correct}"]`).trigger('click')
    await page.setProps({ questions: [question(2), question(1)] })
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 2')
    expect(page.get('[data-testid="game-score"]').text()).toBe('Bodovi: 0')
  })
})

describe('GameShell game kit', () => {
  it('lists the options as buttons with aria-pressed before the answer', async () => {
    const page = await mountShell()
    const options = page.findAll(OPTION)
    expect(options.every(option => option.element.tagName === 'BUTTON')).toBe(true)
    expect(options.every(option => option.attributes('aria-pressed') === 'false')).toBe(true)
    expect(page.find('[role="radiogroup"], [role="radio"]').exists()).toBe(false)
    expect(page.find('[data-testid="game-answer-tag"]').exists()).toBe(false)
  })

  it('marks the right and the wrong option with an icon and a word after a wrong answer', async () => {
    const page = await mountShell()
    const wrong = wrongIndex(questions[0]!)
    await page.get(`[data-testid="game-option-${wrong}"]`).trigger('click')
    const right = page.get(`[data-testid="game-option-${questions[0]!.correct}"]`)
    const picked = page.get(`[data-testid="game-option-${wrong}"]`)
    expect(right.get('[data-testid="game-answer-tag"]').text()).toBe('Točan odgovor')
    expect(right.find('[class*="lucide:check"]').exists()).toBe(true)
    expect(picked.get('[data-testid="game-answer-tag"]').text()).toBe('Tvoj odgovor')
    expect(picked.find('[class*="lucide:x"]').exists()).toBe(true)
    expect(right.attributes('data-state')).toBe('correct')
    expect(picked.attributes('data-state')).toBe('wrong')
    // Options lose aria-pressed once they are locked.
    expect(page.findAll(OPTION).every(option => option.attributes('aria-pressed') === undefined)).toBe(true)
  })

  it('says "Točno" on the option the player got right', async () => {
    const page = await mountShell()
    await page.get(`[data-testid="game-option-${questions[0]!.correct}"]`).trigger('click')
    expect(page.get('[data-testid="game-answer-tag"]').text()).toBe('Točno')
  })

  it('shows feedback as a status region: verdict, the right answer, why, then the links', async () => {
    const page = await mountShell()
    await page.get(`[data-testid="game-option-${wrongIndex(questions[0]!)}"]`).trigger('click')
    const feedback = page.get('[data-testid="game-feedback"]')
    expect(feedback.attributes('role')).toBe('status')
    expect(feedback.attributes('aria-live')).toBe('polite')
    expect(feedback.get('h3').text()).toBe('Nije točno.')
    expect(feedback.text()).toMatch(/Nije točno\.\s*Točan odgovor: A\.\s*Objašnjenje 0\./)
    const html = feedback.html()
    expect(html.indexOf('Objašnjenje 0.')).toBeLessThan(html.indexOf('data-testid="game-open-record"'))
  })

  it('names the progress with a text label next to the bar', async () => {
    const page = await mountShell()
    expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 3')
    expect(page.get('[role="progressbar"]').exists()).toBe(true)
  })

  it('never advances by itself: Dalje is the only way on', async () => {
    vi.useFakeTimers()
    try {
      const page = await mountShell()
      await page.get(`[data-testid="game-option-${questions[0]!.correct}"]`).trigger('click')
      await vi.advanceTimersByTimeAsync(60_000)
      expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 3')
      expect(page.find('[data-testid="game-feedback"]').exists()).toBe(true)
      await page.get('[data-testid="game-next"]').trigger('click')
      expect(page.get('[data-testid="game-progress"]').text()).toBe('Pitanje 2 od 3')
    } finally {
      vi.useRealTimers()
    }
  })

  it('puts Dalje in the sticky action bar, and reads "Pogledaj rezultat" on the last question', async () => {
    const page = await mountShell()
    expect(page.find('[data-testid="pz-sticky-action-bar"]').exists()).toBe(false)
    await page.get(`[data-testid="game-option-${questions[0]!.correct}"]`).trigger('click')
    const bar = page.get('[data-testid="pz-sticky-action-bar"]')
    expect(bar.get('[data-testid="game-next"]').text()).toBe('Dalje')
    await page.get('[data-testid="game-next"]').trigger('click')
    await page.get(`[data-testid="game-option-${questions[1]!.correct}"]`).trigger('click')
    await page.get('[data-testid="game-next"]').trigger('click')
    await page.get(`[data-testid="game-option-${questions[2]!.correct}"]`).trigger('click')
    expect(page.get('[data-testid="game-next"]').text()).toBe('Pogledaj rezultat')
    expect(page.get('[data-testid="game-next-desktop"]').text()).toBe('Pogledaj rezultat')
  })
})

describe('Kak se to veli?', () => {
  it('opens on a start screen with Srednje selected and starts a ten-question round', async () => {
    wrapper = await mountSuspended(KakSeVeli, { route: '/igre/kak-se-veli' })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="game-start"]').exists()).toBe(true))
    const levels = ['lako', 'srednje', 'tesko'].map(id => wrapper!.get(`[data-testid="game-level-${id}"]`))
    expect(levels.map(level => level.text())).toEqual(['Lako', 'Srednje', 'Teško'])
    expect(levels.map(level => level.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    await levels[2]!.trigger('click')
    expect(wrapper.get('[data-testid="game-level-tesko"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="game-start-button"]').text()).toBe('Kreni')
    await wrapper.get('[data-testid="game-start-button"]').trigger('click')
    expect(wrapper.find('[data-testid="game-start"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="game-prompt"]').text()).toMatch(/^Kak se kod nas veli „značenje \d”\?$/)
    expect(wrapper.get('[data-testid="game-progress"]').text()).toBe('Pitanje 1 od 5')
    expect(wrapper.findAll(OPTION).length).toBeGreaterThanOrEqual(2)
  })
})
