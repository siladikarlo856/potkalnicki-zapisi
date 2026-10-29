import type { WordEntry } from '../types/heritage'

export type Random = () => number
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

/** A repeatable random source for tests; callers own the seed. */
export function seededRandom(seed: number): Random {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

function normalized(text: string) {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('hr')
}

function wordType(entry: WordEntry) {
  // Gender and other qualifiers do not make a noun a different part of speech.
  return normalized(entry.partOfSpeech?.split(',')[0] ?? '')
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
    const meanings = new Set([normalized(correct.text)])
    const croatianMeanings = new Set([normalized(entry.meaning.hr)])
    const others = shuffled(words.filter(word => word.id !== entry.id), random)
    const type = wordType(entry)
    const preferred = others.filter(word => type && wordType(word) === type)
    const fallback = others.filter(word => !type || wordType(word) !== type)
    const options = [correct]
    for (const word of [...preferred, ...fallback]) {
      const option = meaningOption(word, locale)
      const key = normalized(option.text)
      const hrKey = normalized(word.meaning.hr)
      if (!key || meanings.has(key) || croatianMeanings.has(hrKey)) continue
      options.push(option)
      meanings.add(key)
      croatianMeanings.add(hrKey)
      if (options.length === 4) break
    }
    // One option would give a free point rather than a meaningful question.
    if (options.length > 1) questions.push({ entry, options: shuffled(options, random), correctOptionId: correct.id })
  }
  return shuffled(questions, random)
}

export function isCorrectAnswer(question: MeaningQuestion, optionId: string): boolean {
  return question.options.some(option => option.id === optionId) && optionId === question.correctOptionId
}

export interface MeaningGame {
  questions: MeaningQuestion[]
  index: number
  selectedOptionId: string | null
  score: number
}

export function startMeaningGame(questions: MeaningQuestion[]): MeaningGame {
  return { questions, index: 0, selectedOptionId: null, score: 0 }
}

export function answerMeaningQuestion(game: MeaningGame, optionId: string): MeaningGame {
  const question = game.questions[game.index]
  if (!question || game.selectedOptionId !== null || !question.options.some(option => option.id === optionId)) return game
  return { ...game, selectedOptionId: optionId, score: game.score + Number(isCorrectAnswer(question, optionId)) }
}

export function advanceMeaningGame(game: MeaningGame): MeaningGame {
  if (game.selectedOptionId === null || isMeaningGameOver(game)) return game
  return { ...game, index: game.index + 1, selectedOptionId: null }
}

export function isMeaningGameOver(game: MeaningGame): boolean {
  return game.index >= game.questions.length
}
