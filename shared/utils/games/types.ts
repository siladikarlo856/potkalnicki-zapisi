import type { CardKey, TopicId } from '../learn/types'
import type { ChallengeableGameId } from './definitions'

export type Difficulty = 'lako' | 'srednje' | 'tesko'
/** Every game has one id; its Game definition lives in `./definitions`. */
export type GameId
  = | 'znacenje' | 'rijec' | 'opcina' | 'crkva' | 'spoji' | 'karta' | 'karta-koje' | 'karta-tocke' | 'osoba'
    | 'klub-mjesto' | 'klub-liga' | 'klub-odakle' | 'sela-i-opcine' | 'nabroji' | 'grupiraj' | 'bez-greske'
    | 'rijec-dana' | 'kartice' | 'uci-kartu' | 'istina-legenda'

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

// Derived from the Game definition registry; re-exported for existing callers.
export { CHALLENGEABLE_GAMES } from './definitions'
export type { ChallengeableGameId } from './definitions'

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
