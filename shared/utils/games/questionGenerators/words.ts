import type { PoolWord } from '../../learn/types'
import { buildWordHeadwordOptions, buildWordMeaningOptions, optionsValid, pickWordDistractors } from '../distractors'
import { verifiedWords, type QuestionContext, type QuestionGenerator } from './generator'

function wordDistractors(game: 'znacenje' | 'rijec', target: PoolWord, { pool, difficulty, rng, wordStatus }: QuestionContext) {
  const words = verifiedWords(pool, target.topics.length ? target.topics : ['rijeci'], wordStatus)
  return pickWordDistractors(game, target, words, difficulty, rng)
}

/** znacenje: what does the local word mean? */
export const znacenjeQuestions: QuestionGenerator<PoolWord> = {
  candidates: verifiedWords,
  question(target, context) {
    const distractors = wordDistractors('znacenje', target, context)
    if (distractors.length < 2) return null
    const { options, correct, cards } = buildWordMeaningOptions(target, distractors, context.rng)
    if (!optionsValid(options)) return null
    const meaningEn = target.meaningEn?.trim() || target.meaning
    return {
      prompt: {
        hr: `Što znači riječ „${target.headword}”?`,
        en: `What does “${target.headword}” mean?`
      },
      options,
      correct,
      explanation: {
        hr: `„${target.headword}” znači „${target.meaning.trim()}”.`,
        en: `“${target.headword}” means “${meaningEn}”.`
      },
      optionCards: cards
    }
  }
}

/** rijec: which local word has this meaning? */
export const rijecQuestions: QuestionGenerator<PoolWord> = {
  candidates: verifiedWords,
  question(target, context) {
    const distractors = wordDistractors('rijec', target, context)
    if (distractors.length < 2) return null
    const { options, correct, cards } = buildWordHeadwordOptions(target, distractors, context.rng)
    if (!optionsValid(options)) return null
    const meaningEn = target.meaningEn?.trim() || target.meaning
    return {
      prompt: {
        hr: `Kak se kod nas veli „${target.meaning.trim()}”?`,
        en: `Which local word means “${meaningEn}”?`
      },
      options,
      correct,
      explanation: {
        hr: `„${target.meaning.trim()}” se kod nas veli „${target.headword}”.`,
        en: `The local word is “${target.headword}”.`
      },
      optionCards: cards
    }
  }
}
