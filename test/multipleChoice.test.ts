import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../app/types/heritage'
import { QUIZ_LENGTH, advanceMeaningGame, answerMeaningQuestion, createMeaningQuestions, isCorrectAnswer, isMeaningGameOver, limitQuestions, meaningOption, missedQuestions, replayMissedGame, seededRandom, shuffled, startMeaningGame } from '../app/utils/multipleChoice'
import { resultEmojiRow, resultShareText } from '../app/utils/shareResult'
import sampleWords from './fixtures/heritage/words.json'

const words = sampleWords as WordEntry[]
function word(id: string, hr: string, partOfSpeech?: string, en?: string): WordEntry {
  return { id, headword: id, meaning: { hr, en }, partOfSpeech, variants: [], status: 'verified', sources: [] }
}

describe('meaning questions', () => {
  it.each(['hr', 'en'] as const)('offers four distinct meanings and exactly one correct answer in %s', (locale) => {
    const questions = createMeaningQuestions(words, locale, seededRandom(42))
    expect(questions).toHaveLength(words.length)
    for (const question of questions) {
      expect(question.options).toHaveLength(4)
      expect(new Set(question.options.map(option => option.text)).size).toBe(4)
      expect(question.options.filter(option => isCorrectAnswer(question, option.id))).toHaveLength(1)
      expect(question.options.find(option => isCorrectAnswer(question, option.id))?.text).toBe(question.entry.meaning[locale])
      for (const option of question.options.filter(option => option.id !== question.correctOptionId)) {
        expect(words.find(entry => entry.id === option.id)?.meaning[locale]).toBe(option.text)
        expect(option.id).not.toBe(question.entry.id)
      }
      expect(isCorrectAnswer(question, 'unknown-id')).toBe(false)
    }
  })

  it('prefers the same part of speech across gender qualifiers, then fills from other types', () => {
    const list = [word('a', 'A', 'imenica, ž. r.'), word('b', 'B', 'imenica, m. r.'), word('c', 'C', 'imenica'), word('d', 'D', 'imenica, s. r.'), word('e', 'E', 'glagol')]
    for (let seed = 0; seed < 20; seed++) {
      const question = createMeaningQuestions(list, 'hr', seededRandom(seed)).find(q => q.entry.id === 'a')!
      expect(new Set(question.options.map(option => option.id))).toEqual(new Set(['a', 'b', 'c', 'd']))
    }
    const fewerNouns = createMeaningQuestions(list.filter(entry => entry.id !== 'd'), 'hr', seededRandom(1)).find(q => q.entry.id === 'a')!
    expect(fewerNouns.options.map(option => option.id)).toContain('e')
  })

  it('never repeats the correct meaning or another distractor, including case and spacing differences', () => {
    const list = [word('a', 'kuća', 'imenica', 'house'), word('b', ' KUĆA ', 'imenica', 'home'), word('c', 'sat', 'imenica', ' HOUSE '), word('d', 'šećer', 'imenica', 'sugar'), word('e', ' šećer ', 'imenica', ' Sugar '), word('f', 'šešir', 'imenica', 'hat')]
    for (const locale of ['hr', 'en'] as const) {
      const question = createMeaningQuestions(list, locale, seededRandom(5)).find(q => q.entry.id === 'a')!
      const texts = question.options.map(option => option.text.trim().toLocaleLowerCase('hr'))
      expect(new Set(texts).size).toBe(texts.length)
      expect(question.options.map(option => option.id)).not.toContain('b')
      if (locale === 'en') expect(question.options.map(option => option.id)).not.toContain('c')
    }
  })

  it('uses Croatian and marks its language when an English meaning is missing or blank', () => {
    const entry = word('a', 'kuća', undefined, ' ')
    expect(meaningOption(entry, 'en')).toEqual({ id: 'a', text: 'kuća', lang: 'hr' })
    expect(meaningOption(word('b', 'sat', undefined, 'clock'), 'en').lang).toBe('en')
    expect(meaningOption(word('b', 'sat', undefined, 'clock'), 'hr').text).toBe('sat')
  })

  it('supports two or three distinct meanings and skips lists with no playable choice', () => {
    expect(createMeaningQuestions([], 'hr', seededRandom(1))).toEqual([])
    expect(createMeaningQuestions([word('a', 'sat')], 'hr', seededRandom(1))).toEqual([])
    expect(createMeaningQuestions([word('a', 'sat'), word('b', ' SAT ')], 'hr', seededRandom(1))).toEqual([])
    for (const size of [2, 3]) {
      const questions = createMeaningQuestions(words.slice(0, size), 'hr', seededRandom(1))
      expect(questions).toHaveLength(size)
      expect(questions.every(question => question.options.length === size)).toBe(true)
    }
  })

  it('repeats the same shuffle from a seed, varies across seeds, and leaves input untouched', () => {
    const original = structuredClone(words)
    const first = createMeaningQuestions(words, 'hr', seededRandom(123))
    expect(createMeaningQuestions(words, 'hr', seededRandom(123))).toEqual(first)
    expect(createMeaningQuestions(words, 'hr', seededRandom(456))).not.toEqual(first)
    expect(words).toEqual(original)
    expect(shuffled([1, 2, 3, 4], seededRandom(1)).sort()).toEqual([1, 2, 3, 4])
  })
})

