import type { CardProgress } from './leitner'
import { isDue } from './leitner'
import type { LearnCurrent } from './learnState'
import type { CardKey, CardPool } from './types'
import { questionForLearnReview } from '../games/questions'
import { mulberry32, type Rng } from '../games/rng'
import type { GameQuestion } from '../games/types'

export function learnReviewRng(cardKey: CardKey): Rng {
  let seed = 0
  for (let i = 0; i < cardKey.length; i++) seed = (Math.imul(31, seed) + cardKey.charCodeAt(i)) >>> 0
  return mulberry32(seed)
}

export function shouldAskReviewQuestion(
  mode: LearnCurrent['mode'],
  cardKey: CardKey,
  progress: Record<string, CardProgress>,
  today: string,
  results: LearnCurrent['results']
): boolean {
  if (mode === 'list') return false
  if (mode === 'review') return true
  if (Object.hasOwn(results, cardKey)) return false
  const p = progress[cardKey]
  return !!p && isDue(p, today)
}

export function buildLearnReviewQuestion(pool: CardPool, cardKey: CardKey): GameQuestion | null {
  return questionForLearnReview(pool, cardKey, learnReviewRng(cardKey))
}
