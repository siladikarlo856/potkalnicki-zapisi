import { pzRoutes } from '../../appRoutes'
import { cardMatchesTopicSelection } from '../../learn/topics'
import type { CardPool, PoolCard, PoolClub, PoolItem, PoolPerson, PoolPlace, PoolWord, TopicId } from '../../learn/types'
import { slugMap } from '../distractors'
import type { Rng } from '../rng'
import type { Difficulty, GameQuestion, GenerateQuestionsOptions } from '../types'

export type WordStatus = GenerateQuestionsOptions['wordStatus']

export interface QuestionContext {
  pool: CardPool
  difficulty: Difficulty
  rng: Rng
  wordStatus?: WordStatus
}

/** A question without the parts its Game definition settles: id, game id and card. */
export type QuestionBody = Omit<GameQuestion, 'id' | 'gameId' | 'card'>

/**
 * How one game makes its multiple-choice questions. It lives on the game's Game definition;
 * `generateQuestions` picks the targets and keys the questions.
 */
export interface QuestionGenerator<Target extends PoolCard = PoolCard> {
  /** The cards this game can ask about under the chosen topics, in pool order. */
  candidates(pool: CardPool, topics: TopicId[], wordStatus?: WordStatus): Target[]
  /** The question about one target, or null when the pool cannot make a fair one. */
  question(target: Target, context: QuestionContext): QuestionBody | null
}

export const atlasSettlementPath = (slug: string) => `${pzRoutes.home}/naselja/${slug}`
export const atlasPersonPath = (slug: string) => `${pzRoutes.persons}/${slug}`

function cardsOfKind<Kind extends PoolCard['kind']>(pool: CardPool, kind: Kind, topics: TopicId[]): Extract<PoolCard, { kind: Kind }>[] {
  const slugs = slugMap(pool)
  return pool.cards.filter((c): c is Extract<PoolCard, { kind: Kind }> =>
    c.kind === kind && cardMatchesTopicSelection(c, topics, slugs))
}

export function verifiedWords(pool: CardPool, topics: TopicId[], wordStatus: WordStatus = 'verified'): PoolWord[] {
  return cardsOfKind(pool, 'word', topics).filter(w => wordStatus === 'any' || w.status === 'verified')
}

export const places = (pool: CardPool, topics: TopicId[]): PoolPlace[] => cardsOfKind(pool, 'place', topics)
export const churchItems = (pool: CardPool, topics: TopicId[]): PoolItem[] => cardsOfKind(pool, 'item', topics)
export const poolPersons = (pool: CardPool, topics: TopicId[]): PoolPerson[] => cardsOfKind(pool, 'person', topics)
export const poolClubs = (pool: CardPool, topics: TopicId[]): PoolClub[] => cardsOfKind(pool, 'club', topics)