describe('meaning game scoring and completion', () => {
  it('scores only the first valid pick, waits for next, finishes, and starts a fresh replay', () => {
    const questions = createMeaningQuestions(words.slice(0, 3), 'hr', seededRandom(1))
    let game = startMeaningGame(questions)
    expect(advanceMeaningGame(game)).toBe(game)
    expect(answerMeaningQuestion(game, 'invalid')).toBe(game)
    for (const [index, question] of questions.entries()) {
      expect(isMeaningGameOver(game)).toBe(false)
      const option = index === 1 ? question.options.find(option => option.id !== question.correctOptionId)! : question.options.find(option => option.id === question.correctOptionId)!
      game = answerMeaningQuestion(game, option.id)
      expect(game.index).toBe(index)
      expect(game.selectedOptionId).toBe(option.id)
      expect(answerMeaningQuestion(game, question.correctOptionId)).toBe(game)
      game = advanceMeaningGame(game)
      expect(game.selectedOptionId).toBeNull()
    }
    expect(game.score).toBe(2)
    expect(isMeaningGameOver(game)).toBe(true)
    expect(answerMeaningQuestion(game, questions[0]!.correctOptionId)).toBe(game)
    expect(advanceMeaningGame(game)).toBe(game)
    expect(startMeaningGame(questions)).toMatchObject({ index: 0, selectedOptionId: null, score: 0 })
    expect(isMeaningGameOver(startMeaningGame([]))).toBe(true)
  })
})

function manyWords(count: number) {
  return Array.from({ length: count }, (_, index) => word(`w${index}`, `meaning ${index}`, 'imenica'))
}

describe('quiz length', () => {
  it('asks at most ten questions, sampled from the shuffled list and repeatable from a seed', () => {
    expect(QUIZ_LENGTH).toBe(10)
    const all = createMeaningQuestions(manyWords(25), 'hr', seededRandom(7))
    expect(all).toHaveLength(25)
    const limited = limitQuestions(all)
    expect(limited).toHaveLength(10)
    expect(limited).toEqual(all.slice(0, 10))
    expect(new Set(limited.map(question => question.entry.id)).size).toBe(10)
    expect(limitQuestions(createMeaningQuestions(manyWords(25), 'hr', seededRandom(7)))).toEqual(limited)
    expect(limitQuestions(createMeaningQuestions(manyWords(25), 'hr', seededRandom(8)))).not.toEqual(limited)
  })

  it('keeps shorter lists whole and honours another limit', () => {
    const questions = createMeaningQuestions(manyWords(6), 'hr', seededRandom(1))
    expect(limitQuestions(questions)).toHaveLength(6)
    expect(limitQuestions(questions, 3)).toHaveLength(3)
    expect(limitQuestions([])).toEqual([])
  })
})

