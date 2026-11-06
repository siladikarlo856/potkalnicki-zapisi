import type { CardKind, CardPool } from '../learn/types'
import { GAME_DEFINITIONS } from './definitions'
import type { GameCatalogueMeta, GameFormat, GameTopic } from './definitions'
import { groupingAvailable } from './grouping'
import type { GameId } from './types'

export type { GameFormat, GameTopic }

/** A catalogue tile: a Game definition that has catalogue meta, flattened. */
export interface GameEntry extends GameCatalogueMeta {
  id: GameId
  title: string
  challengeable: boolean
}

/** Old topic URLs; never reuse these slugs for new game paths (WP2 redirects). */
export const GAME_REDIRECT_SLUGS = [
  'rijeci',
  'crkve',
  'zemljopis',
  'poznati-ljudi',
  'legende',
  'povijest',
  'sport'
] as const

export const GAME_CATALOGUE: GameEntry[] = GAME_DEFINITIONS.flatMap(definition => definition.catalogue
  ? [{ id: definition.id, title: definition.label.hr, challengeable: definition.challengeable, ...definition.catalogue }]
  : [])

function poolMeetsNeeds(pool: CardPool, needs: { kind: CardKind, min: number }): boolean {
  const count = pool.cards.filter(card => card.kind === needs.kind).length
  return count >= needs.min
}

export function gameVisibleInPool(game: GameEntry, pool: CardPool | null, topic?: string): boolean {
  if (game.status !== 'live') return false
  if (topic && topic !== 'sve' && game.topic !== topic) return false
  if (game.id === 'grupiraj') {
    if (!pool) return true
    return groupingAvailable(pool)
  }
  if (game.needs) {
    if (!pool) return false
    if (!poolMeetsNeeds(pool, game.needs)) return false
  }
  return true
}

export function visibleGames(pool: CardPool | null, topic?: string): GameEntry[] {
  return GAME_CATALOGUE.filter(game => gameVisibleInPool(game, pool, topic))
}

export function soonGames(): GameEntry[] {
  return GAME_CATALOGUE.filter(game => game.status === 'soon')
}

export function liveTopicsInCatalogue(): GameTopic[] {
  const topics = new Set<GameTopic>()
  for (const game of GAME_CATALOGUE) {
    if (game.status === 'live') topics.add(game.topic)
  }
  return [...topics]
}

export function gamePathUsesRedirectSlug(path: string): boolean {
  return GAME_REDIRECT_SLUGS.some(slug => path.includes(`/igre/${slug}`))
}
