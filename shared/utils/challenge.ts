import type { CardKey, TopicId } from './learn/types'
import type { Difficulty, GenerateGameId } from './games/types'

export type ChallengeText = { hr: string, en: string }
export interface ChallengeMeta {
  source: 'random' | 'set' | 'quiz'
  topics?: TopicId[]
  game?: GenerateGameId
  difficulty?: Difficulty
}
export interface ChallengeQuestion {
  id: string
  mechanic: 'multiple-choice'
  prompt: ChallengeText
  options: ChallengeText[]
  correct: number
  explanation: ChallengeText
  card?: CardKey
}
/** A challenge set; `heritage_challenges.content` stores one as an immutable snapshot. */
export interface ChallengeContent {
  /** For a template snapshot, the template's revision; quiz-built snapshots use 1. */
  version: number
  /** The challenge template a fixed challenge was created from (absent for quiz-built ones). */
  templateId?: string
  sample: boolean
  title: ChallengeText
  meta?: ChallengeMeta
  rounds: { id: string, topic: ChallengeText, questions: ChallengeQuestion[] }[]
}
export interface GenerateChallengeInput {
  topics: TopicId[]
  game: GenerateGameId
  difficulty: Difficulty
  length: 5 | 10 | 15
}

export const DEFAULT_GENERATE: GenerateChallengeInput = {
  topics: ['rijeci', 'mjesta', 'bastina'],
  game: 'mjesovito',
  difficulty: 'srednje',
  length: 10
}
export interface QuizChallengeInput {
  questions: { id: string, optionIds: string[] }[]
  results: boolean[]
}
export interface ChallengeRound {
  topic: ChallengeText
  count: number
  answered?: number
  score?: number
}
export interface ChallengeState {
  code: string
  title: ChallengeText
  sample: boolean
  createdAt: string
  closesAt: string
  closed: boolean
  questionCount: number
  maxScore: number
  targetScore: number | null
  /** Filled on GET /api/challenges/:code from the snapshot; omitted on action responses. */
  meta?: ChallengeMeta | null
  rounds: ChallengeRound[]
  participant: null | {
    nickname: string
    phase: 'ready' | 'question' | 'feedback' | 'round' | 'finished'
    index: number
    total: number
    completedAt: string | null
    rounds: ChallengeRound[]
  }
  question: null | {
    id: string
    prompt: ChallengeText
    options: ChallengeText[]
    round: number
    number: number
  }
  feedback: null | {
    selected: number | null
    correct: number
    points: number
    explanation: ChallengeText
  }
}
export interface ChallengeLeaderboard {
  rows: { nickname: string, total: number, rank: number, rounds: number[], completedAt: string | null }[]
  count: number
}

export function challengeNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const name = input.normalize('NFC').trim().replace(/ +/g, ' ')
  return name.length >= 2 && name.length <= 24 && /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(name) ? name : null
}
