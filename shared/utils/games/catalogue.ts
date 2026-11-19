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

/** What a player does in a game; the chips on the games list filter by it (20-screens.md, Igre). */
export type GameType = 'odabir' | 'upis' | 'spajanje' | 'razvrstavanje' | 'karta' | 'niz'

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  odabir: 'Odabir odgovora',
  upis: 'Upis odgovora',
  spajanje: 'Spajanje',
  razvrstavanje: 'Razvrstavanje',
  karta: 'Karta',
  niz: 'Niz točnih'
}

const FORMAT_TYPES: Record<GameFormat, GameType | null> = {
  'dnevna': null,
  'odabir': 'odabir',
  'karta': 'karta',
  'upisi': 'upis',
  'spoji': 'spajanje',
  'razvrstaj': 'razvrstavanje',
  'grupiraj': 'razvrstavanje',
  'bez-greske': 'niz'
}

export const gameTypeOf = (game: Pick<GameEntry, 'format'>): GameType | null => FORMAT_TYPES[game.format]

/** The four groups of the games list, by what the games train. Games of mixed topics sit with the words. */
export type GameGroupId = 'rijeci' | 'mjesta' | 'bastina' | 'ljudi'

export const GAME_GROUPS: { id: GameGroupId, label: string }[] = [
  { id: 'rijeci', label: 'Riječi' },
  { id: 'mjesta', label: 'Mjesta i karta' },
  { id: 'bastina', label: 'Baština' },
  { id: 'ljudi', label: 'Priče i ljudi' }
]

const TOPIC_GROUPS: Record<GameTopic, GameGroupId> = {
  rijeci: 'rijeci',
  mjesovito: 'rijeci',
  mjesta: 'mjesta',
  bastina: 'bastina',
  osobe: 'ljudi',
  legende: 'ljudi'
}

export const gameGroupOf = (game: Pick<GameEntry, 'topic'>): GameGroupId => TOPIC_GROUPS[game.topic]

/** Games that have their own screen elsewhere (the daily word, the learning cards): not part of the games list. */
const OWN_SCREEN: readonly string[] = ['rijec-dana', 'kartice']

export const isListedGame = (game: Pick<GameEntry, 'id'>) => !OWN_SCREEN.includes(game.id)
