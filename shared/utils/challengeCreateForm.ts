import type { GenerateChallengeInput } from './challenge'
import { DEFAULT_GENERATE } from './challenge'
import type { CardPool, TopicId } from './learn/types'
import type { Difficulty, GenerateGameId } from './games/types'
import { generateGameEnabled } from './games/questions'

const LENGTHS = new Set([5, 10, 15])
const GAMES = new Set<GenerateGameId>(['mjesovito', 'znacenje', 'rijec', 'opcina', 'crkva', 'karta-koje', 'karta-tocke', 'osoba'])

export interface ChallengeCreateFormState {
  topics: TopicId[]
  game: GenerateGameId
  difficulty: Difficulty
  length: GenerateChallengeInput['length']
}

export function defaultChallengeCreateForm(): ChallengeCreateFormState {
  return {
    topics: [...DEFAULT_GENERATE.topics],
    game: DEFAULT_GENERATE.game,
    difficulty: DEFAULT_GENERATE.difficulty,
    length: DEFAULT_GENERATE.length
  }
}

/** Same shape as vue-router `LocationQuery` (no vue-router import in shared code). */
export type ChallengeCreateQueryInput = Record<string, string | null | (string | null)[] | undefined>

function queryParam(value: ChallengeCreateQueryInput[string]): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.filter((part): part is string => typeof part === 'string').join(',')
  return value
}

export function applyChallengeCreateQuery(
  query: ChallengeCreateQueryInput,
  liveTopicIds: ReadonlySet<TopicId>,
  current: ChallengeCreateFormState = defaultChallengeCreateForm()
): ChallengeCreateFormState {
  const next = { ...current, topics: [...current.topics] }
  const teme = queryParam(query.teme)
  if (teme) {
    const parsed = teme.split(',').map(part => part.trim()).filter((id): id is TopicId => liveTopicIds.has(id as TopicId))
    if (parsed.length) next.topics = parsed
  }
  const igra = queryParam(query.igra)
  if (GAMES.has(igra as GenerateGameId)) next.game = igra as GenerateGameId
  const tezina = queryParam(query.tezina)
  if (tezina === 'lako' || tezina === 'srednje' || tezina === 'tesko') next.difficulty = tezina
  const n = Number(queryParam(query.n))
  if (Number.isFinite(n) && LENGTHS.has(n)) next.length = n as GenerateChallengeInput['length']
  return next
}

export function challengeCreateGameEnabled(game: GenerateGameId, topics: TopicId[], pool: CardPool): boolean {
  if (!topics.length) return false
  return generateGameEnabled(game, topics, pool)
}
