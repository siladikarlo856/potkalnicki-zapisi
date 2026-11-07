import { cardMatchesTopicSelection } from '../learn/topics'
import type { CardKey, CardKind, CardPool, PoolCard, TopicId } from '../learn/types'
import { slugMap } from './distractors'
import { gameDefinition, questionCardKey, type ChallengeableGameId, type GameDefinition } from './definitions'
import type { QuestionContext } from './questionGenerators/generator'
import { shuffled } from './rng'
import type { GameId, GameQuestion, GenerateGameId, GenerateQuestionsOptions } from './types'

const CHALLENGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

function questionId(game: GameId, kind: string, entityId: string): string {
  const id = `${game}_${kind}_${entityId}`
  if (id.length > 200 || !CHALLENGE_ID.test(id)) throw new Error('Invalid question id')
  return id
}

interface Candidate {
  target: PoolCard
  key: CardKey
}

/** The cards a game can ask about, each with the CardKey its question carries. Empty for a game without a generator. */
function candidatesFor(definition: GameDefinition, pool: CardPool, topics: TopicId[], wordStatus: GenerateQuestionsOptions['wordStatus']): Candidate[] {
  if (!definition.questions) return []
  return definition.questions.candidates(pool, topics, wordStatus).map(target => ({
    target,
    key: questionCardKey(definition.id as ChallengeableGameId, target.id)
  }))
}

function ask(definition: GameDefinition, { target, key }: Candidate, context: QuestionContext): GameQuestion | null {
  const body = definition.questions!.question(target, context)
  if (!body) return null
  return {
    id: questionId(definition.id, definition.questionCard!.kind, target.id),
    gameId: definition.id,
    card: key,
    ...body
  }
}

/** The game that reviews a learn card of each kind. */
const LEARN_REVIEW_GAME: Partial<Record<CardKind, ChallengeableGameId>> = {
  word: 'znacenje',
  place: 'opcina',
  item: 'crkva'
}

/** One multiple-choice question for a learn review card (meanings, units or settlements). */
export function questionForLearnReview(pool: CardPool, cardKey: CardKey, rng: GenerateQuestionsOptions['rng']): GameQuestion | null {
  const card = pool.cards.find(c => c.key === cardKey)
  const game = card && LEARN_REVIEW_GAME[card.kind]
  if (!card || !game) return null
  const topics = card.topics.length ? [...card.topics] : (['rijeci', 'mjesta', 'bastina'] as TopicId[])
  const definition = gameDefinition(game)
  const candidate = candidatesFor(definition, pool, topics, undefined).find(c => c.key === cardKey)
  if (!candidate) return null
  return ask(definition, candidate, { pool, difficulty: 'srednje', rng })
}

export function generateQuestions(game: GameId, pool: CardPool, options: GenerateQuestionsOptions): GameQuestion[] {
  const { count, rng, difficulty, exclude = new Set<CardKey>(), topics, wordStatus } = options
  if (count <= 0) return []

  const definition = gameDefinition(game)
  const candidates = shuffled(candidatesFor(definition, pool, topics, wordStatus).filter(c => !exclude.has(c.key)), rng)
  const questions: GameQuestion[] = []
  const used = new Set(exclude)

  for (const candidate of candidates) {
    if (questions.length >= count) break
    if (used.has(candidate.key)) continue
    const question = ask(definition, candidate, { pool, difficulty, rng, wordStatus })
    if (!question) continue
    if (questions.some(q => q.id === question.id)) continue
    questions.push(question)
    used.add(question.card)
  }

  return questions
}

const ROUND_META = {
  rijeci: { topic: { hr: 'Riječi', en: 'Words' } },
  mjesta: { topic: { hr: 'Mjesta', en: 'Places' } },
  bastina: { topic: { hr: 'Baština', en: 'Heritage' } },
  sport: { topic: { hr: 'Sport i klubovi', en: 'Sport and clubs' } },
  osobe: { topic: { hr: 'Osobe', en: 'Persons' } }
} as const

/** The games each round can be played with, and the ones a mixed (mjesovito) round asks. */
const ROUND_GAMES: Record<keyof typeof ROUND_META, { games: readonly ChallengeableGameId[], mixed: readonly ChallengeableGameId[] }> = {
  rijeci: { games: ['znacenje', 'rijec'], mixed: ['znacenje', 'rijec'] },
  mjesta: { games: ['opcina', 'karta-koje', 'karta-tocke'], mixed: ['opcina'] },
  bastina: { games: ['crkva'], mixed: ['crkva'] },
  sport: { games: ['klub-mjesto', 'klub-liga', 'klub-odakle'], mixed: ['klub-mjesto', 'klub-liga', 'klub-odakle'] },
  osobe: { games: ['osoba'], mixed: ['osoba'] }
}

export function gamesForRound(roundId: keyof typeof ROUND_META, game: GenerateGameId): GameId[] {
  const round = ROUND_GAMES[roundId]
  if (!round) return []
  if (game === 'mjesovito') return [...round.mixed]
  return round.games.includes(game) ? [game] : []
}

export function roundActive(roundId: keyof typeof ROUND_META, topics: GenerateQuestionsOptions['topics'], pool: CardPool): boolean {
  const slugs = slugMap(pool)
  if (roundId === 'sport') {
    const selected = topics.includes('sport')
    if (!selected) return false
    return pool.cards.some(c => c.kind === 'club' && cardMatchesTopicSelection(c, topics, slugs))
  }
  if (roundId === 'osobe') {
    if (!topics.includes('osobe')) return false
    return pool.cards.some(c => c.kind === 'person' && cardMatchesTopicSelection(c, topics, slugs))
  }
  const kind = roundId === 'rijeci' ? 'word' : roundId === 'mjesta' ? 'place' : 'item'
  const root = roundId
  const selected = topics.some(t => t === root || t.startsWith(`${root}-`))
  if (!selected) return false
  return pool.cards.some(c => c.kind === kind && cardMatchesTopicSelection(c, topics, slugs))
}

export function activeRounds(topics: GenerateQuestionsOptions['topics'], pool: CardPool, game: GenerateGameId) {
  return (['rijeci', 'mjesta', 'bastina', 'sport', 'osobe'] as const).filter(id => roundActive(id, topics, pool) && gamesForRound(id, game).length)
}

export function generateGameEnabled(game: GenerateGameId, topics: GenerateQuestionsOptions['topics'], pool: CardPool): boolean {
  return activeRounds(topics, pool, game).length > 0
}

export { ROUND_META }
