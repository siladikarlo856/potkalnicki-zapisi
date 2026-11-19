import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GameCard from '../app/components/games/GameCard.vue'
import Shell from '../app/components/games/Shell.vue'
import Pick from '../app/components/Pick.vue'
import QuestionDots from '../app/components/QuestionDots.vue'
import ResultSummary from '../app/components/ResultSummary.vue'
import { GAME_CATALOGUE, GAME_GROUPS, gameGroupOf, gameTypeOf, isListedGame } from '../shared/utils/games/catalogue'
import type { GameQuestion } from '../shared/utils/games/types'

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('games catalogue grouping', () => {
  it('puts every listed game in one of the four groups and gives it a question type', () => {
    const ids = new Set(GAME_GROUPS.map(group => group.id))
    const listed = GAME_CATALOGUE.filter(isListedGame)
    expect(listed.length).toBeGreaterThan(0)
    for (const game of listed) {
      expect(ids.has(gameGroupOf(game))).toBe(true)
      expect(gameTypeOf(game)).not.toBeNull()
    }
    expect(GAME_CATALOGUE.filter(game => !isListedGame(game)).map(game => game.id).sort()).toEqual(['kartice', 'rijec-dana'])
  })
})

describe('GameCard', () => {
  it('is one link with the question type and, before the first game, "Još nije igrano"', async () => {
    const game = GAME_CATALOGUE.find(entry => entry.id === 'znacenje')!
    wrapper = await mountSuspended(GameCard, { props: { game } })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toContain('/igre/kviz')
    expect(wrapper.get('[data-testid="kind-tag"]').text()).toBe('Odabir odgovora')
    expect(wrapper.get('[data-testid="game-card-status"]').text()).toBe('Još nije igrano')
  })

  it('says "Uskoro" for a game that cannot be played yet and links to where to help', async () => {
    const game = GAME_CATALOGUE.find(entry => entry.status === 'soon')!
    wrapper = await mountSuspended(GameCard, { props: { game, soonHref: '/doprinesi/' } })
    expect(wrapper.get('[data-testid="game-card-status"]').text()).toBe('Uskoro')
    expect(wrapper.attributes('href')).toContain('/doprinesi/')
  })
})

describe('QuestionDots', () => {
  it('carries each state in an icon and in hidden text', async () => {
    wrapper = await mountSuspended(QuestionDots, { props: { states: ['right', 'wrong', 'skipped', 'upcoming'], current: 3 } })
    const dots = wrapper.findAll('li')
    expect(dots.map(dot => dot.attributes('data-state'))).toEqual(['right', 'wrong', 'skipped', 'upcoming'])
    expect(dots[1]!.text()).toContain('2. pitanje: netočno')
    expect(dots[3]!.attributes('aria-current')).toBe('step')
  })
})

describe('Pick', () => {
  it('is a native radio group with the description under each name', async () => {
    wrapper = await mountSuspended(Pick, {
      props: { legend: 'Težina', name: 'level', modelValue: 'b', options: [{ value: 'a', label: 'Lako', description: 'Jednostavno.' }, { value: 'b', label: 'Teško' }] }
    })
    expect(wrapper.get('legend').text()).toBe('Težina')
    const inputs = wrapper.findAll('input[type="radio"]').map(input => (input.element as HTMLInputElement).checked)
    expect(inputs).toEqual([false, true])
    expect(wrapper.text()).toContain('Jednostavno.')
  })
})

describe('ResultSummary', () => {
  it('shows the score with a hidden prefix, the sentence, the dots and three facts', async () => {
    wrapper = await mountSuspended(ResultSummary, {
      props: { caption: 'Kviz · rezultat', correct: 8, total: 10, sentence: 'Sve točno.', states: ['right', 'wrong'], stats: [{ value: '8/10', label: 'točnih' }, { value: '1:05', label: 'vrijeme' }, { value: '9/10', label: 'najbolji rezultat' }] }
    })
    expect(wrapper.get('[data-testid="game-result-score"]').text()).toBe('Rezultat: 8/10')
    expect(wrapper.get('[data-testid="game-result-verdict"]').text()).toBe('Sve točno.')
    expect(wrapper.findAll('[data-testid="result-stats"] dd').map(stat => stat.text())).toEqual(['8/10', '1:05', '9/10'])
  })
})

const question = (n: number): GameQuestion => ({
  id: `rijec_word_w${n}`,
  gameId: 'rijec',
  card: `word:w${n}`,
  prompt: { hr: `Pitanje ${n}?`, en: `Question ${n}?` },
  options: [{ hr: 'A', en: 'A' }, { hr: 'B', en: 'B' }],
  correct: 0,
  explanation: { hr: 'Zato.', en: 'Because.' }
})

describe('round: Provjeri, Preskoči, Dalje', () => {
  it('keeps Provjeri disabled until an option is marked and checks only on Provjeri', async () => {
    wrapper = await mountSuspended(Shell, { props: { gameId: 'rijec', title: 'Igra', questions: [question(0), question(1)] } })
    expect(wrapper.get('[data-testid="game-check"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="game-option-1"]').trigger('click')
    expect(wrapper.get('[data-testid="game-option-1"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="game-feedback"]').exists()).toBe(false)
    await wrapper.get('[data-testid="game-check"]').trigger('click')
    expect(wrapper.get('[data-testid="game-feedback-heading"]').text()).toBe('Netočno')
    expect(wrapper.find('[data-testid="game-skip"]').exists()).toBe(false)
  })

  it('skips a question without feedback and shows it as skipped on the result', async () => {
    wrapper = await mountSuspended(Shell, { props: { gameId: 'rijec', title: 'Igra', questions: [question(0), question(1)] } })
    await wrapper.get('[data-testid="game-skip"]').trigger('click')
    expect(wrapper.find('[data-testid="game-feedback"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="game-progress"]').attributes('aria-valuetext')).toBe('2 od 2')
    await wrapper.get('[data-testid="game-skip"]').trigger('click')
    expect(wrapper.get('[data-testid="game-result-score"]').text()).toBe('Rezultat: 0/2')
    expect(wrapper.findAll('[data-testid="question-dots"] li').map(dot => dot.attributes('data-state'))).toEqual(['skipped', 'skipped'])
  })
})
