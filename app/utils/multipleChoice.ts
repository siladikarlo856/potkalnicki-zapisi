import type { WordEntry } from '../types/heritage'

import { pickDistractors, shuffled } from '~~/shared/utils/multipleChoice'
import type { Random } from '~~/shared/utils/multipleChoice'

export { seededRandom, shuffled } from '~~/shared/utils/multipleChoice'
export type { Random } from '~~/shared/utils/multipleChoice'
export type MeaningLocale = 'hr' | 'en'

export interface MeaningOption {
  id: string
  text: string
  lang: MeaningLocale
}

export interface MeaningQuestion {
  entry: WordEntry
  options: MeaningOption[]
  correctOptionId: string
}

export function meaningOption(entry: WordEntry, locale: MeaningLocale): MeaningOption {
  const english = locale === 'en' ? entry.meaning.en?.trim() : undefined
  return { id: entry.id, text: english || entry.meaning.hr.trim(), lang: english ? 'en' : 'hr' }
}

/** No authored distractors yet: draw distinct meanings from other entries in this list. */
export function createMeaningQuestions(words: readonly WordEntry[], locale: MeaningLocale, random: Random): MeaningQuestion[] {
  const questions: MeaningQuestion[] = []
  for (const entry of words) {
    const correct = meaningOption(entry, locale)
    if (!correct.text) continue
    const options = [correct, ...pickDistractors(entry, words, random, 3, locale).map(word => meaningOption(word, locale))]
    // One option would give a free point rather than a meaningful question.
    if (options.length > 1) questions.push({ entry, options: shuffled(options, random), correctOptionId: correct.id })
  }
  return shuffled(questions, random)
}

export function isCorrectAnswer(question: MeaningQuestion, optionId: string): boolean {
  return question.options.some(option => option.id === optionId) && optionId === question.correctOptionId
}

/** One round asks at most this many questions, however many words are active. */
export const QUIZ_LENGTH = 10

/** The questions are already shuffled, so the first ones are a fair random sample. */
export function limitQuestions(questions: MeaningQuestion[], limit = QUIZ_LENGTH): MeaningQuestion[] {
  return questions.slice(0, limit)
}

export interface MeaningGame {
  questions: MeaningQuestion[]
  index: number
  selectedOptionId: string | null
  score: number
  /** One entry per answered question, in order: whether it was right. */
  results: boolean[]
}

export function startMeaningGame(questions: MeaningQuestion[]): MeaningGame {
  return { questions, index: 0, selectedOptionId: null, score: 0, results: [] }
}

export function answerMeaningQuestion(game: MeaningGame, optionId: string): MeaningGame {
  const question = game.questions[game.index]
  if (!question || game.selectedOptionId !== null || !question.options.some(option => option.id === optionId)) return game
  const right = isCorrectAnswer(question, optionId)
  return { ...game, selectedOptionId: optionId, score: game.score + Number(right), results: [...game.results, right] }
}

export function advanceMeaningGame(game: MeaningGame): MeaningGame {
  if (game.selectedOptionId === null || isMeaningGameOver(game)) return game
  return { ...game, index: game.index + 1, selectedOptionId: null }
}

export function isMeaningGameOver(game: MeaningGame): boolean {
  return game.index >= game.questions.length
}

/** The questions answered wrongly so far, in the order they were asked. */
export function missedQuestions(game: MeaningGame): MeaningQuestion[] {
  return game.questions.filter((_, index) => game.results[index] === false)
}

/** A fresh round of only the missed questions, with new orders for the questions and their choices. */
export function replayMissedGame(game: MeaningGame, random: Random): MeaningGame {
  const missed = missedQuestions(game).map(question => ({ ...question, options: shuffled(question.options, random) }))
  return startMeaningGame(shuffled(missed, random))
}
