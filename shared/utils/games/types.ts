import type { CardKey, TopicId } from '../learn/types'

export type Difficulty = 'lako' | 'srednje' | 'tesko'
export type GameId = 'znacenje' | 'rijec' | 'opcina' | 'crkva' | 'karta' | 'karta-koje' | 'osoba' | 'klub-mjesto' | 'klub-liga' | 'klub-odakle' | 'grupiraj' | 'bez-greske'

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
  /** Solo play only (WP7): the card behind each option, in option order. Word games set it; it is never stored in challenges. */
  optionCards?: CardKey[]
}

export const CHALLENGEABLE_GAMES = ['znacenje', 'rijec', 'opcina', 'crkva', 'klub-mjesto', 'klub-liga', 'klub-odakle'] as const satisfies readonly GameId[]
export type ChallengeableGameId = typeof CHALLENGEABLE_GAMES[number]

export type GenerateGameId = ChallengeableGameId | 'mjesovito'

export interface GenerateQuestionsOptions {
  topics: TopicId[]
  difficulty: Difficulty
  count: number
  rng: import('./rng').Rng
  exclude?: Set<CardKey>
  /** Which words may be asked. Challenges use 'verified' (the default); solo play may use 'any' (community and verified). */
  wordStatus?: 'verified' | 'any'
}