describe('missed questions and replay', () => {
  function play(picks: ('right' | 'wrong')[]) {
    const questions = createMeaningQuestions(manyWords(picks.length + 3), 'hr', seededRandom(3)).slice(0, picks.length)
    let game = startMeaningGame(questions)
    for (const [index, pick] of picks.entries()) {
      const question = questions[index]!
      const option = question.options.find(item => (item.id === question.correctOptionId) === (pick === 'right'))!
      game = advanceMeaningGame(answerMeaningQuestion(game, option.id))
    }
    return { game, questions }
  }

  it('records a result per answer and lists the wrong ones in the order they were asked', () => {
    const { game, questions } = play(['right', 'wrong', 'right', 'wrong'])
    expect(game.results).toEqual([true, false, true, false])
    expect(game.score).toBe(2)
    expect(missedQuestions(game)).toEqual([questions[1], questions[3]])
    expect(missedQuestions(startMeaningGame(questions))).toEqual([])
    expect(play(['right', 'right']).game.results.every(Boolean)).toBe(true)
  })

  it('does not record a second result when the same question is answered again', () => {
    const questions = createMeaningQuestions(manyWords(5), 'hr', seededRandom(3))
    let game = answerMeaningQuestion(startMeaningGame(questions), questions[0]!.correctOptionId)
    game = answerMeaningQuestion(game, questions[0]!.options.find(option => option.id !== questions[0]!.correctOptionId)!.id)
    expect(game.results).toEqual([true])
  })

  it('replays exactly the missed questions with the correct answer still among shuffled choices', () => {
    const { game } = play(['wrong', 'right', 'wrong', 'right', 'wrong'])
    const missed = missedQuestions(game)
    const replay = replayMissedGame(game, seededRandom(11))
    expect(replay).toMatchObject({ index: 0, selectedOptionId: null, score: 0, results: [] })
    expect(replay.questions.map(question => question.entry.id).sort()).toEqual(missed.map(question => question.entry.id).sort())
    for (const question of replay.questions) {
      const original = missed.find(item => item.entry.id === question.entry.id)!
      expect(question.correctOptionId).toBe(original.correctOptionId)
      expect(question.options.map(option => option.id).sort()).toEqual(original.options.map(option => option.id).sort())
    }
    expect(replayMissedGame(game, seededRandom(11))).toEqual(replay)
    expect(missed).toHaveLength(3)
  })

  it('gives an already finished empty round when nothing was missed, and leaves the source game alone', () => {
    const { game } = play(['right', 'right'])
    const before = structuredClone(game)
    expect(isMeaningGameOver(replayMissedGame(game, seededRandom(1)))).toBe(true)
    expect(game).toEqual(before)
  })

  it('lets the replay round be completed and scored like any other', () => {
    const { game } = play(['wrong', 'wrong'])
    let replay = replayMissedGame(game, seededRandom(2))
    for (const question of [...replay.questions]) {
      replay = advanceMeaningGame(answerMeaningQuestion(replay, question.correctOptionId))
    }
    expect(replay.score).toBe(2)
    expect(missedQuestions(replay)).toEqual([])
    expect(isMeaningGameOver(replay)).toBe(true)
  })
})

describe('shareable result text', () => {
  it('shows one square per question and the headline, in order', () => {
    expect(resultEmojiRow([true, false, true])).toBe('🟩🟥🟩')
    expect(resultEmojiRow([])).toBe('')
    expect(resultShareText('Kaj to znači? 2/3', [true, false, true])).toBe('Kaj to znači? 2/3\n🟩🟥🟩')
  })

  it('is spoiler-free: no headword, meaning or example appears in a result built from a played game', () => {
    const questions = createMeaningQuestions(words, 'hr', seededRandom(5))
    let game = startMeaningGame(questions)
    for (const [index, question] of questions.entries()) {
      const wrong = question.options.find(option => option.id !== question.correctOptionId)!.id
      game = advanceMeaningGame(answerMeaningQuestion(game, index % 2 ? wrong : question.correctOptionId))
    }
    // The headline is the game's name (which happens to be a sample word too), so check what the result adds.
    const text = resultShareText(`${game.score}/${game.results.length}`, game.results)
    for (const entry of words) {
      for (const secret of [entry.headword, entry.meaning.hr, entry.meaning.en].filter((value): value is string => Boolean(value))) {
        expect(text.toLocaleLowerCase('hr')).not.toContain(secret.toLocaleLowerCase('hr'))
      }
    }
    expect([...text.split('\n')[1]!].length).toBe(game.results.length)
  })
})
