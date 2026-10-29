import { describe, expect, it } from 'vitest'
import type { WordEntry } from '../app/types/heritage'
import { advanceMeaningGame, answerMeaningQuestion, createMeaningQuestions, isCorrectAnswer, isMeaningGameOver, meaningOption, seededRandom, shuffled, startMeaningGame } from '../app/utils/multipleChoice'
import sampleWords from '../content/heritage/words.json'

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
