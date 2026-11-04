import type { CardKey, TopicId } from '../learn/types'

export type Difficulty = 'lako' | 'srednje' | 'tesko'
export type GameId = 'znacenje' | 'rijec' | 'opcina' | 'crkva' | 'karta-koje' | 'osoba'

export type QuestionDisplay
  = | { type: 'map-target', point: { lat: number, lng: number } }
    | { type: 'map-points', points: { lat: number, lng: number }[] }

export interface GameQuestion {
  id: string
  gameId: GameId
  card: CardKey
  prompt: { hr: string, en: string }
  options: { hr: string, en: string }[]
  correct: number
  explanation: { hr: string, en: string }
  archivePath?: string
  display?: QuestionDisplay
}

export const CHALLENGEABLE_GAMES = ['znacenje', 'rijec', 'opcina', 'crkva'] as const satisfies readonly GameId[]
export type ChallengeableGameId = typeof CHALLENGEABLE_GAMES[number]

export type GenerateGameId = ChallengeableGameId | 'mjesovito'

export interface GenerateQuestionsOptions {
  topics: TopicId[]
  difficulty: Difficulty
  count: number
  rng: import('./rng').Rng
  exclude?: Set<CardKey>
}
