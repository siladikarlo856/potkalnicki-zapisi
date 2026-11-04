import { GAME_SCORES_KEY, decodeGameScores, emptyGameScores, withBestScore } from '~~/shared/utils/games/scores'
import type { GameScoresV1 } from '~~/shared/utils/games/scores'
import type { GameId } from '~~/shared/utils/games/types'

/** Best score per game, kept on the device in `pz-games/v1`. Storage failures never reach the UI. */
export function useGameScores() {
  const scores = useState<GameScoresV1>('pz-game-scores', emptyGameScores)
  const loaded = useState('pz-game-scores-loaded', () => false)

  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      scores.value = decodeGameScores(window.localStorage.getItem(GAME_SCORES_KEY))
    } catch {
      scores.value = emptyGameScores()
    }
  }

  onMounted(load)

  function recordBest(game: GameId, score: number, max: number) {
    if (!import.meta.client) return
    load()
    const next = withBestScore(scores.value, game, score, max, new Date().toISOString())
    if (next === scores.value) return
    scores.value = next
    try {
      window.localStorage.setItem(GAME_SCORES_KEY, JSON.stringify(next))
    } catch {
      // Keep this session's best even when storage is unavailable or full.
    }
  }

  return { scores, best: (game: GameId) => scores.value.best[game], recordBest }
}
