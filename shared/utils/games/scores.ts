import type { GameId } from './types'
import type { MapLayerId } from './mapFrame'

export const GAME_SCORES_KEY = 'pz-games/v1'

export interface BestScore { score: number, max: number, at: string }
export interface GameScoresV1 { version: 1, best: Record<string, BestScore>, mapLayer?: MapLayerId }

export const emptyGameScores = (): GameScoresV1 => ({ version: 1, best: {} })

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

/** Strict decoder: anything malformed gives the empty state. */
export function decodeGameScores(raw: string | null): GameScoresV1 {
  if (!raw) return emptyGameScores()
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || !data.best || typeof data.best !== 'object' || Array.isArray(data.best)) return emptyGameScores()
    const best: Record<string, BestScore> = {}
    for (const [id, value] of Object.entries(data.best as Record<string, BestScore>)) {
      if (!value || !count(value.score) || !count(value.max) || value.max < 1 || value.score > value.max || typeof value.at !== 'string') return emptyGameScores()
      best[id] = { score: value.score, max: value.max, at: value.at }
    }
    const mapLayer = data.mapLayer === 'karta' || data.mapLayer === 'reljef' || data.mapLayer === 'satelit' ? data.mapLayer : undefined
    return { version: 1, best, ...(mapLayer ? { mapLayer } : {}) }
  } catch {
    return emptyGameScores()
  }
}

/** Save the first completed round, including zero; later rounds must improve the correct-answer ratio (ties keep the earlier one). */
export function betterScore(current: BestScore | undefined, score: number, max: number): boolean {
  if (max < 1 || score < 0) return false
  return !current || score / max > current.score / current.max
}

export function withBestScore(state: GameScoresV1, game: GameId, score: number, max: number, at: string): GameScoresV1 {
  if (!betterScore(state.best[game], score, max)) return state
  return { version: 1, best: { ...state.best, [game]: { score, max, at } } }
}
