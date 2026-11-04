import type { CardKey, CardPool } from '../learn/types'
import { generateQuestions } from './questions'
import type { Rng } from './rng'
import { shuffled } from './rng'
import type { GameId, GameQuestion } from './types'

const BEZ_GRESKE_GAMES: GameId[] = ['znacenje', 'opcina', 'crkva']

export function nextBezGreskeQuestion(pool: CardPool, rng: Rng, exclude: Set<CardKey>): GameQuestion | null {
  const games = shuffled(BEZ_GRESKE_GAMES, rng)
  for (const game of games) {
    const [question] = generateQuestions(game, pool, {
      topics: ['rijeci', 'mjesta', 'bastina'],
      difficulty: 'srednje',
      count: 1,
      rng,
      exclude,
      wordStatus: 'verified'
    })
    if (question) return question
  }
  return null
}

/** Streak scores use a fixed max so a longer run always beats a shorter one in `pz-games/v1`. */
export const BEZ_GRESKE_SCORE_MAX = 10_000
