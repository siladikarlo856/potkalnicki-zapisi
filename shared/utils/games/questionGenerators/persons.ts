import type { PoolPerson } from '../../learn/types'
import { optionsValid, pickPersonDistractors } from '../distractors'
import { shuffled } from '../rng'
import { atlasPersonPath, poolPersons, type QuestionGenerator } from './generator'

/** osoba: who is the person behind the clue? */
export const osobaQuestions: QuestionGenerator<PoolPerson> = {
  candidates: poolPersons,
  question(target, { pool, difficulty, rng }) {
    const distractors = pickPersonDistractors(target, pool, difficulty, rng)
    if (distractors.length < 2) return null
    const options = shuffled([target, ...distractors], rng).map(p => ({ hr: p.name, en: p.name }))
    if (!optionsValid(options)) return null
    const correct = options.findIndex(o => o.hr === target.name)
    return {
      prompt: {
        hr: `Tko je to? ${target.clue}`,
        en: `Who is this? ${target.clue}`
      },
      options,
      correct,
      explanation: {
        hr: `To je ${target.name} (${target.years}).`,
        en: `This is ${target.name} (${target.years}).`
      },
      archivePath: atlasPersonPath(target.slug)
    }
  }
}
